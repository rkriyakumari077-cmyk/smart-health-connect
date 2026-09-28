const router = require('express').Router();
const db = require('../db');
const { authenticate, allow } = require('../middleware/auth');
const { notify, notifyRole } = require('../services');
const U = require('../utils');

router.use(authenticate);

const TIME_SLOTS = ['07:00–09:00', '09:00–11:00', '11:00–13:00', '16:00–18:00'];
const STATUS_FLOW = ['booked', 'sample_collected', 'processing', 'report_ready'];
const tidyTest = (t) => t && { ...t, parameters: U.parseJson(t.parameters, []), home_collection: !!t.home_collection, active: !!t.active };

router.get('/tests', async (req, res) => {
  const all = req.user.role === 'admin' && req.query.all;
  res.json((await db.all(`SELECT * FROM lab_tests ${all ? '' : 'WHERE active = 1'} ORDER BY category, name`)).map(tidyTest));
});
router.get('/slots', (_req, res) => res.json(TIME_SLOTS));

const BOOKING_SELECT = `
  SELECT b.*, t.name AS test_name, t.category, t.sample_type, t.preparation, t.turnaround_hours,
         u.name AS patient_name, u.phone AS patient_phone, u.id AS patient_user_id, p.dob AS patient_dob, p.gender AS patient_gender,
         r.id AS report_id
    FROM test_bookings b
    JOIN lab_tests t ON t.id = b.test_id
    JOIN patients p ON p.id = b.patient_id JOIN users u ON u.id = p.user_id
    LEFT JOIN test_reports r ON r.booking_id = b.id`;

async function loadBooking(id, user) {
  const b = await db.get(`${BOOKING_SELECT} WHERE b.id = ?`, [Number(id)]);
  if (!b || (user.role === 'patient' && b.patient_id !== user.patientId) || user.role === 'doctor') U.fail(404, 'Booking not found');
  return b;
}

router.post('/bookings', allow('patient'), async (req, res) => {
  const body = req.body || {};
  const test = await db.get('SELECT * FROM lab_tests WHERE id = ? AND active = 1', [U.int(body.test_id, 'Test', { min: 1 })]);
  if (!test) U.fail(404, 'Test not found');
  const type = U.oneOf(body.collection_type, 'Collection type', ['home', 'lab']);
  if (type === 'home' && !test.home_collection) U.fail(400, `${test.name} needs a lab visit — home collection isn't available for it`);
  const address = type === 'home' ? U.str(body.address, 'Address for home collection', { max: 255 }) : null;
  const dateStr = U.date(body.booking_date, 'Date');
  if (dateStr < U.today()) U.fail(400, 'Pick today or a future date');
  if (dateStr > U.addDays(U.today(), 30)) U.fail(400, 'Tests can be booked up to 30 days ahead');
  const slot = U.oneOf(body.time_slot, 'Time slot', TIME_SLOTS);
  if (dateStr === U.today() && slot.slice(6) <= U.nowTime()) U.fail(400, 'That time slot has already passed today');
  const now = U.nowIso();
  const r = await db.run(
    `INSERT INTO test_bookings (patient_id, test_id, collection_type, address, booking_date, time_slot, status, price, reminded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, 0, ?, ?)`,
    [req.user.patientId, test.id, type, address, dateStr, slot, test.price, now, now]
  );
  if (type === 'home') await db.run('UPDATE patients SET address = COALESCE(address, ?) WHERE id = ?', [address, req.user.patientId]);
  await notify(req.user.id, 'Test booked', `${test.name} on ${dateStr}, ${slot} (${type === 'home' ? 'home collection' : 'lab visit'}).`, '#/lab');
  await notifyRole('lab', 'New test booking', `${test.name} for ${req.user.name} on ${dateStr}, ${slot}.`, '#/queue');
  res.status(201).json(await loadBooking(r.insertId, req.user));
});

router.get('/bookings', async (req, res) => {
  const where = [];
  const params = [];
  if (req.user.role === 'patient') (where.push('b.patient_id = ?'), params.push(req.user.patientId));
  else if (!['lab', 'admin'].includes(req.user.role)) U.fail(403, 'You do not have access to lab bookings');
  if (req.query.status) (where.push('b.status = ?'), params.push(String(req.query.status)));
  if (req.query.date) (where.push('b.booking_date = ?'), params.push(U.date(req.query.date, 'Date')));
  res.json(await db.all(`${BOOKING_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.booking_date DESC, b.id DESC LIMIT 300`, params));
});

router.get('/bookings/:id', async (req, res) => {
  const b = await loadBooking(req.params.id, req.user);
  const test = tidyTest(await db.get('SELECT * FROM lab_tests WHERE id = ?', [b.test_id]));
  b.parameters = test.parameters;
  const rep = await db.get(
    'SELECT r.*, u.name AS technician_name FROM test_reports r LEFT JOIN users u ON u.id = r.technician_id WHERE r.booking_id = ?',
    [b.id]
  );
  b.report = rep && { ...rep, results: U.parseJson(rep.results, []) };
  res.json(b);
});

router.patch('/bookings/:id/cancel', allow('patient', 'admin'), async (req, res) => {
  const b = await loadBooking(req.params.id, req.user);
  if (b.status !== 'booked') U.fail(400, 'Only bookings that are not yet collected can be cancelled');
  await db.run("UPDATE test_bookings SET status = 'cancelled', updated_at = ? WHERE id = ?", [U.nowIso(), b.id]);
  res.json(await loadBooking(b.id, req.user));
});

router.patch('/bookings/:id/status', allow('lab', 'admin'), async (req, res) => {
  const b = await loadBooking(req.params.id, req.user);
  const next = U.oneOf(req.body.status, 'Status', ['sample_collected', 'processing']);
  const from = STATUS_FLOW.indexOf(b.status);
  if (from < 0 || STATUS_FLOW.indexOf(next) !== from + 1) U.fail(400, `Can't move a "${b.status.replace('_', ' ')}" booking to "${next.replace('_', ' ')}"`);
  await db.run('UPDATE test_bookings SET status = ?, updated_at = ? WHERE id = ?', [next, U.nowIso(), b.id]);
  const label = next === 'sample_collected' ? 'Sample collected' : 'Sample being processed';
  await notify(b.patient_user_id, `${b.test_name}: ${label.toLowerCase()}`, 'We will notify you when your report is ready.', '#/lab');
  res.json(await loadBooking(b.id, req.user));
});

// Flag each value against its reference range.
function flagResult(param, rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) U.fail(400, `Enter a value for ${param.name}`);
  if (param.ref_text) {
    return { ...param, value, flag: value.toLowerCase() === param.ref_text.toLowerCase() ? 'normal' : 'abnormal' };
  }
  const n = Number(value);
  if (Number.isNaN(n)) U.fail(400, `${param.name} must be a number`);
  let flag = 'normal';
  if (param.low !== null && param.low !== undefined && n < param.low) flag = 'low';
  if (param.high !== null && param.high !== undefined && n > param.high) flag = 'high';
  return { ...param, value: n, flag };
}

router.post('/bookings/:id/report', allow('lab'), async (req, res) => {
  const b = await loadBooking(req.params.id, req.user);
  if (!['sample_collected', 'processing'].includes(b.status)) U.fail(400, 'Collect the sample before adding a report');
  const test = tidyTest(await db.get('SELECT * FROM lab_tests WHERE id = ?', [b.test_id]));
  const values = req.body.values || {};
  const results = test.parameters.map((p) => flagResult(p, values[p.name]));
  const abnormal = results.filter((r) => r.flag !== 'normal');
  const summary =
    U.str(req.body.summary, 'Summary', { required: false, max: 1000 }) ||
    (abnormal.length ? `${abnormal.length} value(s) outside the reference range: ${abnormal.map((r) => r.name).join(', ')}. Please discuss with your doctor.` : 'All values are within the reference range.');
  await db.tx(async (t) => {
    await t.run('INSERT INTO test_reports (booking_id, results, summary, technician_id, created_at) VALUES (?, ?, ?, ?, ?)', [
      b.id, JSON.stringify(results), summary, req.user.id, U.nowIso(),
    ]);
    await t.run("UPDATE test_bookings SET status = 'report_ready', updated_at = ? WHERE id = ?", [U.nowIso(), b.id]);
  });
  await notify(b.patient_user_id, `Report ready: ${b.test_name}`, abnormal.length ? 'Some values need attention — open the report.' : 'All values are in the normal range.', '#/records');
  res.status(201).json(await loadBooking(b.id, req.user));
});

module.exports = router;
module.exports.TIME_SLOTS = TIME_SLOTS;
