const express = require('express');
const db = require('../db');
const { authenticate, allow } = require('../middleware/auth');
const { notify, slotsFor } = require('../services');
const engine = require('../ai/engine');
const U = require('../utils');

// =====================================================================
// Doctors directory  (/api/doctors)
// =====================================================================
const doctors = express.Router();
doctors.use(authenticate);

const DOCTOR_SELECT = `
  SELECT d.id, u.name, u.email, u.phone, d.department_id, dep.name AS department, d.specialization, d.qualification,
         d.experience_years, d.fee, d.bio, d.work_days, d.start_time, d.end_time, d.slot_minutes, d.room, d.active,
         (SELECT AVG(f.rating) FROM feedback f WHERE f.doctor_id = d.id) AS rating,
         (SELECT COUNT(*) FROM feedback f WHERE f.doctor_id = d.id) AS reviews
    FROM doctors d JOIN users u ON u.id = d.user_id JOIN departments dep ON dep.id = d.department_id`;
const tidyDoctor = (d) => d && { ...d, rating: d.rating === null ? null : Math.round(Number(d.rating) * 10) / 10, reviews: Number(d.reviews) };

doctors.get('/departments', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT dep.id, dep.name, dep.description,
              (SELECT COUNT(*) FROM doctors d WHERE d.department_id = dep.id AND d.active = 1) AS doctor_count
         FROM departments dep ORDER BY dep.name`
    )
  );
});

doctors.get('/', async (req, res) => {
  // Admins can pass ?all=1 to include deactivated doctors.
  const where = req.user.role === 'admin' && req.query.all ? [] : ['d.active = 1', 'u.active = 1'];
  const params = [];
  if (req.query.department_id) {
    where.push('d.department_id = ?');
    params.push(Number(req.query.department_id));
  }
  if (req.query.q) {
    where.push('(u.name LIKE ? OR d.specialization LIKE ? OR dep.name LIKE ?)');
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    params.push(q, q, q);
  }
  const rows = await db.all(`${DOCTOR_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY dep.name, d.experience_years DESC`, params);
  res.json(rows.map(tidyDoctor));
});

doctors.get('/:id', async (req, res) => {
  const d = tidyDoctor(await db.get(`${DOCTOR_SELECT} WHERE d.id = ?`, [Number(req.params.id)]));
  if (!d) U.fail(404, 'Doctor not found');
  d.recent_feedback = await db.all(
    `SELECT f.rating, f.comments, f.created_at, u.name AS patient_name
       FROM feedback f JOIN patients p ON p.id = f.patient_id JOIN users u ON u.id = p.user_id
      WHERE f.doctor_id = ? ORDER BY f.id DESC LIMIT 5`,
    [d.id]
  );
  res.json(d);
});

doctors.get('/:id/slots', async (req, res) => {
  const dateStr = U.date(req.query.date, 'Date');
  const doc = await db.get('SELECT * FROM doctors WHERE id = ? AND active = 1', [Number(req.params.id)]);
  if (!doc) U.fail(404, 'Doctor not found');
  res.json({ date: dateStr, slots: await slotsFor(doc, dateStr, { excludeAppointmentId: Number(req.query.exclude || 0) }) });
});

// Doctor edits their own availability
doctors.patch('/me/availability', allow('doctor'), async (req, res) => {
  const b = req.body || {};
  const days = String(b.work_days || '')
    .split(',')
    .filter((x) => /^[0-6]$/.test(x));
  if (!days.length) U.fail(400, 'Pick at least one working day');
  const start = U.time(b.start_time, 'Start time');
  const end = U.time(b.end_time, 'End time');
  if (end <= start) U.fail(400, 'End time must be after start time');
  const slot = U.int(b.slot_minutes, 'Slot length', { min: 10, max: 60 });
  await db.run('UPDATE doctors SET work_days = ?, start_time = ?, end_time = ?, slot_minutes = ?, bio = ?, room = ? WHERE id = ?', [
    [...new Set(days)].sort().join(','), start, end, slot,
    U.str(b.bio, 'Bio', { required: false, max: 500 }), U.str(b.room, 'Room', { required: false, max: 40 }), req.user.doctorId,
  ]);
  res.json(tidyDoctor(await db.get(`${DOCTOR_SELECT} WHERE d.id = ?`, [req.user.doctorId])));
});

// =====================================================================
// Appointments  (/api/appointments)
// =====================================================================
const appts = express.Router();
appts.use(authenticate);

const APPT_SELECT = `
  SELECT a.*, pu.name AS patient_name, pu.phone AS patient_phone, pu.id AS patient_user_id, p.dob AS patient_dob,
         p.gender AS patient_gender, p.blood_group AS patient_blood_group,
         du.name AS doctor_name, du.id AS doctor_user_id, d.specialization, d.room, dep.name AS department,
         pr.id AS prescription_id, f.rating AS feedback_rating
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id JOIN users pu ON pu.id = p.user_id
    JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
    JOIN departments dep ON dep.id = d.department_id
    LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
    LEFT JOIN feedback f ON f.appointment_id = a.id`;

async function loadAppointment(id, user) {
  const a = await db.get(`${APPT_SELECT} WHERE a.id = ?`, [Number(id)]);
  if (!a) U.fail(404, 'Appointment not found');
  const mine =
    user.role === 'admin' || (user.role === 'patient' && a.patient_id === user.patientId) || (user.role === 'doctor' && a.doctor_id === user.doctorId);
  if (!mine) U.fail(404, 'Appointment not found');
  return a;
}

async function checkSlot(conn, doctorId, dateStr, time, excludeId = 0) {
  const doc = await conn.get('SELECT * FROM doctors WHERE id = ? AND active = 1', [doctorId]);
  if (!doc) U.fail(404, 'Doctor not found');
  if (dateStr < U.today()) U.fail(400, 'Pick today or a future date');
  if (dateStr > U.addDays(U.today(), 30)) U.fail(400, 'Appointments can be booked up to 30 days ahead');
  const slot = (await slotsFor(doc, dateStr, { excludeAppointmentId: excludeId, conn })).find((s) => s.time === time);
  if (!slot) U.fail(400, 'The doctor is not available at that time');
  if (!slot.available) U.fail(409, 'That slot was just taken. Please pick another time.');
  return doc;
}

appts.post('/', allow('patient'), async (req, res) => {
  const b = req.body || {};
  const doctorId = U.int(b.doctor_id, 'Doctor', { min: 1 });
  const dateStr = U.date(b.appt_date, 'Date');
  const time = U.time(b.slot_time, 'Time');
  const reason = U.str(b.reason, 'Reason', { required: false, max: 500 });
  let consultId = U.int(b.consult_id, 'Consult', { min: 1, required: false });
  if (consultId && !(await db.get('SELECT id FROM ai_consult_logs WHERE id = ? AND patient_id = ?', [consultId, req.user.patientId]))) consultId = null;

  const id = await db.tx(async (t) => {
    const doc = await checkSlot(t, doctorId, dateStr, time);
    const clash = await t.get("SELECT id FROM appointments WHERE patient_id = ? AND appt_date = ? AND slot_time = ? AND status = 'booked'", [
      req.user.patientId, dateStr, time,
    ]);
    if (clash) U.fail(409, 'You already have another appointment at this time');
    const now = U.nowIso();
    const r = await t.run(
      `INSERT INTO appointments (patient_id, doctor_id, consult_id, appt_date, slot_time, reason, status, fee, reminded, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, 0, ?, ?)`,
      [req.user.patientId, doctorId, consultId, dateStr, time, reason, doc.fee, now, now]
    );
    return r.insertId;
  });
  const a = await loadAppointment(id, req.user);
  await notify(req.user.id, 'Appointment booked', `${a.doctor_name} on ${a.appt_date} at ${a.slot_time}.`, '#/appointments');
  await notify(a.doctor_user_id, 'New appointment', `${a.patient_name} on ${a.appt_date} at ${a.slot_time}.`, '#/schedule');
  res.status(201).json(a);
});

appts.get('/', async (req, res) => {
  const where = [];
  const params = [];
  if (req.user.role === 'patient') (where.push('a.patient_id = ?'), params.push(req.user.patientId));
  else if (req.user.role === 'doctor') (where.push('a.doctor_id = ?'), params.push(req.user.doctorId));
  else if (req.user.role !== 'admin') U.fail(403, 'You do not have access to appointments');
  if (req.query.date) (where.push('a.appt_date = ?'), params.push(U.date(req.query.date, 'Date')));
  if (req.query.status) (where.push('a.status = ?'), params.push(String(req.query.status)));
  const sql = `${APPT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.appt_date DESC, a.slot_time DESC LIMIT 300`;
  res.json(await db.all(sql, params));
});

appts.get('/:id', async (req, res) => {
  const a = await loadAppointment(req.params.id, req.user);
  const pr = await db.get('SELECT * FROM prescriptions WHERE appointment_id = ?', [a.id]);
  a.prescription = pr && { ...pr, medicines: U.parseJson(pr.medicines, []) };
  a.feedback = await db.get('SELECT rating, comments, created_at FROM feedback WHERE appointment_id = ?', [a.id]);
  if (a.consult_id) {
    const c = await db.get('SELECT * FROM ai_consult_logs WHERE id = ?', [a.consult_id]);
    const names = Object.fromEntries(engine.symptomList().map((s) => [s.code, s.name]));
    a.consult = c && {
      symptoms_text: c.symptoms_text,
      matched: U.parseJson(c.matched_symptoms, []).map((x) => names[x] || x),
      conditions: U.parseJson(c.conditions, []),
      urgency: c.urgency, duration_days: c.duration_days, severity: c.severity, created_at: c.created_at,
    };
  }
  if (req.user.role !== 'patient') {
    a.history = await db.all(
      `SELECT a2.id, a2.appt_date, pr.diagnosis FROM appointments a2 JOIN prescriptions pr ON pr.appointment_id = a2.id
        WHERE a2.patient_id = ? AND a2.id <> ? ORDER BY a2.appt_date DESC LIMIT 5`,
      [a.patient_id, a.id]
    );
  }
  res.json(a);
});

appts.patch('/:id/reschedule', allow('patient'), async (req, res) => {
  const a = await loadAppointment(req.params.id, req.user);
  if (a.status !== 'booked') U.fail(400, 'Only upcoming appointments can be rescheduled');
  const dateStr = U.date(req.body.appt_date, 'Date');
  const time = U.time(req.body.slot_time, 'Time');
  await db.tx(async (t) => {
    await checkSlot(t, a.doctor_id, dateStr, time, a.id);
    await t.run('UPDATE appointments SET appt_date = ?, slot_time = ?, reminded = 0, updated_at = ? WHERE id = ?', [dateStr, time, U.nowIso(), a.id]);
  });
  await notify(a.doctor_user_id, 'Appointment rescheduled', `${a.patient_name} moved to ${dateStr} at ${time}.`, '#/schedule');
  res.json(await loadAppointment(a.id, req.user));
});

appts.patch('/:id/cancel', allow('patient', 'doctor', 'admin'), async (req, res) => {
  const a = await loadAppointment(req.params.id, req.user);
  if (a.status !== 'booked') U.fail(400, 'Only upcoming appointments can be cancelled');
  await db.run("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?", [U.nowIso(), a.id]);
  const by = req.user.role === 'patient' ? a.patient_name : req.user.role === 'doctor' ? a.doctor_name : 'the hospital';
  const msg = `${a.appt_date} at ${a.slot_time} was cancelled by ${by}.`;
  if (req.user.role !== 'patient') await notify(a.patient_user_id, 'Appointment cancelled', `${msg} Please book another slot.`, '#/appointments');
  if (req.user.role !== 'doctor') await notify(a.doctor_user_id, 'Appointment cancelled', `${a.patient_name}: ${msg}`, '#/schedule');
  res.json(await loadAppointment(a.id, req.user));
});

appts.patch('/:id/no-show', allow('doctor'), async (req, res) => {
  const a = await loadAppointment(req.params.id, req.user);
  if (a.status !== 'booked') U.fail(400, 'Only booked appointments can be marked as no-show');
  if (a.appt_date > U.today()) U.fail(400, 'You can mark a no-show only on or after the appointment date');
  await db.run("UPDATE appointments SET status = 'no_show', updated_at = ? WHERE id = ?", [U.nowIso(), a.id]);
  res.json(await loadAppointment(a.id, req.user));
});

// Doctor completes the visit and writes the prescription in one step.
appts.post('/:id/prescription', allow('doctor'), async (req, res) => {
  const a = await loadAppointment(req.params.id, req.user);
  if (a.status !== 'booked') U.fail(400, 'This appointment is already closed');
  if (a.appt_date > U.today()) U.fail(400, 'You can complete an appointment only on or after its date');
  const b = req.body || {};
  const diagnosis = U.str(b.diagnosis, 'Diagnosis', { max: 255 });
  const medicines = (Array.isArray(b.medicines) ? b.medicines : [])
    .filter((m) => m && String(m.name || '').trim())
    .slice(0, 15)
    .map((m) => ({
      name: U.str(m.name, 'Medicine name', { max: 80 }),
      dosage: U.str(m.dosage, 'Dosage', { required: false, max: 40 }) || '',
      frequency: U.str(m.frequency, 'Frequency', { required: false, max: 40 }) || '',
      duration: U.str(m.duration, 'Duration', { required: false, max: 40 }) || '',
    }));
  const advice = U.str(b.advice, 'Advice', { required: false, max: 1000 });
  const followUp = U.date(b.follow_up_date, 'Follow-up date', { required: false });
  await db.tx(async (t) => {
    await t.run('INSERT INTO prescriptions (appointment_id, diagnosis, medicines, advice, follow_up_date, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      a.id, diagnosis, JSON.stringify(medicines), advice, followUp, U.nowIso(),
    ]);
    await t.run("UPDATE appointments SET status = 'completed', updated_at = ? WHERE id = ?", [U.nowIso(), a.id]);
  });
  await notify(a.patient_user_id, 'Prescription ready', `${a.doctor_name} added your prescription. You can download it anytime.`, '#/records');
  res.status(201).json(await loadAppointment(a.id, req.user));
});

appts.post('/:id/feedback', allow('patient'), async (req, res) => {
  const a = await loadAppointment(req.params.id, req.user);
  if (a.status !== 'completed') U.fail(400, 'You can rate a visit after it is completed');
  if (a.feedback_rating) U.fail(409, 'You have already rated this visit');
  const rating = U.int(req.body.rating, 'Rating', { min: 1, max: 5 });
  await db.run('INSERT INTO feedback (appointment_id, patient_id, doctor_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    a.id, a.patient_id, a.doctor_id, rating, U.str(req.body.comments, 'Comments', { required: false, max: 1000 }), U.nowIso(),
  ]);
  res.status(201).json({ ok: true });
});

module.exports = { doctors, appts };
