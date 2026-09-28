const db = require('../db');
const { nowIso, today, addDays, nowTime } = require('../utils');

// ---------- Notifications ----------
async function notify(userId, title, body = '', link = '', conn = db) {
  if (!userId) return;
  await conn.run(
    'INSERT INTO notifications (user_id, title, body, link, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    [userId, title, body, link, nowIso()]
  );
}
async function notifyRole(role, title, body = '', link = '', conn = db) {
  const users = await conn.all('SELECT id FROM users WHERE role = ? AND active = 1', [role]);
  for (const u of users) await notify(u.id, title, body, link, conn);
}

// ---------- Doctor slots ----------
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// All slot start times a doctor works on a given date (ignores bookings).
function workingSlots(doctor, dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  const days = String(doctor.work_days || '').split(',').filter(Boolean).map(Number);
  if (!days.includes(dow)) return [];
  const step = Number(doctor.slot_minutes) || 20;
  const out = [];
  for (let t = toMin(doctor.start_time); t + step <= toMin(doctor.end_time); t += step) out.push(toTime(t));
  return out;
}

// Slots with availability: taken by another active appointment, or already past.
async function slotsFor(doctor, dateStr, { excludeAppointmentId = 0, conn = db } = {}) {
  const all = workingSlots(doctor, dateStr);
  if (!all.length) return [];
  const taken = await conn.all(
    "SELECT slot_time FROM appointments WHERE doctor_id = ? AND appt_date = ? AND status IN ('booked','completed') AND id <> ?",
    [doctor.id, dateStr, excludeAppointmentId]
  );
  const takenSet = new Set(taken.map((r) => r.slot_time));
  const isToday = dateStr === today();
  const now = nowTime();
  return all.map((time) => ({ time, available: !takenSet.has(time) && !(isToday && time <= now) }));
}

// ---------- Automatic reminders (in-app) ----------
// Runs every few minutes. Sends one reminder for each appointment / test
// booking happening today or tomorrow, then marks it as reminded.
async function sendReminders() {
  const days = [today(), addDays(today(), 1)];
  const appts = await db.all(
    `SELECT a.id, a.appt_date, a.slot_time, u.id AS user_id, du.name AS doctor_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = p.user_id
       JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
      WHERE a.status = 'booked' AND a.reminded = 0 AND a.appt_date IN (?, ?)`,
    days
  );
  for (const a of appts) {
    const when = a.appt_date === days[0] ? 'today' : 'tomorrow';
    await notify(a.user_id, `Reminder: appointment ${when} at ${a.slot_time}`, `With ${a.doctor_name}. Please arrive 10 minutes early.`, '#/appointments');
    await db.run('UPDATE appointments SET reminded = 1 WHERE id = ?', [a.id]);
  }
  const tests = await db.all(
    `SELECT b.id, b.booking_date, b.time_slot, b.collection_type, t.name AS test_name, u.id AS user_id
       FROM test_bookings b
       JOIN lab_tests t ON t.id = b.test_id
       JOIN patients p ON p.id = b.patient_id JOIN users u ON u.id = p.user_id
      WHERE b.status = 'booked' AND b.reminded = 0 AND b.booking_date IN (?, ?)`,
    days
  );
  for (const b of tests) {
    const when = b.booking_date === days[0] ? 'today' : 'tomorrow';
    const where = b.collection_type === 'home' ? 'Sample collection at your address' : 'Visit the lab';
    await notify(b.user_id, `Reminder: ${b.test_name} ${when}`, `${where}, ${b.time_slot}. Check the preparation notes before your test.`, '#/lab');
    await db.run('UPDATE test_bookings SET reminded = 1 WHERE id = ?', [b.id]);
  }
  return appts.length + tests.length;
}

module.exports = { notify, notifyRole, workingSlots, slotsFor, sendReminders };
