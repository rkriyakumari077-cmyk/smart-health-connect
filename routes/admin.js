// Admin module: dashboard numbers, adding/removing doctors and lab tests,
// and reading patient feedback.
const express = require('express');
const { data, save, nextId } = require('../database');
const { today, hashPassword } = require('../helpers');
const { loginRequired } = require('./auth');
const { doctorForBrowser } = require('./appointments');

const router = express.Router();

// GET /api/stats - numbers for the admin dashboard
router.get('/stats', loginRequired('admin'), (req, res) => {
  res.json({
    patients: data.patients.length,
    doctors: data.doctors.length,
    appointmentsToday: data.appointments.filter((a) => a.date === today() && a.status !== 'Cancelled').length,
    testsPending: data.testBookings.filter((b) => b.status === 'Booked' || b.status === 'Sample Collected').length,
    bloodUnits: data.bloodBank.reduce((total, b) => total + b.units, 0),
    lowStock: data.bloodBank.filter((b) => b.units < 5).map((b) => b.group),
    openRequests: data.bloodRequests.filter((r) => r.status === 'Pending' || r.status === 'Approved').length,
    donorsToVerify: data.donors.filter((d) => !d.verified).length,
    aiConsults: data.aiConsultLogs.length,
  });
});

// POST /api/doctors - admin adds a doctor (the doctor can log in with this email)
router.post('/doctors', loginRequired('admin'), (req, res) => {
  const { name, email, password, specialization, qualification, experience, fee } = req.body;
  if (!name || !email || !password || !specialization) {
    return res.status(400).json({ error: 'Name, email, password and specialization are required' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (data.doctors.some((d) => d.email === cleanEmail)) {
    return res.status(400).json({ error: 'A doctor with this email already exists' });
  }
  const doctor = {
    id: nextId(data.doctors),
    name,
    email: cleanEmail,
    password: hashPassword(password),
    specialization,
    qualification: qualification || '',
    experience: Number(experience) || 0,
    fee: Number(fee) || 500,
    timings: 'Mon–Sat, 10 AM – 5 PM',
  };
  data.doctors.push(doctor);
  save();
  res.json(doctorForBrowser(doctor));
});

// DELETE /api/doctors/3 - admin removes a doctor (only if no upcoming appointments)
router.delete('/doctors/:id', loginRequired('admin'), (req, res) => {
  const id = Number(req.params.id);
  const hasUpcoming = data.appointments.some((a) => a.doctorId === id && a.status === 'Booked');
  if (hasUpcoming) {
    return res.status(400).json({ error: 'This doctor has booked appointments. Cancel them first.' });
  }
  const index = data.doctors.findIndex((d) => d.id === id);
  if (index === -1) return res.status(404).json({ error: 'Doctor not found' });
  data.doctors.splice(index, 1);
  save();
  res.json({ message: 'Doctor removed' });
});

// POST /api/lab-tests - admin adds a lab test with one parameter
router.post('/lab-tests', loginRequired('admin'), (req, res) => {
  const { name, price, parameterName, unit, min, max, homeCollection } = req.body;
  if (!name || !price || !parameterName || min === '' || max === '') {
    return res.status(400).json({ error: 'Please fill in the test name, price and normal range' });
  }
  const test = {
    id: nextId(data.labTests),
    name,
    price: Number(price),
    homeCollection: Boolean(homeCollection),
    preparation: req.body.preparation || 'No special preparation',
    parameters: [{ name: parameterName, unit: unit || '', min: Number(min), max: Number(max) }],
  };
  data.labTests.push(test);
  save();
  res.json(test);
});

// DELETE /api/lab-tests/4
router.delete('/lab-tests/:id', loginRequired('admin'), (req, res) => {
  const id = Number(req.params.id);
  const index = data.labTests.findIndex((t) => t.id === id);
  if (index === -1) return res.status(404).json({ error: 'Test not found' });
  if (data.testBookings.some((b) => b.testId === id && b.status !== 'Report Ready' && b.status !== 'Cancelled')) {
    return res.status(400).json({ error: 'This test has open bookings' });
  }
  data.labTests.splice(index, 1);
  save();
  res.json({ message: 'Test removed' });
});

// GET /api/feedback - all feedback with names (admin)
router.get('/feedback', loginRequired('admin'), (req, res) => {
  const result = data.feedback.map((f) => {
    const patient = data.patients.find((p) => p.id === f.patientId) || {};
    const doctor = data.doctors.find((d) => d.id === f.doctorId) || {};
    return { ...f, patientName: patient.name, doctorName: doctor.name };
  });
  res.json(result.reverse());
});

module.exports = router;
