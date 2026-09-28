const router = require('express').Router();
const db = require('../db');
const { authenticate, allow } = require('../middleware/auth');
const { notify, notifyRole } = require('../services');
const U = require('../utils');

router.use(authenticate);

const LOW_STOCK = 5; // units
// Red-cell compatibility: recipient -> groups that can donate to them
const CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

// Donation rules (based on India's NBTC guidelines, simplified)
// onDate lets the admin record a donation that happened on an earlier day.
function eligibility(donor, onDate = U.today()) {
  const reasons = [];
  const age = U.ageFrom(donor.dob);
  if (age === null || age < 18 || age > 65) reasons.push('Donors must be 18–65 years old');
  if (Number(donor.weight_kg) < 45) reasons.push('Donors must weigh at least 45 kg');
  const gap = donor.gender === 'female' ? 120 : 90;
  let nextDate = null;
  const last = donor.last_donation_date;
  if (last) {
    nextDate = U.addDays(last, gap);
    const tooClose = last <= onDate ? nextDate > onDate : U.daysBetween(onDate, last) < gap;
    if (tooClose) reasons.push(`Next donation possible from ${nextDate} (${gap}-day gap)`);
  }
  return { eligible: reasons.length === 0, reasons, next_date: nextDate, gap_days: gap, age };
}
const maskPhone = (p) => (p ? p.replace(/\s|-/g, '').replace(/^(\+?\d{2})\d+(\d{2})$/, '$1••••••$2') : '');

// ---------- Stock ----------
router.get('/stock', async (_req, res) => {
  const rows = await db.all('SELECT blood_group, units, updated_at FROM blood_bank');
  const order = U.BLOOD_GROUPS;
  rows.sort((a, b) => order.indexOf(a.blood_group) - order.indexOf(b.blood_group));
  res.json({
    low_threshold: LOW_STOCK,
    compatibility: CAN_RECEIVE_FROM,
    stock: rows.map((r) => ({ ...r, units: Number(r.units), low: Number(r.units) < LOW_STOCK })),
  });
});

router.patch('/stock', allow('admin'), async (req, res) => {
  const group = U.bloodGroup(req.body.blood_group);
  const units = U.int(req.body.units, 'Units', { min: 0, max: 10000 });
  await db.run('UPDATE blood_bank SET units = ?, updated_at = ? WHERE blood_group = ?', [units, U.nowIso(), group]);
  res.json({ blood_group: group, units });
});

// ---------- Donors ----------
router.get('/donors', async (req, res) => {
  const where = ['d.verified = 1', 'd.available = 1'];
  const params = [];
  if (req.query.blood_group) {
    const group = U.bloodGroup(req.query.blood_group);
    // "compatible" = also show donors whose blood can be given to this group
    const groups = req.query.compatible === '1' ? CAN_RECEIVE_FROM[group] : [group];
    where.push(`d.blood_group IN (${groups.map(() => '?').join(',')})`);
    params.push(...groups);
  }
  if (req.query.city) {
    where.push('d.city LIKE ?');
    params.push(`%${String(req.query.city).slice(0, 60)}%`);
  }
  const rows = await db.all(`SELECT d.* FROM donors d WHERE ${where.join(' AND ')} ORDER BY d.city, d.name LIMIT 100`, params);
  res.json(
    rows
      .map((d) => {
        const e = eligibility(d);
        return { id: d.id, name: d.name, blood_group: d.blood_group, city: d.city, phone_masked: maskPhone(d.phone), eligible: e.eligible, next_date: e.next_date };
      })
      .sort((a, b) => Number(b.eligible) - Number(a.eligible))
  );
});

router.get('/donors/:id/contact', async (req, res) => {
  const d = await db.get('SELECT id, name, phone FROM donors WHERE id = ? AND verified = 1 AND available = 1', [Number(req.params.id)]);
  if (!d) U.fail(404, 'Donor not found');
  res.json(d);
});

router.get('/me/donor', async (req, res) => {
  const d = await db.get('SELECT * FROM donors WHERE user_id = ?', [req.user.id]);
  if (!d) return res.json(null);
  const donations = await db.all('SELECT donation_date, units FROM donations WHERE donor_id = ? ORDER BY donation_date DESC', [d.id]);
  res.json({ ...d, verified: !!d.verified, available: !!d.available, eligibility: eligibility(d), donations });
});

router.post('/me/donor', allow('patient'), async (req, res) => {
  if (await db.get('SELECT id FROM donors WHERE user_id = ?', [req.user.id])) U.fail(409, 'You are already registered as a donor');
  const b = req.body || {};
  const donor = {
    name: req.user.name,
    blood_group: U.bloodGroup(b.blood_group),
    gender: U.oneOf(b.gender, 'Gender', ['female', 'male', 'other']),
    dob: U.date(b.dob, 'Date of birth'),
    weight_kg: U.int(b.weight_kg, 'Weight (kg)', { min: 20, max: 250 }),
    phone: U.phone(b.phone || req.user.phone),
    city: U.str(b.city, 'City', { max: 80 }),
    last_donation_date: U.date(b.last_donation_date, 'Last donation date', { required: false }),
  };
  if (donor.last_donation_date && donor.last_donation_date > U.today()) U.fail(400, 'Last donation date cannot be in the future');
  const e = eligibility(donor);
  const age = e.age;
  if (age !== null && (age < 18 || age > 65)) U.fail(400, 'Blood donors must be between 18 and 65 years old');
  if (donor.weight_kg < 45) U.fail(400, 'Blood donors must weigh at least 45 kg');
  await db.run(
    `INSERT INTO donors (user_id, name, blood_group, gender, dob, weight_kg, phone, city, last_donation_date, verified, available, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
    [req.user.id, donor.name, donor.blood_group, donor.gender, donor.dob, donor.weight_kg, donor.phone, donor.city, donor.last_donation_date, U.nowIso()]
  );
  await notifyRole('admin', 'New donor to verify', `${donor.name} (${donor.blood_group}, ${donor.city}) registered as a blood donor.`, '#/donors');
  res.status(201).json({ ok: true });
});

router.patch('/me/donor', allow('patient'), async (req, res) => {
  const r = await db.run('UPDATE donors SET available = ?, city = COALESCE(?, city) WHERE user_id = ?', [
    req.body.available ? 1 : 0, U.str(req.body.city, 'City', { required: false, max: 80 }), req.user.id,
  ]);
  if (!r.changes) U.fail(404, 'Register as a donor first');
  res.json({ ok: true });
});

// ---------- Requests ----------
router.post('/requests', async (req, res) => {
  const b = req.body || {};
  const r = {
    patient_name: U.str(b.patient_name, 'Patient name', { max: 120 }),
    blood_group: U.bloodGroup(b.blood_group),
    units: U.int(b.units, 'Units', { min: 1, max: 20 }),
    hospital: U.str(b.hospital, 'Hospital', { max: 160 }),
    city: U.str(b.city, 'City', { max: 80 }),
    urgency: U.oneOf(b.urgency || 'urgent', 'Urgency', ['normal', 'urgent', 'critical']),
    contact_phone: U.phone(b.contact_phone, 'Contact phone'),
    notes: U.str(b.notes, 'Notes', { required: false, max: 500 }),
  };
  const now = U.nowIso();
  const ins = await db.run(
    `INSERT INTO blood_requests (requested_by, patient_name, blood_group, units, hospital, city, urgency, contact_phone, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [req.user.id, r.patient_name, r.blood_group, r.units, r.hospital, r.city, r.urgency, r.contact_phone, r.notes, now, now]
  );
  await notifyRole('admin', `${r.urgency === 'critical' ? 'CRITICAL ' : ''}blood request: ${r.units} unit(s) ${r.blood_group}`, `${r.patient_name} at ${r.hospital}, ${r.city}.`, '#/requests');
  const stock = await db.get('SELECT units FROM blood_bank WHERE blood_group = ?', [r.blood_group]);
  res.status(201).json({ id: ins.insertId, in_stock: Number(stock ? stock.units : 0) });
});

router.get('/requests', async (req, res) => {
  const mine = req.user.role !== 'admin' || req.query.mine;
  const rows = await db.all(
    `SELECT r.*, u.name AS requested_by_name FROM blood_requests r JOIN users u ON u.id = r.requested_by
     ${mine ? 'WHERE r.requested_by = ?' : ''} ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.id DESC LIMIT 200`,
    mine ? [req.user.id] : []
  );
  res.json(rows);
});

// Admin: approve / reject / fulfil (fulfil takes units out of stock)
router.patch('/requests/:id', allow('admin'), async (req, res) => {
  const action = U.oneOf(req.body.action, 'Action', ['approve', 'reject', 'fulfil']);
  const note = U.str(req.body.admin_note, 'Note', { required: false, max: 500 });
  const r = await db.get('SELECT * FROM blood_requests WHERE id = ?', [Number(req.params.id)]);
  if (!r) U.fail(404, 'Request not found');
  const allowed = { approve: ['pending'], reject: ['pending', 'approved'], fulfil: ['pending', 'approved'] };
  if (!allowed[action].includes(r.status)) U.fail(400, `A ${r.status} request can't be changed with "${action}"`);
  const status = { approve: 'approved', reject: 'rejected', fulfil: 'fulfilled' }[action];
  await db.tx(async (t) => {
    if (action === 'fulfil') {
      const upd = await t.run('UPDATE blood_bank SET units = units - ?, updated_at = ? WHERE blood_group = ? AND units >= ?', [r.units, U.nowIso(), r.blood_group, r.units]);
      if (!upd.changes) {
        const s = await t.get('SELECT units FROM blood_bank WHERE blood_group = ?', [r.blood_group]);
        U.fail(409, `Only ${s ? s.units : 0} unit(s) of ${r.blood_group} in stock. Search donors or update stock first.`);
      }
    }
    await t.run('UPDATE blood_requests SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?', [status, note, U.nowIso(), r.id]);
  });
  const msg = {
    approved: 'Your request is approved. The blood bank will contact you shortly.',
    rejected: `Your request could not be met${note ? ': ' + note : '.'} Try searching for donors.`,
    fulfilled: `${r.units} unit(s) of ${r.blood_group} have been issued for ${r.patient_name}.`,
  }[status];
  await notify(r.requested_by, `Blood request ${status}`, msg, '#/blood');
  res.json({ ok: true, status });
});

// ---------- Admin: donor management ----------
router.get('/admin/donors', allow('admin'), async (_req, res) => {
  const rows = await db.all(
    `SELECT d.*, (SELECT COUNT(*) FROM donations x WHERE x.donor_id = d.id) AS donation_count
       FROM donors d ORDER BY d.verified, d.id DESC`
  );
  res.json(rows.map((d) => ({ ...d, donation_count: Number(d.donation_count), eligibility: eligibility(d) })));
});

router.patch('/admin/donors/:id/verify', allow('admin'), async (req, res) => {
  const d = await db.get('SELECT * FROM donors WHERE id = ?', [Number(req.params.id)]);
  if (!d) U.fail(404, 'Donor not found');
  const verified = req.body.verified ? 1 : 0;
  await db.run('UPDATE donors SET verified = ? WHERE id = ?', [verified, d.id]);
  if (verified && d.user_id) await notify(d.user_id, 'You are a verified blood donor', 'Thank you! Patients can now find you when they need your blood group.', '#/blood');
  res.json({ ok: true });
});

router.post('/admin/donations', allow('admin'), async (req, res) => {
  const d = await db.get('SELECT * FROM donors WHERE id = ?', [U.int(req.body.donor_id, 'Donor', { min: 1 })]);
  if (!d) U.fail(404, 'Donor not found');
  const dateStr = U.date(req.body.donation_date || U.today(), 'Donation date');
  if (dateStr > U.today()) U.fail(400, 'Donation date cannot be in the future');
  const units = U.int(req.body.units ?? 1, 'Units', { min: 1, max: 2 });
  const e = eligibility(d, dateStr);
  if (!e.eligible && !req.body.override) U.fail(400, `Donor is not eligible: ${e.reasons.join('; ')}`);
  await db.tx(async (t) => {
    await t.run('INSERT INTO donations (donor_id, donation_date, units, recorded_by, created_at) VALUES (?, ?, ?, ?, ?)', [d.id, dateStr, units, req.user.id, U.nowIso()]);
    await t.run('UPDATE blood_bank SET units = units + ?, updated_at = ? WHERE blood_group = ?', [units, U.nowIso(), d.blood_group]);
    const latest = d.last_donation_date && d.last_donation_date > dateStr ? d.last_donation_date : dateStr;
    await t.run('UPDATE donors SET last_donation_date = ?, verified = 1 WHERE id = ?', [latest, d.id]);
  });
  if (d.user_id) await notify(d.user_id, 'Thank you for donating blood', `Your donation on ${dateStr} has been recorded. You can donate again after ${e.gap_days} days.`, '#/blood');
  res.status(201).json({ ok: true });
});

module.exports = router;
module.exports.eligibility = eligibility;
