-- Smart Health Connect: database schema
-- Works on SQLite and MySQL. {{PK}} is replaced with the right auto-increment
-- primary key syntax for each database (see server/db/index.js).
-- JSON columns are stored as TEXT.

-- ---------- User & Core ----------
CREATE TABLE IF NOT EXISTS users (
  id {{PK}},
  role VARCHAR(20) NOT NULL,                -- patient | doctor | lab | admin
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id {{PK}},
  user_id INTEGER NOT NULL UNIQUE,
  dob VARCHAR(10),
  gender VARCHAR(10),
  blood_group VARCHAR(3),
  city VARCHAR(80),
  address VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS departments (
  id {{PK}},
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS doctors (
  id {{PK}},
  user_id INTEGER NOT NULL UNIQUE,
  department_id INTEGER NOT NULL,
  specialization VARCHAR(120) NOT NULL,
  qualification VARCHAR(120),
  experience_years INTEGER NOT NULL DEFAULT 0,
  fee INTEGER NOT NULL DEFAULT 500,          -- rupees
  bio VARCHAR(500),
  work_days VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6',  -- 0=Sun ... 6=Sat
  start_time VARCHAR(5) NOT NULL DEFAULT '10:00',
  end_time VARCHAR(5) NOT NULL DEFAULT '16:00',
  slot_minutes INTEGER NOT NULL DEFAULT 20,
  room VARCHAR(40),
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (department_id) REFERENCES departments (id)
);

-- ---------- AI Consult ----------
CREATE TABLE IF NOT EXISTS symptoms (
  id {{PK}},
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  body_system VARCHAR(40) NOT NULL,
  aliases TEXT
);

CREATE TABLE IF NOT EXISTS medicine_suggestions (
  id {{PK}},
  code VARCHAR(40) NOT NULL UNIQUE,
  category VARCHAR(120) NOT NULL,
  examples VARCHAR(255),
  caution VARCHAR(500),
  otc INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ai_consult_logs (
  id {{PK}},
  patient_id INTEGER NOT NULL,
  symptoms_text TEXT,
  matched_symptoms TEXT,        -- JSON array of symptom codes
  age INTEGER,
  duration_days INTEGER,
  severity VARCHAR(10),
  conditions TEXT,              -- JSON [{name, score}]
  urgency VARCHAR(20) NOT NULL, -- self_care | doctor_soon | urgent | emergency
  advice TEXT,                  -- JSON array of strings
  medicine_code VARCHAR(40),
  department_id INTEGER,
  suggested_tests TEXT,         -- JSON array of lab test names
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients (id),
  FOREIGN KEY (department_id) REFERENCES departments (id)
);

-- ---------- Appointments ----------
CREATE TABLE IF NOT EXISTS appointments (
  id {{PK}},
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  consult_id INTEGER,
  appt_date VARCHAR(10) NOT NULL,
  slot_time VARCHAR(5) NOT NULL,
  reason VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'booked', -- booked | completed | cancelled | no_show
  fee INTEGER NOT NULL DEFAULT 0,
  reminded INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients (id),
  FOREIGN KEY (doctor_id) REFERENCES doctors (id),
  FOREIGN KEY (consult_id) REFERENCES ai_consult_logs (id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id {{PK}},
  appointment_id INTEGER NOT NULL UNIQUE,
  diagnosis VARCHAR(255) NOT NULL,
  medicines TEXT,               -- JSON [{name, dosage, frequency, duration}]
  advice TEXT,
  follow_up_date VARCHAR(10),
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments (id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id {{PK}},
  appointment_id INTEGER NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  comments VARCHAR(1000),
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments (id),
  FOREIGN KEY (patient_id) REFERENCES patients (id),
  FOREIGN KEY (doctor_id) REFERENCES doctors (id)
);

-- ---------- Lab / Blood Test ----------
CREATE TABLE IF NOT EXISTS lab_tests (
  id {{PK}},
  name VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(60) NOT NULL,
  description VARCHAR(500),
  sample_type VARCHAR(40) NOT NULL DEFAULT 'Blood',
  price INTEGER NOT NULL,
  turnaround_hours INTEGER NOT NULL DEFAULT 24,
  home_collection INTEGER NOT NULL DEFAULT 1,
  preparation VARCHAR(255),
  parameters TEXT NOT NULL,     -- JSON [{name, unit, low, high} | {name, ref_text}]
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS test_bookings (
  id {{PK}},
  patient_id INTEGER NOT NULL,
  test_id INTEGER NOT NULL,
  collection_type VARCHAR(10) NOT NULL,   -- home | lab
  address VARCHAR(255),
  booking_date VARCHAR(10) NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'booked', -- booked | sample_collected | processing | report_ready | cancelled
  price INTEGER NOT NULL,
  reminded INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients (id),
  FOREIGN KEY (test_id) REFERENCES lab_tests (id)
);

CREATE TABLE IF NOT EXISTS test_reports (
  id {{PK}},
  booking_id INTEGER NOT NULL UNIQUE,
  results TEXT NOT NULL,        -- JSON [{name, value, unit, low, high, ref_text, flag}]
  summary VARCHAR(1000),
  technician_id INTEGER,
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES test_bookings (id),
  FOREIGN KEY (technician_id) REFERENCES users (id)
);

-- ---------- Blood Bank ----------
CREATE TABLE IF NOT EXISTS blood_bank (
  id {{PK}},
  blood_group VARCHAR(3) NOT NULL UNIQUE,
  units INTEGER NOT NULL DEFAULT 0,
  updated_at VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS donors (
  id {{PK}},
  user_id INTEGER UNIQUE,
  name VARCHAR(120) NOT NULL,
  blood_group VARCHAR(3) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  dob VARCHAR(10) NOT NULL,
  weight_kg INTEGER NOT NULL,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(80) NOT NULL,
  last_donation_date VARCHAR(10),
  verified INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS donations (
  id {{PK}},
  donor_id INTEGER NOT NULL,
  donation_date VARCHAR(10) NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  recorded_by INTEGER,
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (donor_id) REFERENCES donors (id),
  FOREIGN KEY (recorded_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS blood_requests (
  id {{PK}},
  requested_by INTEGER NOT NULL,
  patient_name VARCHAR(120) NOT NULL,
  blood_group VARCHAR(3) NOT NULL,
  units INTEGER NOT NULL,
  hospital VARCHAR(160) NOT NULL,
  city VARCHAR(80) NOT NULL,
  urgency VARCHAR(10) NOT NULL DEFAULT 'urgent', -- normal | urgent | critical
  contact_phone VARCHAR(20) NOT NULL,
  notes VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | fulfilled | rejected
  admin_note VARCHAR(500),
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (requested_by) REFERENCES users (id)
);

-- ---------- Reminders & alerts ----------
CREATE TABLE IF NOT EXISTS notifications (
  id {{PK}},
  user_id INTEGER NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500),
  link VARCHAR(160),
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
