// Sample data for the demo. It is used only the first time the server starts
// (or after "npm run reset"). Every demo account uses the password: demo1234
const { hashPassword, today, addDays } = require('./helpers');

function createSampleData() {
  const t = today();
  const password = hashPassword('demo1234');

  const data = {
    departments: [
      { id: 1, name: 'General Physician', description: 'Fever, infections and general check-ups' },
      { id: 2, name: 'Cardiologist', description: 'Heart and blood pressure' },
      { id: 3, name: 'Dermatologist', description: 'Skin, hair and nails' },
      { id: 4, name: 'ENT Specialist', description: 'Ear, nose and throat' },
      { id: 5, name: 'Gastroenterologist', description: 'Stomach and digestion' },
      { id: 6, name: 'Neurologist', description: 'Brain, nerves and headaches' },
      { id: 7, name: 'Orthopaedic', description: 'Bones and joints' },
      { id: 8, name: 'Paediatrician', description: 'Children' },
      { id: 9, name: 'Gynaecologist', description: "Women's health" },
    ],

    patients: [
      { id: 1, name: 'Ananya Verma', email: 'patient@demo.in', password, phone: '9876543210', gender: 'Female', dob: '2004-03-12', bloodGroup: 'B+', city: 'Noida', joinedOn: addDays(t, -20) },
      { id: 2, name: 'Rahul Khanna', email: 'rahul@demo.in', password, phone: '9899011122', gender: 'Male', dob: '1988-07-02', bloodGroup: 'O+', city: 'Delhi', joinedOn: addDays(t, -15) },
      { id: 3, name: 'Sunita Devi', email: 'sunita@demo.in', password, phone: '9811223344', gender: 'Female', dob: '1966-01-20', bloodGroup: 'A+', city: 'Noida', joinedOn: addDays(t, -12) },
      { id: 4, name: 'Mohammed Imran', email: 'imran@demo.in', password, phone: '9810055667', gender: 'Male', dob: '1995-11-08', bloodGroup: 'B-', city: 'Ghaziabad', joinedOn: addDays(t, -6) },
      { id: 5, name: 'Pooja Sharma', email: 'pooja@demo.in', password, phone: '9958123456', gender: 'Female', dob: '2001-05-30', bloodGroup: 'AB+', city: 'Noida', joinedOn: addDays(t, -3) },
    ],

    doctors: [
      { id: 1, name: 'Dr. Rohit Malhotra', email: 'doctor@demo.in', password, specialization: 'General Physician', qualification: 'MBBS, MD', experience: 12, fee: 500, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 2, name: 'Dr. Kavita Rao', email: 'kavita@demo.in', password, specialization: 'General Physician', qualification: 'MBBS', experience: 8, fee: 400, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 3, name: 'Dr. Arjun Iyer', email: 'arjun@demo.in', password, specialization: 'Cardiologist', qualification: 'MBBS, MD, DM', experience: 18, fee: 1000, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 4, name: 'Dr. Meera Kapoor', email: 'meera@demo.in', password, specialization: 'Dermatologist', qualification: 'MBBS, MD', experience: 10, fee: 700, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 5, name: 'Dr. Sanjay Bhatia', email: 'sanjay@demo.in', password, specialization: 'ENT Specialist', qualification: 'MBBS, MS', experience: 15, fee: 600, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 6, name: 'Dr. Farhan Qureshi', email: 'farhan@demo.in', password, specialization: 'Gastroenterologist', qualification: 'MBBS, MD, DM', experience: 14, fee: 900, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 7, name: 'Dr. Priya Nair', email: 'priya@demo.in', password, specialization: 'Neurologist', qualification: 'MBBS, MD, DM', experience: 11, fee: 1000, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 8, name: 'Dr. Vikram Singh', email: 'vikram@demo.in', password, specialization: 'Orthopaedic', qualification: 'MBBS, MS', experience: 16, fee: 800, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 9, name: 'Dr. Neha Joshi', email: 'neha@demo.in', password, specialization: 'Paediatrician', qualification: 'MBBS, MD', experience: 9, fee: 600, timings: 'Mon–Sat, 10 AM – 5 PM' },
      { id: 10, name: 'Dr. Shalini Gupta', email: 'shalini@demo.in', password, specialization: 'Gynaecologist', qualification: 'MBBS, MS', experience: 13, fee: 700, timings: 'Mon–Sat, 10 AM – 5 PM' },
    ],

    admins: [{ id: 1, name: 'Hospital Admin', email: 'admin@demo.in', password }],

    // status can be: Booked, Completed, Cancelled
    appointments: [
      { id: 1, patientId: 1, doctorId: 1, date: t, time: '10:00', reason: 'AI check: Fever, Headache, Body ache (Viral Fever)', status: 'Booked' },
      { id: 2, patientId: 2, doctorId: 1, date: t, time: '11:00', reason: 'Blood pressure follow-up', status: 'Booked' },
      { id: 3, patientId: 3, doctorId: 1, date: t, time: '12:00', reason: 'Knee pain and tiredness', status: 'Booked' },
      { id: 4, patientId: 1, doctorId: 4, date: addDays(t, -8), time: '11:30', reason: 'Itchy rash on arm', status: 'Completed' },
      { id: 5, patientId: 5, doctorId: 1, date: addDays(t, -5), time: '10:30', reason: 'Sore throat and cold', status: 'Completed' },
      { id: 6, patientId: 1, doctorId: 4, date: addDays(t, 2), time: '12:30', reason: 'Follow-up for skin rash', status: 'Booked' },
    ],

    prescriptions: [
      { id: 1, appointmentId: 4, diagnosis: 'Fungal skin infection (ringworm)', medicines: ['Clotrimazole cream - apply twice a day - 2 weeks', 'Cetirizine 10 mg - at night - 5 days'], advice: 'Keep the area dry. Do not share towels.', date: addDays(t, -8) },
      { id: 2, appointmentId: 5, diagnosis: 'Viral throat infection', medicines: ['Paracetamol 500 mg - if fever - 3 days', 'Warm salt water gargles - 3 times a day'], advice: 'Drink warm fluids and rest.', date: addDays(t, -5) },
    ],

    feedback: [
      { id: 1, appointmentId: 4, patientId: 1, doctorId: 4, rating: 5, comment: 'Explained everything clearly.' },
      { id: 2, appointmentId: 5, patientId: 5, doctorId: 1, rating: 4, comment: 'Good consultation, short wait.' },
    ],

    // Each test has parameters with a normal range (min to max),
    // or a normal text result (for example "Negative").
    labTests: [
      { id: 1, name: 'Complete Blood Count (CBC)', price: 350, homeCollection: true, preparation: 'No fasting needed', parameters: [
        { name: 'Haemoglobin', unit: 'g/dL', min: 12, max: 17 },
        { name: 'WBC count', unit: '/cumm', min: 4000, max: 11000 },
        { name: 'Platelet count', unit: '/cumm', min: 150000, max: 450000 },
      ] },
      { id: 2, name: 'Blood Sugar (Fasting)', price: 100, homeCollection: true, preparation: '8–10 hours fasting', parameters: [
        { name: 'Fasting glucose', unit: 'mg/dL', min: 70, max: 100 },
      ] },
      { id: 3, name: 'Lipid Profile', price: 600, homeCollection: true, preparation: '10–12 hours fasting', parameters: [
        { name: 'Total cholesterol', unit: 'mg/dL', min: 0, max: 200 },
        { name: 'HDL cholesterol', unit: 'mg/dL', min: 40, max: 60 },
        { name: 'LDL cholesterol', unit: 'mg/dL', min: 0, max: 100 },
      ] },
      { id: 4, name: 'Thyroid Profile', price: 550, homeCollection: true, preparation: 'No fasting needed', parameters: [
        { name: 'T3', unit: 'ng/dL', min: 80, max: 200 },
        { name: 'T4', unit: 'ug/dL', min: 5, max: 12 },
        { name: 'TSH', unit: 'uIU/mL', min: 0.4, max: 4 },
      ] },
      { id: 5, name: 'Vitamin D', price: 1200, homeCollection: true, preparation: 'No fasting needed', parameters: [
        { name: 'Vitamin D', unit: 'ng/mL', min: 30, max: 100 },
      ] },
      { id: 6, name: 'Dengue NS1 Test', price: 800, homeCollection: true, preparation: 'No fasting needed', parameters: [
        { name: 'Dengue NS1', unit: '', normal: 'Negative' },
      ] },
      { id: 7, name: 'Malaria Test', price: 400, homeCollection: false, preparation: 'Lab visit needed', parameters: [
        { name: 'Malaria antigen', unit: '', normal: 'Negative' },
      ] },
      { id: 8, name: 'Urine Routine', price: 200, homeCollection: false, preparation: 'Early morning sample', parameters: [
        { name: 'Pus cells', unit: '/hpf', min: 0, max: 5 },
        { name: 'Sugar', unit: '', normal: 'Nil' },
      ] },
    ],

    // status can be: Booked, Sample Collected, Report Ready, Cancelled
    testBookings: [
      { id: 1, patientId: 1, testId: 1, date: addDays(t, -10), timeSlot: '8 AM – 10 AM', collection: 'Home', address: 'B-12, Sector 62, Noida', status: 'Report Ready' },
      { id: 2, patientId: 1, testId: 4, date: addDays(t, 1), timeSlot: '8 AM – 10 AM', collection: 'Home', address: 'B-12, Sector 62, Noida', status: 'Booked' },
      { id: 3, patientId: 4, testId: 6, date: t, timeSlot: '10 AM – 12 PM', collection: 'Lab', address: '', status: 'Booked' },
      { id: 4, patientId: 2, testId: 3, date: addDays(t, -1), timeSlot: '8 AM – 10 AM', collection: 'Home', address: 'C-45, Lajpat Nagar, Delhi', status: 'Sample Collected' },
    ],

    testReports: [
      { id: 1, bookingId: 1, date: addDays(t, -9), results: [
        { name: 'Haemoglobin', unit: 'g/dL', value: '11.2', range: '12 – 17', flag: 'Low' },
        { name: 'WBC count', unit: '/cumm', value: '7200', range: '4000 – 11000', flag: 'Normal' },
        { name: 'Platelet count', unit: '/cumm', value: '245000', range: '150000 – 450000', flag: 'Normal' },
      ], remarks: 'Haemoglobin is slightly low. Please discuss with your doctor.' },
    ],

    // Units of blood available for each blood group
    bloodBank: [
      { group: 'A+', units: 18 }, { group: 'A-', units: 4 },
      { group: 'B+', units: 22 }, { group: 'B-', units: 3 },
      { group: 'AB+', units: 9 }, { group: 'AB-', units: 2 },
      { group: 'O+', units: 25 }, { group: 'O-', units: 6 },
    ],

    donors: [
      { id: 1, name: 'Rakesh Tyagi', bloodGroup: 'B-', city: 'Noida', phone: '9811100121', age: 34, weight: 72, lastDonation: '', verified: true },
      { id: 2, name: 'Aditya Rawat', bloodGroup: 'O-', city: 'Noida', phone: '9811100122', age: 27, weight: 68, lastDonation: addDays(t, -200), verified: true },
      { id: 3, name: 'Tanvi Arora', bloodGroup: 'O+', city: 'Noida', phone: '9811100123', age: 24, weight: 55, lastDonation: '', verified: true },
      { id: 4, name: 'Lakshmi Pillai', bloodGroup: 'B+', city: 'Noida', phone: '9811100124', age: 41, weight: 60, lastDonation: addDays(t, -30), verified: true },
      { id: 5, name: 'Harpreet Singh', bloodGroup: 'A+', city: 'Delhi', phone: '9811100125', age: 38, weight: 80, lastDonation: '', verified: true },
      { id: 6, name: 'Sneha Menon', bloodGroup: 'AB+', city: 'Delhi', phone: '9811100126', age: 29, weight: 52, lastDonation: addDays(t, -150), verified: true },
      { id: 7, name: 'Vivek Chauhan', bloodGroup: 'A-', city: 'Ghaziabad', phone: '9811100127', age: 45, weight: 77, lastDonation: '', verified: true },
      { id: 8, name: 'Kiran Joshi', bloodGroup: 'O+', city: 'Gurugram', phone: '9811100144', age: 34, weight: 57, lastDonation: '', verified: false },
      { id: 9, name: 'Rohan Sethi', bloodGroup: 'B-', city: 'Noida', phone: '9811100133', age: 26, weight: 74, lastDonation: '', verified: false },
    ],

    // status can be: Pending, Approved, Fulfilled, Rejected
    bloodRequests: [
      { id: 1, patientName: 'Shabana Begum', bloodGroup: 'B-', units: 2, hospital: 'Metro Care Hospital, Noida', phone: '9810099999', urgency: 'Critical', status: 'Pending', date: t },
      { id: 2, patientName: 'Ramesh Kumar', bloodGroup: 'A+', units: 1, hospital: 'Sunrise Hospital, Delhi', phone: '9810088888', urgency: 'Urgent', status: 'Approved', date: addDays(t, -1) },
    ],

    aiConsultLogs: [
      { id: 1, patientId: 1, date: t, symptoms: ['Fever', 'Headache', 'Body ache'], result: 'Viral Fever', urgency: 'See a doctor in 1–2 days' },
    ],
  };

  return data;
}

module.exports = createSampleData;
