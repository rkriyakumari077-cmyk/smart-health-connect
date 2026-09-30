# Smart Health Connect

AI-assisted doctor appointment, lab test booking and blood bank management system.
BCA First Year project, CHRIST (Deemed to be University), Delhi NCR.

**Made with:** HTML, CSS, JavaScript (frontend) · Node.js + Express (backend) · JSON file database · jsPDF (PDF downloads)

---

## How to run

You need **Node.js** (download the LTS version from nodejs.org).

```
npm install
npm start
```

Open **http://localhost:3000** in your browser.

### Demo accounts (password for all: `demo1234`)

| Login tab | Email | Who |
| --- | --- | --- |
| Patient | patient@demo.in | Ananya Verma |
| Doctor | doctor@demo.in | Dr. Rohit Malhotra (General Physician) |
| Admin | admin@demo.in | Hospital Admin (also handles the lab) |

On the login page, choose the tab and click **Fill demo account**.

### Start again with fresh demo data

```
npm run reset
npm start
```

---

## Modules

| Module | What it does |
| --- | --- |
| **AI Health Assistant** | Patient types symptoms (English or Hinglish, e.g. "bukhar aur sar dard 2 din se") or ticks them. The rules find possible causes, urgency (Home care / See a doctor in 1–2 days / See a doctor today / Emergency), advice, medicine category, the right specialist and helpful tests. Every check is saved in the AI consult logs. |
| **Doctor Appointments** | Search doctors by speciality, choose a date and free time slot, book, reschedule or cancel. The doctor writes the prescription and completes the visit. The patient downloads the prescription as PDF and rates the visit. Reminders show on the patient's home page for today and tomorrow. |
| **Lab Tests** | Book a test with home collection or a lab visit. The admin marks the sample collected and enters the results. Values outside the normal range are flagged Low / High. The patient views and downloads the report as PDF. |
| **Blood Bank** | Live blood stock for every group, donor search (with compatible groups), emergency blood requests, donor registration with eligibility rules (age 18–65, weight 45 kg+, 90 days since last donation). The admin verifies donors, records donations and fulfils requests (stock updates automatically). |
| **Admin Panel** | Dashboard numbers, add/remove doctors and lab tests, lab reports, blood stock, requests, donors, AI logs and feedback. |
| **Health Records** | All prescriptions and lab reports of a patient in one place. |

---

## Project files (and who explains what)

```
smart-health-connect/
├── server.js            starts the server, connects all routes         (Member 3)
├── database.js          reads and saves data/database.json             (Member 3)
├── seed.js              sample data for the demo                       (Member 3)
├── helpers.js           password hashing and date functions            (Member 3)
├── reset.js             deletes the database for a fresh start
├── routes/              the backend (API)
│   ├── auth.js          login, sign up, logout, login check            (Member 1)
│   ├── ai.js            saves AI consult logs                          (Member 1)
│   ├── appointments.js  doctors, slots, booking, prescriptions         (Member 2)
│   ├── lab.js           lab tests, bookings, reports                   (Member 2)
│   ├── blood.js         blood stock, donors, blood requests            (Member 3)
│   └── admin.js         dashboard, add doctors and tests, feedback     (Member 3)
└── public/              the frontend (what the browser shows)
    ├── css/style.css    all the styling                                (everyone)
    ├── js/common.js     functions used by every page                   (everyone)
    ├── index.html       + js/login.js            login and sign up     (Member 1)
    ├── patient-home.html + js/patient-home.js    home and reminders    (Member 1)
    ├── ai-assistant.html + js/ai-assistant.js    AI assistant page     (Member 1)
    │                     + js/ai-rules.js        the AI rules          (Member 1)
    ├── health-records.html + js/health-records.js                      (Member 1)
    ├── doctors.html      + js/doctors.js         find and book doctor  (Member 2)
    ├── my-appointments.html + js/my-appointments.js                    (Member 2)
    ├── doctor.html       + js/doctor.js          doctor's page         (Member 2)
    ├── lab-tests.html    + js/lab-tests.js       book lab tests        (Member 2)
    ├── js/pdf.js         makes prescription and report PDFs            (Member 2)
    ├── blood-bank.html   + js/blood-bank.js      blood bank page       (Member 3)
    └── admin.html        + js/admin.js           admin panel           (Member 3)
```

---

## How it works

1. The browser opens a page, for example `doctors.html`.
2. The page's JavaScript asks the backend for data with `fetch`, for example `GET /api/doctors` (see `api()` in `common.js`).
3. The backend route (`routes/appointments.js`) reads the data from the database and sends it back as JSON.
4. The page shows it using HTML.

**Login:** passwords are saved as a SHA-256 hash, never as plain text. After login the server gives a token, the browser saves it in `localStorage` and sends it with every request. The `loginRequired()` function in `routes/auth.js` checks the token and the role (patient, doctor or admin).

**Database:** `data/database.json` is created on the first start. It has one list for each table from our design:

| Table in our design | List in database.json |
| --- | --- |
| Patients, Doctors, Admin | `patients`, `doctors`, `admins` |
| Departments | `departments` |
| Appointments, Prescriptions, Feedback | `appointments`, `prescriptions`, `feedback` |
| LabTests, TestBookings, TestReports | `labTests`, `testBookings`, `testReports` |
| BloodBank, Donors, BloodRequests | `bloodBank`, `donors`, `bloodRequests` |
| AIConsultLogs | `aiConsultLogs` |
| Symptoms, MedicineSuggestions | written as rules in `public/js/ai-rules.js` |

**AI Health Assistant** (`public/js/ai-rules.js`) is rule-based:
1. Find symptoms in the text by matching words from the `SYMPTOMS` list.
2. For each condition, calculate what percentage of its symptoms the patient has. The highest one is the best match.
3. Check the `RED_FLAGS` (like chest pain with sweating). They can raise the urgency to "See a doctor today" or "Emergency".
4. Symptoms for 3 days or more → at least "See a doctor in 1–2 days". Age under 12 → Paediatrician.

---

## API (backend routes)

| Method | URL | Who | What |
| --- | --- | --- | --- |
| POST | /api/login, /api/signup, /api/logout | all | login, sign up, logout |
| GET | /api/me | all | my details |
| GET / POST | /api/ai-logs | patient, admin | AI consult logs |
| GET | /api/departments, /api/doctors | all | doctors list |
| GET | /api/doctors/:id/slots?date= | all | free time slots |
| GET / POST | /api/appointments | all / patient | list, book |
| PUT | /api/appointments/:id/cancel, /reschedule | patient, doctor | cancel, reschedule |
| POST | /api/appointments/:id/prescription | doctor | write prescription |
| POST | /api/appointments/:id/feedback | patient | rate the visit |
| GET | /api/lab-tests, /api/lab-time-slots | all | tests and times |
| GET / POST | /api/test-bookings | patient, admin | list, book a test |
| PUT | /api/test-bookings/:id/cancel, /collected | patient, admin | cancel, sample collected |
| POST | /api/test-bookings/:id/report | admin | enter results |
| GET / PUT | /api/blood-stock | all / admin | stock |
| GET / POST | /api/donors, GET /api/my-donor | all / patient | donors |
| PUT | /api/donors/:id/verify, /donated | admin | verify, record donation |
| GET / POST / PUT | /api/blood-requests | patient, admin | emergency requests |
| GET | /api/stats, /api/feedback | admin | dashboard |
| POST / DELETE | /api/doctors, /api/lab-tests | admin | add or remove |

---

## Future scope

Online payment, video consultation, insurance, and connecting with other hospitals.
