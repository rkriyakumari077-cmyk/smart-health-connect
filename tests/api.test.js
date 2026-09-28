// End-to-end API tests. Run with: npm test
// Uses a fresh temporary SQLite database and a random port, so it never
// touches your real data in data/smart-health.db.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shc-test-'));
process.env.DB_CLIENT = process.env.TEST_DB_CLIENT || 'sqlite';
process.env.SQLITE_FILE = path.join(tmp, 'test.db');
process.env.SHC_SECRET = 'test-secret';
if (process.env.DB_CLIENT === 'mysql') process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'shc_test';

const db = require('../server/db');
const { seed, DEMO_PASSWORD } = require('../server/db/seed');
const { createApp } = require('../server');
const K = require('../server/ai/knowledge');
const U = require('../server/utils');

let server;
let base;

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const login = async (email, role) => {
  const r = await api('POST', '/api/auth/login', { body: { email, password: DEMO_PASSWORD, role } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.token;
};

let patient; // a brand-new patient created by the tests
let doctorTok, labTok, adminTok;

before(async () => {
  await db.init();
  await seed({ reset: true });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  doctorTok = await login('doctor@demo.in', 'doctor');
  labTok = await login('lab@demo.in', 'lab');
  adminTok = await login('admin@demo.in', 'admin');
});

after(async () => {
  server.close();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('knowledge base only points at departments and tests that exist', async () => {
  const depts = new Set((await db.all('SELECT name FROM departments')).map((r) => r.name));
  const tests = new Set((await db.all('SELECT name FROM lab_tests')).map((r) => r.name));
  for (const c of K.CONDITIONS) {
    assert.ok(depts.has(c.department), `${c.code} → missing department ${c.department}`);
    for (const t of c.tests || []) assert.ok(tests.has(t), `${c.code} → missing lab test ${t}`);
  }
  for (const r of K.RED_FLAGS) assert.ok(depts.has(r.department), `${r.code} → missing department`);
  for (const d of Object.values(K.SYSTEM_DEPARTMENT)) assert.ok(depts.has(d), `missing department ${d}`);
  assert.ok(depts.has('Paediatrics') && depts.has('Psychiatry'));
});

test('sign up, log in and role checks', async () => {
  const email = `test.${Date.now()}@example.com`;
  const r = await api('POST', '/api/auth/register', {
    body: { name: 'Test Patient', email, password: 'secret12', phone: '9876500000', dob: '2000-05-10', gender: 'female', blood_group: 'O+', city: 'Noida' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.user.role, 'patient');
  patient = { token: r.data.token, email };

  assert.equal((await api('POST', '/api/auth/register', { body: { name: 'X', email, password: 'secret12' } })).status, 409);
  assert.equal((await api('POST', '/api/auth/login', { body: { email, password: 'wrong-pass' } })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { body: { email, password: 'secret12', role: 'doctor' } })).status, 403);
  assert.equal((await api('GET', '/api/auth/me')).status, 401);
  assert.equal((await api('GET', '/api/admin/stats', { token: patient.token })).status, 403);
  assert.equal((await api('GET', '/api/auth/me', { token: patient.token })).data.blood_group, 'O+');
});

test('AI assistant: Hinglish input, red flags and crisis support', async () => {
  const fever = await api('POST', '/api/ai/consult', { token: patient.token, body: { text: 'bukhar aur sar dard 3 din se, badan dard bhi', age: 26, duration_days: 3 } });
  assert.equal(fever.status, 200);
  assert.ok(fever.data.recognised);
  assert.ok(fever.data.consultId);
  assert.ok(['doctor_soon', 'urgent'].includes(fever.data.urgency.level));
  assert.equal(fever.data.department.name, 'General Medicine');
  assert.ok(fever.data.doctors.length > 0);
  assert.ok(fever.data.tests.length > 0);
  patient.consultId = fever.data.consultId;

  const heart = await api('POST', '/api/ai/consult', { token: patient.token, body: { text: 'chest pain and sweating, feeling breathless', age: 58 } });
  assert.equal(heart.data.urgency.level, 'emergency');
  assert.equal(heart.data.department.name, 'Cardiology');

  const negated = await api('POST', '/api/ai/consult', { token: patient.token, body: { text: 'cough and runny nose, no fever' } });
  assert.ok(!negated.data.matched.some((m) => m.code === 'fever'));
  assert.ok(negated.data.negated.includes('Fever'));

  const child = await api('POST', '/api/ai/consult', { token: patient.token, body: { symptoms: ['fever', 'cough'], age: 6 } });
  assert.equal(child.data.department.name, 'Paediatrics');

  const crisis = await api('POST', '/api/ai/consult', { token: patient.token, body: { text: 'I want to kill myself' } });
  assert.equal(crisis.data.crisis, true);
  assert.match(crisis.data.urgency.message, /14416/);

  // Duration is read from the text when the "days" box is empty
  const days = await api('POST', '/api/ai/consult', { token: patient.token, body: { text: 'bukhar 4 din se aur badan dard' } });
  assert.equal(days.data.durationDays, 4);
  assert.equal(days.data.urgency.level, 'doctor_soon');
  const { extractDuration } = require('../server/ai/engine');
  assert.equal(extractDuration('khansi ek hafte se'), 7);
  assert.equal(extractDuration('vomiting three times a day'), null);

  const unknown = await api('POST', '/api/ai/consult', { token: patient.token, body: { text: 'hello there' } });
  assert.equal(unknown.data.recognised, false);

  assert.ok((await api('GET', '/api/ai/history', { token: patient.token })).data.length >= 4);
});

test('doctor appointment: book → reschedule → complete with prescription → feedback', async () => {
  const docs = await api('GET', '/api/doctors?q=Rohit', { token: patient.token });
  const rohit = docs.data[0];
  assert.equal(rohit.name, 'Dr. Rohit Malhotra');

  const day = U.addDays(U.today(), 1);
  const slots = (await api('GET', `/api/doctors/${rohit.id}/slots?date=${day}`, { token: patient.token })).data.slots;
  const free = slots.filter((s) => s.available);
  assert.ok(free.length > 2);

  const booked = await api('POST', '/api/appointments', {
    token: patient.token,
    body: { doctor_id: rohit.id, appt_date: day, slot_time: free[0].time, reason: 'Fever', consult_id: patient.consultId },
  });
  assert.equal(booked.status, 201, JSON.stringify(booked.data));
  const id = booked.data.id;

  // Same slot can't be booked twice
  const clash = await api('POST', '/api/appointments', { token: patient.token, body: { doctor_id: rohit.id, appt_date: day, slot_time: free[0].time } });
  assert.equal(clash.status, 409);

  const moved = await api('PATCH', `/api/appointments/${id}/reschedule`, { token: patient.token, body: { appt_date: day, slot_time: free[1].time } });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.slot_time, free[1].time);

  // Can't complete before the visit date
  const early = await api('POST', `/api/appointments/${id}/prescription`, { token: doctorTok, body: { diagnosis: 'Viral fever' } });
  assert.equal(early.status, 400);

  // Simulate the visit day arriving
  await db.run('UPDATE appointments SET appt_date = ? WHERE id = ?', [U.today(), id]);

  const detail = await api('GET', `/api/appointments/${id}`, { token: doctorTok });
  assert.ok(detail.data.consult, 'doctor sees the linked AI consult');

  const rx = await api('POST', `/api/appointments/${id}/prescription`, {
    token: doctorTok,
    body: {
      diagnosis: 'Viral fever',
      medicines: [{ name: 'Paracetamol 650 mg', dosage: '1 tablet', frequency: 'Three times a day', duration: '3 days' }, { name: '' }],
      advice: 'Rest and fluids',
    },
  });
  assert.equal(rx.status, 201, JSON.stringify(rx.data));
  assert.equal(rx.data.status, 'completed');

  assert.equal((await api('POST', `/api/appointments/${id}/feedback`, { token: patient.token, body: { rating: 5, comments: 'Very helpful' } })).status, 201);
  assert.equal((await api('POST', `/api/appointments/${id}/feedback`, { token: patient.token, body: { rating: 4 } })).status, 409);

  const recs = await api('GET', '/api/records', { token: patient.token });
  assert.equal(recs.data.prescriptions[0].medicines.length, 1);

  // Other patients can't see it
  const other = await login('patient@demo.in', 'patient');
  assert.equal((await api('GET', `/api/appointments/${id}`, { token: other })).status, 404);
});

test('cancel frees the slot again', async () => {
  const rohit = (await api('GET', '/api/doctors?q=Rohit', { token: patient.token })).data[0];
  const day = U.addDays(U.today(), 2);
  const time = (await api('GET', `/api/doctors/${rohit.id}/slots?date=${day}`, { token: patient.token })).data.slots.find((s) => s.available).time;
  const a = await api('POST', '/api/appointments', { token: patient.token, body: { doctor_id: rohit.id, appt_date: day, slot_time: time } });
  assert.equal((await api('PATCH', `/api/appointments/${a.data.id}/cancel`, { token: patient.token })).data.status, 'cancelled');
  const again = (await api('GET', `/api/doctors/${rohit.id}/slots?date=${day}`, { token: patient.token })).data.slots.find((s) => s.time === time);
  assert.equal(again.available, true);
});

test('lab test: book → collect → process → report with flags', async () => {
  const tests = (await api('GET', '/api/lab/tests', { token: patient.token })).data;
  const cbc = tests.find((t) => t.name === 'Complete Blood Count (CBC)');
  const slots = (await api('GET', '/api/lab/slots', { token: patient.token })).data;

  const noAddress = await api('POST', '/api/lab/bookings', {
    token: patient.token,
    body: { test_id: cbc.id, collection_type: 'home', booking_date: U.addDays(U.today(), 1), time_slot: slots[0] },
  });
  assert.equal(noAddress.status, 400);

  const b = await api('POST', '/api/lab/bookings', {
    token: patient.token,
    body: { test_id: cbc.id, collection_type: 'home', address: 'B-12, Sector 62, Noida', booking_date: U.addDays(U.today(), 1), time_slot: slots[0] },
  });
  assert.equal(b.status, 201, JSON.stringify(b.data));
  const id = b.data.id;

  assert.equal((await api('POST', `/api/lab/bookings/${id}/report`, { token: labTok, body: { values: {} } })).status, 400);
  assert.equal((await api('PATCH', `/api/lab/bookings/${id}/status`, { token: labTok, body: { status: 'processing' } })).status, 400);
  assert.equal((await api('PATCH', `/api/lab/bookings/${id}/status`, { token: labTok, body: { status: 'sample_collected' } })).data.status, 'sample_collected');
  assert.equal((await api('PATCH', `/api/lab/bookings/${id}/status`, { token: labTok, body: { status: 'processing' } })).data.status, 'processing');

  const full = (await api('GET', `/api/lab/bookings/${id}`, { token: labTok })).data;
  const values = {};
  for (const p of full.parameters) values[p.name] = p.ref_text ? p.ref_text : p.low ?? p.high;
  values[full.parameters[0].name] = 8.1; // Haemoglobin, low
  const rep = await api('POST', `/api/lab/bookings/${id}/report`, { token: labTok, body: { values } });
  assert.equal(rep.status, 201, JSON.stringify(rep.data));
  assert.equal(rep.data.status, 'report_ready');

  const mine = (await api('GET', `/api/lab/bookings/${id}`, { token: patient.token })).data;
  assert.equal(mine.report.results[0].flag, 'low');
  assert.match(mine.report.summary, /outside the reference range/);
  assert.equal((await api('GET', `/api/lab/bookings/${id}`, { token: doctorTok })).status, 404);
});

test('blood bank: emergency request → approve → fulfil updates stock', async () => {
  const stockOf = async (g) => (await api('GET', '/api/blood/stock', { token: patient.token })).data.stock.find((s) => s.blood_group === g).units;
  const before = await stockOf('O+');
  const r = await api('POST', '/api/blood/requests', {
    token: patient.token,
    body: { patient_name: 'Asha Devi', blood_group: 'O+', units: 2, hospital: 'District Hospital', city: 'Noida', urgency: 'critical', contact_phone: '9811100000' },
  });
  assert.equal(r.status, 201);
  assert.equal((await api('PATCH', `/api/blood/requests/${r.data.id}`, { token: adminTok, body: { action: 'approve' } })).data.status, 'approved');
  assert.equal((await api('PATCH', `/api/blood/requests/${r.data.id}`, { token: adminTok, body: { action: 'fulfil' } })).data.status, 'fulfilled');
  assert.equal(await stockOf('O+'), before - 2);
  assert.equal((await api('PATCH', `/api/blood/requests/${r.data.id}`, { token: adminTok, body: { action: 'reject' } })).status, 400);

  // Can't fulfil more than the stock
  const big = await api('POST', '/api/blood/requests', {
    token: patient.token,
    body: { patient_name: 'Big Need', blood_group: 'AB-', units: 20, hospital: 'X', city: 'Noida', contact_phone: '9811100001' },
  });
  assert.equal((await api('PATCH', `/api/blood/requests/${big.data.id}`, { token: adminTok, body: { action: 'fulfil' } })).status, 409);
  assert.equal((await api('PATCH', `/api/blood/requests/${big.data.id}`, { token: patient.token, body: { action: 'approve' } })).status, 403);
});

test('blood donor: register → verify → donation adds stock and sets the gap', async () => {
  const tooYoung = await api('POST', '/api/blood/me/donor', {
    token: patient.token, body: { blood_group: 'O+', gender: 'female', dob: U.addDays(U.today(), -365 * 16), weight_kg: 50, city: 'Noida', phone: '9876500000' },
  });
  assert.equal(tooYoung.status, 400);

  const reg = await api('POST', '/api/blood/me/donor', {
    token: patient.token, body: { blood_group: 'O+', gender: 'female', dob: '2000-05-10', weight_kg: 52, city: 'Noida', phone: '9876500000' },
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));

  const donor = (await api('GET', '/api/blood/admin/donors', { token: adminTok })).data.find((d) => d.phone === '9876500000');
  assert.equal(donor.verified, 0);
  // Unverified donors are hidden from search
  let found = (await api('GET', '/api/blood/donors?blood_group=O%2B&city=Noida', { token: patient.token })).data;
  assert.ok(!found.some((d) => d.id === donor.id));

  await api('PATCH', `/api/blood/admin/donors/${donor.id}/verify`, { token: adminTok, body: { verified: true } });
  found = (await api('GET', '/api/blood/donors?blood_group=A%2B&compatible=1', { token: patient.token })).data;
  assert.ok(found.some((d) => d.id === donor.id), 'O+ donor appears for an A+ patient when compatible=1');
  assert.ok(found.every((d) => !/\d{10}/.test(d.phone_masked)), 'phone numbers are masked in search');

  const stock = async () => (await api('GET', '/api/blood/stock', { token: adminTok })).data.stock.find((s) => s.blood_group === 'O+').units;
  const s0 = await stock();
  assert.equal((await api('POST', '/api/blood/admin/donations', { token: adminTok, body: { donor_id: donor.id, units: 1 } })).status, 201);
  assert.equal(await stock(), s0 + 1);

  const me = (await api('GET', '/api/blood/me/donor', { token: patient.token })).data;
  assert.equal(me.donations.length, 1);
  assert.equal(me.eligibility.eligible, false);
  assert.equal(me.eligibility.next_date, U.addDays(U.today(), 120));
  assert.equal((await api('POST', '/api/blood/admin/donations', { token: adminTok, body: { donor_id: donor.id } })).status, 400);
});

test('admin: add a doctor who can then log in, stats and notifications', async () => {
  const deps = (await api('GET', '/api/doctors/departments', { token: adminTok })).data;
  const add = await api('POST', '/api/admin/doctors', {
    token: adminTok,
    body: { name: 'Dr. Test Sharma', email: 'test.sharma@example.com', password: 'temp1234', department_id: deps[0].id, specialization: 'Physician', fee: 300, work_days: '1,2,3', start_time: '10:00', end_time: '12:00' },
  });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  const r = await api('POST', '/api/auth/login', { body: { email: 'test.sharma@example.com', password: 'temp1234', role: 'doctor' } });
  assert.equal(r.status, 200);

  await api('PATCH', `/api/admin/doctors/${add.data.id}`, { token: adminTok, body: { active: false } });
  assert.ok(!(await api('GET', '/api/doctors', { token: patient.token })).data.some((d) => d.id === add.data.id));
  assert.ok((await api('GET', '/api/doctors?all=1', { token: adminTok })).data.some((d) => d.id === add.data.id));

  const stats = (await api('GET', '/api/admin/stats', { token: adminTok })).data;
  assert.ok(stats.patients >= 7);
  assert.equal(typeof stats.blood_units, 'number');

  const notes = (await api('GET', '/api/auth/notifications', { token: patient.token })).data;
  assert.ok(notes.items.some((n) => /Prescription ready/.test(n.title)));
  assert.ok(notes.items.some((n) => /Report ready/.test(n.title)));
});

test('reminders are sent once for upcoming bookings', async () => {
  const { sendReminders } = require('../server/services');
  const first = await sendReminders();
  assert.ok(first >= 1);
  assert.equal(await sendReminders(), 0);
});
