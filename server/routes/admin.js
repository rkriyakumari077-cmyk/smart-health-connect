const express = require('express');
const db = require('../db');
const { authenticate, allow } = require('../middleware/auth');
const engine = require('../ai/engine');
const U = require('../utils');

// =====================================================================
// Admin  (/api/admin)
// =====================================================================
const admin = express.Router();
admin.use(authenticate, allow('admin'));

const count = async (sql, params = []) => Number((await db.get(sql, params)).n);

admin.get('/stats', async (_req, res) => {
  const today = U.today();
  res.json({
    patients: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'patient'"),
    doctors: await count('SELECT COUNT(*) AS n FROM doctors WHERE active = 1'),
    appointments_today: await count("SELECT COUNT(*) AS n FROM appointments WHERE appt_date = ? AND status <> 'cancelled'", [today]),
    appointments_upcoming: await count("SELECT COUNT(*) AS n FROM appointments WHERE appt_date >= ? AND status = 'booked'", [today]),
    lab_pending: await count("SELECT COUNT(*) AS n FROM test_bookings WHERE status IN ('booked','sample_collected','processing')"),
    reports_ready: await count("SELECT COUNT(*) AS n FROM test_bookings WHERE status = 'report_ready'"),
    blood_units: await count('SELECT COALESCE(SUM(units), 0) AS n FROM blood_bank'),
    low_stock_groups: (await db.all('SELECT blood_group FROM blood_bank WHERE units < 5')).map((r) => r.blood_group),
    requests_pending: await count("SELECT COUNT(*) AS n FROM blood_requests WHERE status IN ('pending','approved')"),
    donors_unverified: await count('SELECT COUNT(*) AS n FROM donors WHERE verified = 0'),
    ai_consults_7d: await count('SELECT COUNT(*) AS n FROM ai_consult_logs WHERE created_at >= ?', [new Date(Date.now() - 7 * 86400000).toISOString()]),
    avg_rating: Number((await db.get('SELECT AVG(rating) AS n FROM feedback')).n || 0).toFixed(1),
    urgency_breakdown: await db.all('SELECT urgency, COUNT(*) AS n FROM ai_consult_logs GROUP BY urgency'),
  });
});

// ---------- Departments ----------
admin.post('/departments', async (req, res) => {
  const name = U.str(req.body.name, 'Department name', { max: 80 });
  if (await db.get('SELECT id FROM departments WHERE name = ?', [name])) U.fail(409, 'That department already exists');
  const r = await db.run('INSERT INTO departments (name, description) VALUES (?, ?)', [name, U.str(req.body.description, 'Description', { required: false })]);
  res.status(201).json({ id: r.insertId, name });
});
admin.patch('/departments/:id', async (req, res) => {
  await db.run('UPDATE departments SET name = ?, description = ? WHERE id = ?', [
    U.str(req.body.name, 'Department name', { max: 80 }), U.str(req.body.description, 'Description', { required: false }), Number(req.params.id),
  ]);
  res.json({ ok: true });
});

// ---------- Doctors ----------
function doctorFields(b) {
  const days = String(b.work_days || '1,2,3,4,5,6').split(',').filter((x) => /^[0-6]$/.test(x));
  if (!days.length) U.fail(400, 'Pick at least one working day');
  const start = U.time(b.start_time || '10:00', 'Start time');
  const end = U.time(b.end_time || '16:00', 'End time');
  if (end <= start) U.fail(400, 'End time must be after start time');
  return {
    department_id: U.int(b.department_id, 'Department', { min: 1 }),
    specialization: U.str(b.specialization, 'Specialization', { max: 120 }),
    qualification: U.str(b.qualification, 'Qualification', { required: false, max: 120 }),
    experience_years: U.int(b.experience_years ?? 0, 'Experience', { min: 0, max: 60 }),
    fee: U.int(b.fee ?? 500, 'Fee', { min: 0, max: 100000 }),
    bio: U.str(b.bio, 'Bio', { required: false, max: 500 }),
    work_days: [...new Set(days)].sort().join(','),
    start_time: start,
    end_time: end,
    slot_minutes: U.int(b.slot_minutes ?? 20, 'Slot length', { min: 10, max: 60 }),
    room: U.str(b.room, 'Room', { required: false, max: 40 }),
  };
}

admin.post('/doctors', async (req, res) => {
  const b = req.body || {};
  const name = U.str(b.name, 'Name', { max: 120 });
  const email = U.email(b.email);
  const password = U.str(b.password, 'Temporary password', { max: 100 });
  if (password.length < 6) U.fail(400, 'Temporary password must be at least 6 characters');
  const f = doctorFields(b);
  if (!(await db.get('SELECT id FROM departments WHERE id = ?', [f.department_id]))) U.fail(400, 'Choose a valid department');
  if (await db.get('SELECT id FROM users WHERE email = ?', [email])) U.fail(409, 'An account with this email already exists');
  const hash = await U.hashPassword(password);
  const id = await db.tx(async (t) => {
    const u = await t.run("INSERT INTO users (role, name, email, phone, password_hash, active, created_at) VALUES ('doctor', ?, ?, ?, ?, 1, ?)", [
      name, email, U.phone(b.phone, 'Phone', { required: false }), hash, U.nowIso(),
    ]);
    const d = await t.run(
      `INSERT INTO doctors (user_id, department_id, specialization, qualification, experience_years, fee, bio, work_days, start_time, end_time, slot_minutes, room, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [u.insertId, f.department_id, f.specialization, f.qualification, f.experience_years, f.fee, f.bio, f.work_days, f.start_time, f.end_time, f.slot_minutes, f.room]
    );
    return d.insertId;
  });
  res.status(201).json({ id });
});

admin.patch('/doctors/:id', async (req, res) => {
  const doc = await db.get('SELECT * FROM doctors WHERE id = ?', [Number(req.params.id)]);
  if (!doc) U.fail(404, 'Doctor not found');
  const b = req.body || {};
  if (b.active !== undefined && Object.keys(b).length === 1) {
    await db.run('UPDATE doctors SET active = ? WHERE id = ?', [b.active ? 1 : 0, doc.id]);
    return res.json({ ok: true });
  }
  const f = doctorFields(b);
  await db.run(
    `UPDATE doctors SET department_id = ?, specialization = ?, qualification = ?, experience_years = ?, fee = ?, bio = ?,
            work_days = ?, start_time = ?, end_time = ?, slot_minutes = ?, room = ? WHERE id = ?`,
    [f.department_id, f.specialization, f.qualification, f.experience_years, f.fee, f.bio, f.work_days, f.start_time, f.end_time, f.slot_minutes, f.room, doc.id]
  );
  await db.run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [U.str(b.name, 'Name', { max: 120 }), U.phone(b.phone, 'Phone', { required: false }), doc.user_id]);
  res.json({ ok: true });
});

// ---------- Lab tests ----------
function testFields(b) {
  const params = (Array.isArray(b.parameters) ? b.parameters : []).filter((p) => p && String(p.name || '').trim());
  if (!params.length) U.fail(400, 'Add at least one result parameter');
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    name: U.str(b.name, 'Test name', { max: 120 }),
    category: U.str(b.category, 'Category', { max: 60 }),
    description: U.str(b.description, 'Description', { required: false, max: 500 }),
    sample_type: U.str(b.sample_type || 'Blood', 'Sample type', { max: 40 }),
    price: U.int(b.price, 'Price', { min: 0, max: 100000 }),
    turnaround_hours: U.int(b.turnaround_hours ?? 24, 'Turnaround', { min: 1, max: 720 }),
    home_collection: b.home_collection ? 1 : 0,
    preparation: U.str(b.preparation, 'Preparation', { required: false, max: 255 }),
    parameters: JSON.stringify(
      params.map((p) =>
        p.ref_text
          ? { name: String(p.name).trim(), unit: String(p.unit || '').trim(), ref_text: String(p.ref_text).trim() }
          : { name: String(p.name).trim(), unit: String(p.unit || '').trim(), low: num(p.low), high: num(p.high) }
      )
    ),
  };
}
admin.post('/tests', async (req, res) => {
  const f = testFields(req.body || {});
  if (await db.get('SELECT id FROM lab_tests WHERE name = ?', [f.name])) U.fail(409, 'A test with this name already exists');
  const r = await db.run(
    `INSERT INTO lab_tests (name, category, description, sample_type, price, turnaround_hours, home_collection, preparation, parameters, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [f.name, f.category, f.description, f.sample_type, f.price, f.turnaround_hours, f.home_collection, f.preparation, f.parameters]
  );
  res.status(201).json({ id: r.insertId });
});
admin.patch('/tests/:id', async (req, res) => {
  const b = req.body || {};
  if (b.active !== undefined && Object.keys(b).length === 1) {
    await db.run('UPDATE lab_tests SET active = ? WHERE id = ?', [b.active ? 1 : 0, Number(req.params.id)]);
    return res.json({ ok: true });
  }
  const f = testFields(b);
  await db.run(
    `UPDATE lab_tests SET name = ?, category = ?, description = ?, sample_type = ?, price = ?, turnaround_hours = ?,
            home_collection = ?, preparation = ?, parameters = ? WHERE id = ?`,
    [f.name, f.category, f.description, f.sample_type, f.price, f.turnaround_hours, f.home_collection, f.preparation, f.parameters, Number(req.params.id)]
  );
  res.json({ ok: true });
});

// ---------- Staff accounts (lab technicians, admins) & patients ----------
admin.get('/users', async (req, res) => {
  const role = req.query.role ? U.oneOf(req.query.role, 'Role', ['patient', 'lab', 'admin', 'doctor']) : null;
  res.json(
    await db.all(
      `SELECT u.id, u.role, u.name, u.email, u.phone, u.active, u.created_at, p.city, p.blood_group
         FROM users u LEFT JOIN patients p ON p.user_id = u.id ${role ? 'WHERE u.role = ?' : ''} ORDER BY u.id DESC LIMIT 300`,
      role ? [role] : []
    )
  );
});
admin.post('/staff', async (req, res) => {
  const b = req.body || {};
  const role = U.oneOf(b.role, 'Role', ['lab', 'admin']);
  const email = U.email(b.email);
  const password = U.str(b.password, 'Temporary password', { max: 100 });
  if (password.length < 6) U.fail(400, 'Temporary password must be at least 6 characters');
  if (await db.get('SELECT id FROM users WHERE email = ?', [email])) U.fail(409, 'An account with this email already exists');
  const r = await db.run('INSERT INTO users (role, name, email, phone, password_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [
    role, U.str(b.name, 'Name', { max: 120 }), email, U.phone(b.phone, 'Phone', { required: false }), await U.hashPassword(password), U.nowIso(),
  ]);
  res.status(201).json({ id: r.insertId });
});
admin.patch('/users/:id/active', async (req, res) => {
  if (Number(req.params.id) === req.user.id) U.fail(400, "You can't deactivate your own account");
  await db.run('UPDATE users SET active = ? WHERE id = ?', [req.body.active ? 1 : 0, Number(req.params.id)]);
  res.json({ ok: true });
});

// ---------- Feedback & AI logs ----------
admin.get('/feedback', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT f.*, pu.name AS patient_name, du.name AS doctor_name, a.appt_date
         FROM feedback f JOIN appointments a ON a.id = f.appointment_id
         JOIN patients p ON p.id = f.patient_id JOIN users pu ON pu.id = p.user_id
         JOIN doctors d ON d.id = f.doctor_id JOIN users du ON du.id = d.user_id
        ORDER BY f.id DESC LIMIT 200`
    )
  );
});
admin.get('/ai-logs', async (_req, res) => {
  const names = Object.fromEntries(engine.symptomList().map((s) => [s.code, s.name]));
  const rows = await db.all(
    `SELECT l.*, u.name AS patient_name, d.name AS department
       FROM ai_consult_logs l JOIN patients p ON p.id = l.patient_id JOIN users u ON u.id = p.user_id
       LEFT JOIN departments d ON d.id = l.department_id ORDER BY l.id DESC LIMIT 200`
  );
  res.json(rows.map((r) => ({ ...r, matched: U.parseJson(r.matched_symptoms, []).map((c) => names[c] || c), conditions: U.parseJson(r.conditions, []) })));
});
admin.get('/knowledge', async (_req, res) => {
  res.json({
    symptoms: await db.all('SELECT * FROM symptoms ORDER BY body_system, name'),
    medicines: await db.all('SELECT * FROM medicine_suggestions ORDER BY id'),
  });
});

// =====================================================================
// Health records (/api/records) — everything for one patient in one place
// =====================================================================
const records = express.Router();
records.use(authenticate, allow('patient'));

records.get('/', async (req, res) => {
  const pid = req.user.patientId;
  const prescriptions = await db.all(
    `SELECT pr.*, a.appt_date, a.slot_time, du.name AS doctor_name, d.specialization, dep.name AS department
       FROM prescriptions pr JOIN appointments a ON a.id = pr.appointment_id
       JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id JOIN departments dep ON dep.id = d.department_id
      WHERE a.patient_id = ? ORDER BY a.appt_date DESC`,
    [pid]
  );
  const reports = await db.all(
    `SELECT r.*, b.booking_date, b.collection_type, t.name AS test_name, t.category, u.name AS technician_name
       FROM test_reports r JOIN test_bookings b ON b.id = r.booking_id JOIN lab_tests t ON t.id = b.test_id
       LEFT JOIN users u ON u.id = r.technician_id
      WHERE b.patient_id = ? ORDER BY r.id DESC`,
    [pid]
  );
  res.json({
    prescriptions: prescriptions.map((p) => ({ ...p, medicines: U.parseJson(p.medicines, []) })),
    reports: reports.map((r) => ({ ...r, results: U.parseJson(r.results, []) })),
  });
});

module.exports = { admin, records };
