// Seeds the database with master data (departments, doctors, lab tests, blood
// stock, AI knowledge tables) and realistic demo activity.
// Runs automatically on first start. `npm run seed` wipes and re-seeds.
const db = require('./index');
const K = require('../ai/knowledge');
const { workingSlots } = require('../services');
const U = require('../utils');

const DEMO_PASSWORD = 'demo1234';

const DEPARTMENTS = [
  ['General Medicine', 'Fever, infections, lifestyle diseases and first consultations'],
  ['Cardiology', 'Heart and blood pressure'],
  ['Dermatology', 'Skin, hair and nails'],
  ['ENT', 'Ear, nose and throat'],
  ['Gastroenterology', 'Stomach, liver and digestion'],
  ['Neurology', 'Brain, nerves, headaches and seizures'],
  ['Orthopaedics', 'Bones, joints and injuries'],
  ['Paediatrics', 'Children up to 14 years'],
  ['Pulmonology', 'Lungs, asthma and breathing'],
  ['Gynaecology', "Women's health and pregnancy"],
  ['Psychiatry', 'Mental health, stress, sleep and mood'],
  ['Ophthalmology', 'Eyes and vision'],
  ['Endocrinology', 'Diabetes, thyroid and hormones'],
];

// [name, email, department, specialization, qualification, years, fee, work_days, start, end, slot, room]
const DOCTORS = [
  ['Dr. Rohit Malhotra', 'doctor@demo.in', 'General Medicine', 'General Physician', 'MBBS, MD (General Medicine)', 12, 500, '0,1,2,3,4,5,6', '09:00', '18:00', 20, 'OPD 1'],
  ['Dr. Kavita Rao', 'kavita.rao@shc.demo', 'General Medicine', 'Family Physician', 'MBBS, DNB (Family Medicine)', 8, 400, '1,2,3,4,5,6', '10:00', '16:00', 15, 'OPD 2'],
  ['Dr. Arjun Iyer', 'arjun.iyer@shc.demo', 'Cardiology', 'Interventional Cardiologist', 'MBBS, MD, DM (Cardiology)', 18, 1200, '1,2,3,4,5', '10:00', '15:00', 20, 'Heart Centre 3'],
  ['Dr. Meera Kapoor', 'meera.kapoor@shc.demo', 'Dermatology', 'Dermatologist', 'MBBS, MD (Dermatology)', 10, 700, '1,2,3,4,5,6', '11:00', '17:00', 15, 'Skin Clinic 5'],
  ['Dr. Sanjay Bhatia', 'sanjay.bhatia@shc.demo', 'ENT', 'ENT Surgeon', 'MBBS, MS (ENT)', 15, 700, '1,2,3,4,5,6', '10:00', '14:00', 15, 'ENT 7'],
  ['Dr. Farhan Qureshi', 'farhan.qureshi@shc.demo', 'Gastroenterology', 'Gastroenterologist', 'MBBS, MD, DM (Gastroenterology)', 14, 1000, '1,2,3,4,5', '12:00', '18:00', 20, 'GI 4'],
  ['Dr. Priya Nair', 'priya.nair@shc.demo', 'Neurology', 'Neurologist', 'MBBS, MD, DM (Neurology)', 11, 1100, '1,3,5,6', '10:00', '16:00', 20, 'Neuro 2'],
  ['Dr. Vikram Singh', 'vikram.singh@shc.demo', 'Orthopaedics', 'Orthopaedic Surgeon', 'MBBS, MS (Orthopaedics)', 16, 800, '1,2,3,4,5,6', '09:00', '14:00', 15, 'Ortho 1'],
  ['Dr. Sneha Joshi', 'sneha.joshi@shc.demo', 'Paediatrics', 'Paediatrician', 'MBBS, MD (Paediatrics)', 9, 600, '0,1,2,3,4,5,6', '09:00', '13:00', 15, 'Kids OPD'],
  ['Dr. Amitabh Das', 'amitabh.das@shc.demo', 'Pulmonology', 'Chest Physician', 'MBBS, MD (Pulmonary Medicine)', 13, 800, '1,2,4,5,6', '10:00', '15:00', 20, 'Chest 6'],
  ['Dr. Ritu Agarwal', 'ritu.agarwal@shc.demo', 'Gynaecology', 'Obstetrician & Gynaecologist', 'MBBS, MS (OBG)', 17, 900, '1,2,3,4,5,6', '11:00', '17:00', 20, 'Women\'s Clinic'],
  ['Dr. Nikhil Menon', 'nikhil.menon@shc.demo', 'Psychiatry', 'Psychiatrist', 'MBBS, MD (Psychiatry)', 10, 900, '1,2,3,4,5', '12:00', '19:00', 30, 'Wellness 2'],
  ['Dr. Aisha Khan', 'aisha.khan@shc.demo', 'Ophthalmology', 'Eye Specialist', 'MBBS, MS (Ophthalmology)', 7, 600, '1,2,3,4,5,6', '10:00', '15:00', 15, 'Eye 3'],
  ['Dr. Harpreet Kaur', 'harpreet.kaur@shc.demo', 'Endocrinology', 'Endocrinologist (Diabetes & Thyroid)', 'MBBS, MD, DM (Endocrinology)', 12, 1000, '1,2,3,5,6', '10:00', '16:00', 20, 'Endo 1'],
];

const p = (name, unit, low, high) => ({ name, unit, low, high });
const q = (name, ref_text) => ({ name, unit: '', ref_text });
// [name, category, price, hours, home, sample, preparation, description, parameters]
const LAB_TESTS = [
  ['Complete Blood Count (CBC)', 'Blood health', 350, 12, 1, 'Blood', 'No fasting needed', 'Checks haemoglobin, infection-fighting cells and platelets.',
    [p('Haemoglobin', 'g/dL', 12, 17), p('Total WBC count', '/µL', 4000, 11000), p('Platelet count', '/µL', 150000, 450000), p('RBC count', 'million/µL', 4.2, 5.9), p('Haematocrit (PCV)', '%', 36, 50)]],
  ['Lipid Profile', 'Heart health', 600, 24, 1, 'Blood', 'Fast for 10–12 hours (water is fine)', 'Cholesterol and triglycerides — heart-disease risk.',
    [p('Total cholesterol', 'mg/dL', null, 200), p('Triglycerides', 'mg/dL', null, 150), p('HDL cholesterol', 'mg/dL', 40, null), p('LDL cholesterol', 'mg/dL', null, 100), p('VLDL cholesterol', 'mg/dL', 5, 40)]],
  ['Liver Function Test (LFT)', 'Liver & kidney', 700, 24, 1, 'Blood', 'Fast for 8 hours', 'Liver enzymes, bilirubin and proteins.',
    [p('Bilirubin (total)', 'mg/dL', 0.1, 1.2), p('SGPT (ALT)', 'U/L', 7, 56), p('SGOT (AST)', 'U/L', 10, 40), p('Alkaline phosphatase', 'U/L', 44, 147), p('Albumin', 'g/dL', 3.5, 5.0)]],
  ['Kidney Function Test (KFT)', 'Liver & kidney', 650, 24, 1, 'Blood', 'No fasting needed', 'Urea, creatinine, uric acid and electrolytes.',
    [p('Urea', 'mg/dL', 15, 40), p('Creatinine', 'mg/dL', 0.6, 1.3), p('Uric acid', 'mg/dL', 3.4, 7.0), p('Sodium', 'mmol/L', 135, 145), p('Potassium', 'mmol/L', 3.5, 5.1)]],
  ['Thyroid Profile (T3, T4, TSH)', 'Hormones', 550, 24, 1, 'Blood', 'Morning sample preferred; take thyroid tablets after the test', 'Checks for an under- or overactive thyroid.',
    [p('T3 (total)', 'ng/dL', 80, 200), p('T4 (total)', 'µg/dL', 5.0, 12.0), p('TSH', 'µIU/mL', 0.4, 4.0)]],
  ['Fasting Blood Sugar (FBS)', 'Diabetes', 100, 6, 1, 'Blood', 'Fast for 8–10 hours (water is fine)', 'Blood glucose after an overnight fast.',
    [p('Glucose (fasting)', 'mg/dL', 70, 100)]],
  ['HbA1c', 'Diabetes', 450, 24, 1, 'Blood', 'No fasting needed', 'Average blood sugar over the last 3 months.',
    [p('HbA1c', '%', 4.0, 5.6), p('Estimated average glucose', 'mg/dL', 68, 114)]],
  ['Vitamin D (25-OH)', 'Vitamins', 1200, 48, 1, 'Blood', 'No fasting needed', 'Vitamin D level for bone and muscle health.',
    [p('25-OH Vitamin D', 'ng/mL', 30, 100)]],
  ['Vitamin B12', 'Vitamins', 900, 48, 1, 'Blood', 'Fast for 6–8 hours', 'Low B12 causes tiredness, tingling and anaemia.',
    [p('Vitamin B12', 'pg/mL', 200, 900)]],
  ['Urine Routine & Microscopy', 'Urine', 200, 12, 1, 'Urine', 'First morning urine in a sterile container', 'Screens for infection, sugar and protein in urine.',
    [q('Colour', 'Pale yellow'), q('Appearance', 'Clear'), p('pH', '', 4.5, 8.0), p('Specific gravity', '', 1.005, 1.030), q('Protein', 'Negative'), q('Glucose', 'Negative'), p('Pus cells', '/hpf', 0, 5), p('Red blood cells', '/hpf', 0, 2)]],
  ['Dengue NS1 Antigen', 'Infections', 800, 12, 1, 'Blood', 'No fasting needed; best within the first 5 days of fever', 'Detects dengue early in the illness.',
    [q('NS1 antigen', 'Negative')]],
  ['Malaria Antigen (Rapid)', 'Infections', 400, 6, 0, 'Blood', 'No fasting needed; lab visit for quick results', 'Rapid test for P. falciparum and P. vivax malaria.',
    [q('P. falciparum antigen', 'Negative'), q('P. vivax antigen', 'Negative')]],
  ['Typhoid IgM (Rapid)', 'Infections', 500, 12, 1, 'Blood', 'No fasting needed', 'Rapid antibody test for typhoid fever.',
    [q('Salmonella Typhi IgM', 'Negative')]],
];

const STOCK = { 'A+': 18, 'A-': 4, 'B+': 22, 'B-': 3, 'AB+': 9, 'AB-': 2, 'O+': 25, 'O-': 6 };

// [name, email, phone, dob, gender, blood group, city]
const PATIENTS = [
  ['Ananya Verma', 'patient@demo.in', '9810012345', '2004-03-14', 'female', 'B+', 'Noida'],
  ['Rahul Khanna', 'rahul.k@example.in', '9899011122', '1988-07-22', 'male', 'O+', 'Ghaziabad'],
  ['Sunita Devi', 'sunita.d@example.in', '9711022233', '1965-11-02', 'female', 'A+', 'Delhi'],
  ['Mohammed Imran', 'imran.m@example.in', '9650033344', '1995-01-30', 'male', 'B-', 'Noida'],
  ['Pooja Saxena', 'pooja.s@example.in', '9560044455', '1999-09-09', 'female', 'AB+', 'Greater Noida'],
  ['Karan Mehta', 'karan.m@example.in', '9873055566', '1979-05-18', 'male', 'O-', 'Gurugram'],
];

// [name, group, gender, dob, weight, phone, city, last donation (days ago | null), verified]
const DONORS = [
  ['Aditya Rawat', 'O-', 'male', '1996-02-11', 72, '9811100011', 'Noida', 200, 1],
  ['Simran Kaur', 'O+', 'female', '1998-06-25', 58, '9811100022', 'Delhi', 150, 1],
  ['Deepak Yadav', 'B+', 'male', '1990-12-01', 80, '9811100033', 'Ghaziabad', 40, 1],
  ['Nisha Bansal', 'A+', 'female', '1993-04-17', 55, '9811100044', 'Noida', null, 1],
  ['Rakesh Tyagi', 'B-', 'male', '1987-08-08', 76, '9811100055', 'Greater Noida', 120, 1],
  ['Farah Siddiqui', 'AB+', 'female', '1994-10-30', 52, '9811100066', 'Delhi', 300, 1],
  ['Manish Chauhan', 'A-', 'male', '1991-01-19', 68, '9811100077', 'Gurugram', 95, 1],
  ['Tanvi Arora', 'O+', 'female', '2000-07-07', 50, '9811100088', 'Noida', null, 1],
  ['Gaurav Sharma', 'AB-', 'male', '1989-03-03', 82, '9811100099', 'Faridabad', 180, 1],
  ['Lakshmi Pillai', 'B+', 'female', '1985-12-24', 61, '9811100100', 'Noida', 30, 1],
  ['Varun Bedi', 'O-', 'male', '1997-05-15', 70, '9811100111', 'Ghaziabad', null, 1],
  ['Ishita Goel', 'A+', 'female', '2001-11-11', 49, '9811100122', 'Delhi', 400, 1],
  ['Rohan Sethi', 'B-', 'male', '1999-09-29', 74, '9811100133', 'Noida', null, 0],
  ['Kiran Joshi', 'O+', 'female', '1992-02-02', 57, '9811100144', 'Gurugram', null, 0],
];

async function wipe() {
  const tables = ['notifications', 'donations', 'blood_requests', 'donors', 'blood_bank', 'test_reports', 'test_bookings', 'lab_tests',
    'feedback', 'prescriptions', 'appointments', 'ai_consult_logs', 'medicine_suggestions', 'symptoms', 'doctors', 'departments', 'patients', 'users'];
  for (const t of tables) await db.run(`DELETE FROM ${t}`);
}

async function seed({ reset = false, demo = true } = {}) {
  await db.init();
  if (reset) await wipe();
  if (await db.get('SELECT id FROM users LIMIT 1')) return false;

  const now = U.nowIso();
  const today = U.today();
  const hash = await U.hashPassword(DEMO_PASSWORD);

  // Hash first (async), then write everything in one transaction.
  await db.tx(async (t) => {
    const addUser = async (role, name, email, phone) =>
      (await t.run('INSERT INTO users (role, name, email, phone, password_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [role, name, email, phone, hash, now])).insertId;

    // ---- AI knowledge tables ----
    for (const s of K.SYMPTOMS) {
      await t.run('INSERT INTO symptoms (code, name, body_system, aliases) VALUES (?, ?, ?, ?)', [s.code, s.name, s.system, s.aliases.join(', ')]);
    }
    for (const m of K.MEDICINES) {
      await t.run('INSERT INTO medicine_suggestions (code, category, examples, caution, otc) VALUES (?, ?, ?, ?, ?)', [m.code, m.category, m.examples, m.caution, m.otc]);
    }

    // ---- Departments & doctors ----
    const deptId = {};
    for (const [name, desc] of DEPARTMENTS) deptId[name] = (await t.run('INSERT INTO departments (name, description) VALUES (?, ?)', [name, desc])).insertId;
    const docs = {};
    for (const [name, email, dept, spec, qual, yrs, fee, days, start, end, slot, room] of DOCTORS) {
      const uid = await addUser('doctor', name, email, null);
      const bio = `${yrs} years of experience in ${dept.toLowerCase()}.`;
      const id = (await t.run(
        `INSERT INTO doctors (user_id, department_id, specialization, qualification, experience_years, fee, bio, work_days, start_time, end_time, slot_minutes, room, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [uid, deptId[dept], spec, qual, yrs, fee, bio, days, start, end, slot, room]
      )).insertId;
      docs[email] = { id, user_id: uid, fee, work_days: days, start_time: start, end_time: end, slot_minutes: slot, name };
    }

    // ---- Lab tests ----
    const testId = {};
    for (const [name, cat, price, hours, home, sample, prep, desc, params] of LAB_TESTS) {
      testId[name] = (await t.run(
        `INSERT INTO lab_tests (name, category, description, sample_type, price, turnaround_hours, home_collection, preparation, parameters, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [name, cat, desc, sample, price, hours, home, prep, JSON.stringify(params)]
      )).insertId;
    }

    // ---- Blood stock ----
    for (const g of U.BLOOD_GROUPS) await t.run('INSERT INTO blood_bank (blood_group, units, updated_at) VALUES (?, ?, ?)', [g, STOCK[g], now]);

    // ---- Staff ----
    const adminId = await addUser('admin', 'Hospital Admin', 'admin@demo.in', '9800000001');
    const labId = await addUser('lab', 'Neha Gupta', 'lab@demo.in', '9800000002');

    if (!demo) return;

    // ---- Patients ----
    const pats = [];
    for (const [name, email, phone, dob, gender, bg, city] of PATIENTS) {
      const uid = await addUser('patient', name, email, phone);
      const id = (await t.run('INSERT INTO patients (user_id, dob, gender, blood_group, city, address) VALUES (?, ?, ?, ?, ?, ?)', [
        uid, dob, gender, bg, city, `Sector ${10 + pats.length * 7}, ${city}`,
      ])).insertId;
      pats.push({ id, user_id: uid, name });
    }
    const [ananya, rahul, sunita, imran, pooja, karan] = pats;

    // ---- Appointments ----
    const nextWorkingDate = (doc, fromOffset) => {
      for (let i = fromOffset; i < fromOffset + 14; i++) {
        const d = U.addDays(today, i);
        if (workingSlots(doc, d).length) return d;
      }
      return U.addDays(today, fromOffset);
    };
    const slotAt = (doc, dateStr, index) => {
      const s = workingSlots(doc, dateStr);
      return s[Math.min(index, s.length - 1)];
    };
    const addAppt = async (pat, doc, dateStr, time, status, reason, extra = {}) =>
      (await t.run(
        `INSERT INTO appointments (patient_id, doctor_id, consult_id, appt_date, slot_time, reason, status, fee, reminded, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [pat.id, doc.id, extra.consult_id || null, dateStr, time, reason, status, doc.fee, now, now]
      )).insertId;
    const addRx = (apptId, diagnosis, meds, advice, followUp = null) =>
      t.run('INSERT INTO prescriptions (appointment_id, diagnosis, medicines, advice, follow_up_date, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        apptId, diagnosis, JSON.stringify(meds), advice, followUp, now,
      ]);

    const drRohit = docs['doctor@demo.in'];
    const drKavita = docs['kavita.rao@shc.demo'];
    const drMeera = docs['meera.kapoor@shc.demo'];

    // AI consult that led to today's booking with Dr. Rohit
    const consult = (await t.run(
      `INSERT INTO ai_consult_logs (patient_id, symptoms_text, matched_symptoms, age, duration_days, severity, conditions, urgency, advice, medicine_code, department_id, suggested_tests, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ananya.id, 'bukhar aur sar dard since 3 days, body ache', JSON.stringify(['fever', 'headache', 'body_ache']), 22, 3, 'moderate',
        JSON.stringify([{ code: 'viral_fever', name: 'Viral fever / flu', match: 70 }]), 'doctor_soon',
        JSON.stringify(['Rest and drink plenty of fluids.']), 'antipyretic', deptId['General Medicine'], JSON.stringify(['Complete Blood Count (CBC)']), now]
    )).insertId;

    // Today with Dr. Rohit (demo doctor dashboard)
    await addAppt(ananya, drRohit, today, slotAt(drRohit, today, 3), 'booked', 'Fever and headache for 3 days', { consult_id: consult });
    await addAppt(rahul, drRohit, today, slotAt(drRohit, today, 6), 'booked', 'Follow-up for blood pressure');
    await addAppt(sunita, drRohit, today, slotAt(drRohit, today, 12), 'booked', 'Knee pain and tiredness');
    // Yesterday, never closed -> shows under "needs action"
    await addAppt(imran, drRohit, U.addDays(today, -1), slotAt(drRohit, U.addDays(today, -1), 4), 'booked', 'Acidity after meals');
    // Past completed visits
    const past1 = await addAppt(pooja, drRohit, U.addDays(today, -6), slotAt(drRohit, U.addDays(today, -6), 2), 'completed', 'Sore throat and cold');
    await addRx(past1, 'Acute pharyngitis (viral)', [
      { name: 'Paracetamol 650 mg', dosage: '1 tablet', frequency: 'SOS, max 3/day', duration: '3 days' },
      { name: 'Warm saline gargles', dosage: '', frequency: '3 times a day', duration: '5 days' },
    ], 'Warm fluids, voice rest. Return if fever persists beyond 3 days.');
    await t.run('INSERT INTO feedback (appointment_id, patient_id, doctor_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)', [past1, pooja.id, drRohit.id, 5, 'Very patient and explained everything clearly.', now]);
    const past2 = await addAppt(karan, drRohit, U.addDays(today, -12), slotAt(drRohit, U.addDays(today, -12), 8), 'completed', 'Routine check-up');
    await addRx(past2, 'Borderline high cholesterol', [], 'Lipid profile in 3 months. 30 minutes brisk walk daily, reduce fried food.', U.addDays(today, 78));
    await t.run('INSERT INTO feedback (appointment_id, patient_id, doctor_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)', [past2, karan.id, drRohit.id, 4, 'Good consultation, short wait.', now]);

    // Ananya's history
    const d30 = nextWorkingDate(drKavita, -30);
    const a1 = await addAppt(ananya, drKavita, d30, slotAt(drKavita, d30, 5), 'completed', 'Seasonal allergy — sneezing');
    await addRx(a1, 'Allergic rhinitis', [
      { name: 'Levocetirizine 5 mg', dosage: '1 tablet', frequency: 'Once at night', duration: '7 days' },
      { name: 'Saline nasal spray', dosage: '2 sprays each nostril', frequency: 'Twice a day', duration: '10 days' },
    ], 'Avoid dust exposure; wear a mask on high-AQI days.');
    await t.run('INSERT INTO feedback (appointment_id, patient_id, doctor_id, rating, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)', [a1, ananya.id, drKavita.id, 5, 'Quick relief, thank you.', now]);
    const d8 = nextWorkingDate(drMeera, -8);
    const a2 = await addAppt(ananya, drMeera, d8, slotAt(drMeera, d8, 4), 'completed', 'Itchy rash on arm');
    await addRx(a2, 'Tinea corporis (ringworm)', [
      { name: 'Clotrimazole 1% cream', dosage: 'Thin layer', frequency: 'Twice a day', duration: '4 weeks' },
      { name: 'Antifungal dusting powder', dosage: '', frequency: 'Once a day', duration: '4 weeks' },
    ], 'Keep the area dry, cotton clothes, no steroid creams.', U.addDays(today, 20));
    const dUp = nextWorkingDate(drMeera, 2);
    await addAppt(ananya, drMeera, dUp, slotAt(drMeera, dUp, 6), 'booked', 'Follow-up for skin rash');

    // ---- Lab bookings & reports ----
    const addBooking = async (pat, test, dateStr, type, slot, status) =>
      (await t.run(
        `INSERT INTO test_bookings (patient_id, test_id, collection_type, address, booking_date, time_slot, status, price, reminded, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT price FROM lab_tests WHERE id = ?), 0, ?, ?)`,
        [pat.id, testId[test], type, type === 'home' ? 'Sector 18, Noida' : null, dateStr, slot, status, testId[test], now, now]
      )).insertId;
    const addReport = (bookingId, results, summary) =>
      t.run('INSERT INTO test_reports (booking_id, results, summary, technician_id, created_at) VALUES (?, ?, ?, ?, ?)', [bookingId, JSON.stringify(results), summary, labId, now]);

    const cbc = await addBooking(ananya, 'Complete Blood Count (CBC)', U.addDays(today, -10), 'home', '07:00–09:00', 'report_ready');
    await addReport(cbc, [
      { ...p('Haemoglobin', 'g/dL', 12, 17), value: 11.2, flag: 'low' },
      { ...p('Total WBC count', '/µL', 4000, 11000), value: 7200, flag: 'normal' },
      { ...p('Platelet count', '/µL', 150000, 450000), value: 245000, flag: 'normal' },
      { ...p('RBC count', 'million/µL', 4.2, 5.9), value: 4.3, flag: 'normal' },
      { ...p('Haematocrit (PCV)', '%', 36, 50), value: 35, flag: 'low' },
    ], 'Haemoglobin and PCV slightly low — suggestive of mild anaemia. Please discuss with your doctor.');
    await addBooking(ananya, 'Thyroid Profile (T3, T4, TSH)', U.addDays(today, 1), 'home', '07:00–09:00', 'booked');
    await addBooking(rahul, 'Lipid Profile', today, 'home', '07:00–09:00', 'sample_collected');
    await addBooking(sunita, 'Kidney Function Test (KFT)', today, 'lab', '09:00–11:00', 'processing');
    await addBooking(imran, 'Dengue NS1 Antigen', today, 'lab', '11:00–13:00', 'booked');
    await addBooking(pooja, 'Vitamin D (25-OH)', U.addDays(today, 1), 'home', '09:00–11:00', 'booked');
    const hb = await addBooking(karan, 'HbA1c', U.addDays(today, -3), 'lab', '09:00–11:00', 'report_ready');
    await addReport(hb, [{ ...p('HbA1c', '%', 4.0, 5.6), value: 5.4, flag: 'normal' }, { ...p('Estimated average glucose', 'mg/dL', 68, 114), value: 108, flag: 'normal' }], 'All values are within the reference range.');

    // ---- Donors, donations, requests ----
    for (const [name, bg, gender, dob, weight, phone, city, ago, verified] of DONORS) {
      const last = ago === null ? null : U.addDays(today, -ago);
      const id = (await t.run(
        `INSERT INTO donors (user_id, name, blood_group, gender, dob, weight_kg, phone, city, last_donation_date, verified, available, created_at)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [name, bg, gender, dob, weight, phone, city, last, verified, now]
      )).insertId;
      if (last) await t.run('INSERT INTO donations (donor_id, donation_date, units, recorded_by, created_at) VALUES (?, ?, 1, ?, ?)', [id, last, adminId, now]);
    }
    // Rahul is also a donor linked to his account
    await t.run(
      `INSERT INTO donors (user_id, name, blood_group, gender, dob, weight_kg, phone, city, last_donation_date, verified, available, created_at)
       VALUES (?, 'Rahul Khanna', 'O+', 'male', '1988-07-22', 78, '9899011122', 'Ghaziabad', ?, 1, 1, ?)`,
      [rahul.user_id, U.addDays(today, -100), now]
    );

    const addReq = (by, name, bg, units, hospital, city, urgency, status, note = null) =>
      t.run(
        `INSERT INTO blood_requests (requested_by, patient_name, blood_group, units, hospital, city, urgency, contact_phone, notes, status, admin_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        [by, name, bg, units, hospital, city, urgency, '9810099999', status, note, now, now]
      );
    await addReq(imran.user_id, 'Shabana Begum', 'B-', 2, 'Metro Care Hospital, Sector 12', 'Noida', 'critical', 'pending');
    await addReq(sunita.user_id, 'Ramesh Kumar', 'A+', 1, 'Sunrise Multispeciality', 'Delhi', 'urgent', 'approved', 'Collect from blood bank counter 2');
    await addReq(ananya.user_id, 'Suresh Verma', 'B+', 2, 'Lifeline Hospital, Sector 27', 'Noida', 'urgent', 'fulfilled', 'Issued');

    // ---- Notifications ----
    const n = (uid, title, body, link) => t.run('INSERT INTO notifications (user_id, title, body, link, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)', [uid, title, body, link, now]);
    await n(ananya.user_id, 'Report ready: Complete Blood Count (CBC)', 'Some values need attention — open the report.', '#/records');
    await n(ananya.user_id, 'Welcome to Smart Health Connect', 'Try the AI assistant, book a doctor or a test, and keep all your records in one place.', '#/home');
    await n(adminId, 'CRITICAL blood request: 2 unit(s) B-', 'Shabana Begum at Metro Care Hospital, Noida.', '#/requests');
    await n(adminId, 'New donor to verify', 'Rohan Sethi (B-, Noida) registered as a blood donor.', '#/donors');
    await n(labId, 'New test booking', 'Dengue NS1 Antigen for Mohammed Imran today, 11:00–13:00.', '#/queue');
    await n(drRohit.user_id, 'New appointment', 'Ananya Verma today — booked after an AI consult.', '#/schedule');
  });
  return true;
}

module.exports = { seed, DEMO_PASSWORD };

// `node server/db/seed.js --reset`
if (require.main === module) {
  seed({ reset: process.argv.includes('--reset') })
    .then((did) => {
      console.log(did ? `Database seeded. Demo password for every account: ${DEMO_PASSWORD}` : 'Database already has data (use --reset to start over).');
      return db.close();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
