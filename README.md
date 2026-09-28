# Smart Health Connect

An AI-assisted doctor appointment, lab test booking and blood bank management system. One web app with four portals: **patients**, **doctors**, **lab technicians** and the **hospital admin**.

BCA first-year project, Vandna Kansal School of Sciences, CHRIST (Deemed to be University), Delhi NCR.

Screenshots of every portal are in `docs/screenshots/` for your report or slides.

---

## Run it in 3 steps

You need **Node.js 22.13 or newer** (the current LTS from [nodejs.org](https://nodejs.org) is fine). No database to install: it uses SQLite, which is built into Node.

```bash
npm install
npm start
```

Open **http://localhost:3000**. On first start the app creates `data/smart-health.db` and fills it with demo data.

### Demo accounts

Every demo account uses the password **`demo1234`**. On the login page, pick the tab and press **Use demo account**.

| Portal  | Email              | Who it is                                                            |
| ------- | ------------------ | -------------------------------------------------------------------- |
| Patient | `patient@demo.in`  | Ananya Verma, B+, Noida. Has appointments, reports and prescriptions |
| Doctor  | `doctor@demo.in`   | Dr. Rohit Malhotra, General Medicine, sees patients every day        |
| Lab     | `lab@demo.in`      | Neha Gupta, lab technician                                           |
| Admin   | `admin@demo.in`    | Hospital admin                                                       |

You can also sign up as a new patient from the login page.

### Useful commands

| Command        | What it does                                                       |
| -------------- | ------------------------------------------------------------------ |
| `npm start`    | Start the server on port 3000                                      |
| `npm run dev`  | Start and auto-restart when you edit server code                   |
| `npm run seed` | **Wipe** the database and load fresh demo data (do this before a demo) |
| `npm test`     | Run the end-to-end tests (uses a temporary database, never your real one) |

---

## What each module does (mapped to the project deck)

### 1. AI Health Assistant
A **rule-based** symptom checker, as planned in the deck (no external AI service, so it works offline and every answer can be explained).

- Patients type how they feel in English or Hinglish (`bukhar aur sar dard 2 din se`) or pick symptoms from a list, and add age, days unwell and severity.
- It understands 69 symptoms through 437 words and phrases, including Hinglish. It ignores symptoms the patient says they *don't* have ("cough, no fever"), and reads the duration from the text ("2 din se", "since yesterday", "ek hafte se").
- It returns: **urgency** (self-care, see a doctor in 1–2 days, today, or emergency), **possible causes** with a match %, **advice**, a **medicine category** (never doses), the **specialist department** with real doctors to book, and **lab tests** that can help.
- **Red-flag rules run first**: chest pain with sweating or breathlessness, stroke signs, seizures, fever with a stiff neck, blood in vomit or stool and more go straight to *Emergency: call 112 / 108*.
- Mentions of self-harm skip triage and show crisis support (Tele-MANAS 14416, 112).
- A "Why this result?" section lists every rule that fired, useful for your viva.
- Booking a doctor from a consult links the consult to the appointment, so the doctor sees the patient's own words.

The whole knowledge base is one readable file: `server/ai/knowledge.js`. The logic is in `server/ai/engine.js`.

### 2. Doctor appointments
- Search doctors by name or problem, filter by department, see fee, timings and ratings.
- Pick a date and a free slot; taken and past slots are disabled. Reschedule or cancel later.
- The doctor sees today's patients, the AI consult summary and earlier visits, writes the prescription (diagnosis, medicines, advice, follow-up) and completes the visit.
- The patient downloads the prescription as a PDF and rates the visit.
- **Automatic reminders**: every 15 minutes the server sends an in-app notification for appointments and tests happening today or tomorrow.
- Doctors set their own working days, hours and time per patient.

### 3. Lab / blood tests
- 13 tests with prices, sample type, preparation notes and reference ranges.
- Home sample collection or lab visit, with a date and a time window.
- The lab technician's queue moves each booking through **Booked → Sample collected → Processing → Report ready**. The patient is notified at each step.
- Entering results flags each value as low, normal or high as you type.
- Patients view reports online and download them as PDFs (made in the browser with jsPDF).

### 4. Blood bank
- **Live stock** by blood group, shown as test tubes; low stock (under 5 units) is highlighted.
- "Show groups I can receive" uses the red-cell compatibility table.
- **Donor search** by blood group and city, including compatible groups. Phone numbers stay hidden until the patient taps *Show number*.
- **Donor registration** with eligibility checks based on NBTC guidelines: age 18–65, at least 45 kg, 90 days between donations (120 for women).
- **Emergency blood requests** with urgency. The admin approves, rejects or fulfils them, and fulfilling takes the units out of stock automatically.

### Dashboards and health records
- **Patient**: home dashboard, all prescriptions and lab reports in one timeline.
- **Doctor**: day schedule, 7-day view, open visits to close, reviews.
- **Lab**: sample queue with counts.
- **Admin**: hospital overview; manage doctors, departments, lab tests and staff; blood stock, requests and donors; all appointments and lab bookings; feedback; AI consult logs.

Not built (listed as *future scope* in the deck): payment gateway, video consultation, insurance, and integration with outside hospitals.

---

## A 5-minute demo for the presentation

1. Run `npm run seed`, then `npm start`.
2. **Patient** (`patient@demo.in`): open *AI Health Assistant* and tap the example `bukhar aur sar dard 2 din se`. Then type `chest pain and sweating` to show the emergency path. Press **Book** under a recommended doctor and book a slot.
3. **Doctor** (`doctor@demo.in`): open Ananya Verma in today's list. She booked after an AI consult, so the consult summary is on the right. Write a prescription and press **Complete visit**, then download the PDF. (A visit can only be completed on or after its date, which is why the demo uses today's appointment.)
4. **Patient**: *Health records* now shows the prescription. Open the CBC report to show low values flagged in red.
5. **Lab** (`lab@demo.in`): mark a sample collected, press **Enter results**, and watch the flags change as you type.
6. **Admin** (`admin@demo.in`): *Requests*, fulfil the A+ request and watch the stock tube drop on *Blood stock*. On *Donors*, verify Rohan Sethi.

---

## How it is built

| Layer    | Technology                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------- |
| Frontend | HTML5, CSS3 and plain JavaScript (no framework), one page per portal, Poppins font                   |
| Backend  | Node.js with Express 5, a REST API under `/api`                                                     |
| Database | SQLite by default (built into Node); MySQL or MariaDB with one setting                              |
| AI       | Rule-based symptom mapping in JavaScript                                                            |
| PDFs     | jsPDF, in the browser                                                                               |
| Security | Passwords hashed with scrypt; signed login tokens (HMAC-SHA256, like a small JWT); role checks on every API route |

```
smart-health-connect/
├── server/
│   ├── index.js            Express app: API routes, static files, error handling
│   ├── config.js           Settings (reads .env)
│   ├── ai/
│   │   ├── knowledge.js    Symptoms, conditions, red flags, medicine categories
│   │   └── engine.js       The rule engine
│   ├── db/
│   │   ├── schema.sql      All 18 tables (works on SQLite and MySQL)
│   │   ├── index.js        Database adapter (SQLite / MySQL)
│   │   └── seed.js         Demo data
│   ├── routes/             auth, ai, appointments (+ doctors), lab, blood, admin (+ records)
│   ├── services/           Notifications, doctor slots, reminders
│   ├── middleware/auth.js  Login check and role check
│   └── utils/              Validation, dates, password hashing, tokens
├── public/
│   ├── index.html          Login and sign-up
│   ├── patient.html, doctor.html, lab.html, admin.html
│   ├── css/style.css
│   └── js/                 api.js, ui.js, shell.js, views.js, pdf.js + one file per portal
├── tests/api.test.js       End-to-end tests
└── docs/screenshots/       Screenshots of each portal
```

### Database tables

Every table named in the deck exists, with the same meaning:

| Deck name           | Table                  | Deck name        | Table              |
| ------------------- | ---------------------- | ---------------- | ------------------ |
| Patients            | `patients`             | LabTests         | `lab_tests`        |
| Doctors             | `doctors`              | TestBookings     | `test_bookings`    |
| Departments         | `departments`          | TestReports      | `test_reports`     |
| Admin               | `users` (role `admin`) | BloodBank        | `blood_bank`       |
| Appointments        | `appointments`         | Donors           | `donors`           |
| Prescriptions       | `prescriptions`        | BloodRequests    | `blood_requests`   |
| Feedback            | `feedback`             | Symptoms         | `symptoms`         |
| AIConsultLogs       | `ai_consult_logs`      | MedicineSuggestions | `medicine_suggestions` |

Three more tables support them: `users` (one login table for all four roles), `donations` (donation history) and `notifications` (reminders and updates).

---

## Using MySQL instead of SQLite

The same code runs on MySQL 8 or MariaDB 10.6+. The app creates the database and tables itself.

1. Copy `.env.example` to `.env`.
2. Set `DB_CLIENT=mysql` and your MySQL user and password.
3. `npm start`

`mysql2` is installed automatically by `npm install`. If it was skipped, run `npm install mysql2`. The test suite passes on both databases; to run it on MySQL use `TEST_DB_CLIENT=mysql npm test`, which uses a separate `shc_test` database.

---

## API reference

All endpoints are under `/api` and return JSON. Send the login token as `Authorization: Bearer <token>`. You can try them in Postman.

| Area          | Endpoints |
| ------------- | --------- |
| Auth          | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me`, `POST /auth/change-password`, `GET /auth/notifications`, `POST /auth/notifications/read` |
| AI            | `GET /ai/symptoms`, `POST /ai/consult`, `GET /ai/history` |
| Doctors       | `GET /doctors/departments`, `GET /doctors`, `GET /doctors/:id`, `GET /doctors/:id/slots?date=`, `PATCH /doctors/me/availability` |
| Appointments  | `POST /appointments`, `GET /appointments`, `GET /appointments/:id`, `PATCH /appointments/:id/reschedule`, `/cancel`, `/no-show`, `POST /appointments/:id/prescription`, `/feedback` |
| Lab           | `GET /lab/tests`, `GET /lab/slots`, `POST /lab/bookings`, `GET /lab/bookings`, `GET /lab/bookings/:id`, `PATCH /lab/bookings/:id/cancel`, `/status`, `POST /lab/bookings/:id/report` |
| Blood bank    | `GET/PATCH /blood/stock`, `GET /blood/donors`, `GET /blood/donors/:id/contact`, `GET/POST/PATCH /blood/me/donor`, `POST/GET /blood/requests`, `PATCH /blood/requests/:id`, `GET /blood/admin/donors`, `PATCH /blood/admin/donors/:id/verify`, `POST /blood/admin/donations` |
| Admin         | `GET /admin/stats`, `POST/PATCH /admin/departments`, `POST/PATCH /admin/doctors`, `POST/PATCH /admin/tests`, `GET /admin/users`, `POST /admin/staff`, `PATCH /admin/users/:id/active`, `GET /admin/feedback`, `GET /admin/ai-logs`, `GET /admin/knowledge` |
| Records       | `GET /records` (patient's prescriptions and reports) |

Example:

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"patient@demo.in","password":"demo1234"}'
```

---

## How the AI assistant decides (for the viva)

1. **Read the text.** Match symptom words and Hinglish phrases, longest phrase first. Skip any symptom with "no / not / without" before it or "nahi" after it. Read the duration ("3 din se").
2. **Red flags.** Nine rules are checked before anything else. Each can raise urgency to *today* or *emergency* and choose the department (for example, chest pain with sweating goes to emergency and Cardiology).
3. **Score conditions.** Each of the 28 conditions has weighted symptoms and some must-have symptoms. The score is 60% "how much of the condition's pattern is present" plus 40% "how much of the patient's symptoms it explains", halved if a symptom that argues against it is present. Anything under 35% is dropped, and the top 3 are shown.
4. **Adjust urgency.** Fever for 3+ days, cough for 2+ weeks (with a TB-test note), anything for 7+ days, or *severe* raises the level. Children under 14 are routed to Paediatrics.
5. **Answer.** Advice, a medicine category with cautions (never a dose), the department's top doctors, and lab tests from the catalogue. Every consult is saved in `ai_consult_logs` for the admin to review.

It is decision support, not diagnosis, and every answer says so.

---

## Troubleshooting

- **"Built-in SQLite needs Node.js 22.13 or newer"**: install the current LTS from nodejs.org, or use MySQL mode.
- **Port 3000 already in use**: `PORT=4000 npm start` (Mac/Linux) or set `PORT=4000` in `.env`.
- **Start over with clean demo data**: `npm run seed`.
- **Poppins font not showing**: it loads from Google Fonts. Offline, the app falls back to the system font and everything still works.
