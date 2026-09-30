// Doctor Appointment module:
// doctors list, free time slots, booking, cancel, reschedule,
// prescriptions and feedback.
const express = require('express');
const { data, save, nextId } = require('../database');
const { today, addDays, timeNow } = require('../helpers');
const { loginRequired } = require('./auth');

const router = express.Router();

// Every doctor sees patients at these times, Monday to Saturday.
const TIMES = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

// Takes away the password before sending a doctor to the browser,
// and adds the average rating from feedback.
function doctorForBrowser(doctor) {
  const { password, ...details } = doctor;
  const ratings = data.feedback.filter((f) => f.doctorId === doctor.id).map((f) => f.rating);
  let rating = null;
  if (ratings.length > 0) {
    rating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  }
  return { ...details, rating, reviews: ratings.length };
}

// GET /api/departments
router.get('/departments', loginRequired(), (req, res) => {
  res.json(data.departments);
});

// GET /api/doctors?specialization=Cardiologist
router.get('/doctors', loginRequired(), (req, res) => {
  let doctors = data.doctors;
  if (req.query.specialization) {
    doctors = doctors.filter((d) => d.specialization === req.query.specialization);
  }
  res.json(doctors.map(doctorForBrowser));
});

// GET /api/doctors/5/slots?date=2026-10-05
// Returns every time with booked: true/false
router.get('/doctors/:id/slots', loginRequired(), (req, res) => {
  const doctorId = Number(req.params.id);
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'Choose a date' });

  // Sunday is closed
  if (new Date(date + 'T00:00:00').getDay() === 0) return res.json([]);

  const slots = TIMES.map((time) => {
    const taken = data.appointments.some(
      (a) => a.doctorId === doctorId && a.date === date && a.time === time && a.status !== 'Cancelled'
    );
    const alreadyPassed = date === today() && time <= timeNow();
    return { time, booked: taken || alreadyPassed };
  });
  res.json(slots);
});

// Checks that a doctor is free at that date and time.
// Returns an error message, or null if the slot is fine.
function checkSlot(doctorId, date, time, ignoreAppointmentId) {
  if (!date || !time) return 'Choose a date and time';
  if (date < today()) return 'You cannot book a date in the past';
  if (date > addDays(today(), 30)) return 'You can book up to 30 days ahead';
  if (!TIMES.includes(time)) return 'The doctor is not available at that time';
  if (new Date(date + 'T00:00:00').getDay() === 0) return 'The hospital is closed on Sunday';
  if (date === today() && time <= timeNow()) return 'That time has already passed';
  const taken = data.appointments.some(
    (a) => a.id !== ignoreAppointmentId && a.doctorId === doctorId && a.date === date && a.time === time && a.status !== 'Cancelled'
  );
  if (taken) return 'Sorry, this slot was just booked. Please pick another time.';
  return null;
}

// POST /api/appointments   body: { doctorId, date, time, reason }
router.post('/appointments', loginRequired('patient'), (req, res) => {
  const doctorId = Number(req.body.doctorId);
  const doctor = data.doctors.find((d) => d.id === doctorId);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const problem = checkSlot(doctorId, req.body.date, req.body.time);
  if (problem) return res.status(400).json({ error: problem });

  const appointment = {
    id: nextId(data.appointments),
    patientId: req.user.id,
    doctorId,
    date: req.body.date,
    time: req.body.time,
    reason: req.body.reason || '',
    status: 'Booked',
  };
  data.appointments.push(appointment);
  save();
  res.json(appointment);
});

// GET /api/appointments
// Patient: their own. Doctor: their own patients. Admin: everything.
// Each appointment also carries names, the prescription and the feedback.
router.get('/appointments', loginRequired(), (req, res) => {
  let list = data.appointments;
  if (req.user.role === 'patient') list = list.filter((a) => a.patientId === req.user.id);
  if (req.user.role === 'doctor') list = list.filter((a) => a.doctorId === req.user.id);

  const result = list.map((a) => {
    const patient = data.patients.find((p) => p.id === a.patientId) || {};
    const doctor = data.doctors.find((d) => d.id === a.doctorId) || {};
    return {
      ...a,
      patientName: patient.name,
      patientGender: patient.gender,
      patientDob: patient.dob,
      patientPhone: patient.phone,
      doctorName: doctor.name,
      specialization: doctor.specialization,
      fee: doctor.fee,
      prescription: data.prescriptions.find((p) => p.appointmentId === a.id) || null,
      feedback: data.feedback.find((f) => f.appointmentId === a.id) || null,
    };
  });

  // Sort by date and time
  result.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  res.json(result);
});

// Finds an appointment and checks this user is allowed to change it
function findMyAppointment(req, res) {
  const appointment = data.appointments.find((a) => a.id === Number(req.params.id));
  const isMine =
    appointment &&
    (req.user.role === 'admin' ||
      (req.user.role === 'patient' && appointment.patientId === req.user.id) ||
      (req.user.role === 'doctor' && appointment.doctorId === req.user.id));
  if (!isMine) {
    res.status(404).json({ error: 'Appointment not found' });
    return null;
  }
  return appointment;
}

// PUT /api/appointments/7/cancel
router.put('/appointments/:id/cancel', loginRequired(), (req, res) => {
  const appointment = findMyAppointment(req, res);
  if (!appointment) return;
  if (appointment.status !== 'Booked') {
    return res.status(400).json({ error: 'Only booked appointments can be cancelled' });
  }
  appointment.status = 'Cancelled';
  save();
  res.json(appointment);
});

// PUT /api/appointments/7/reschedule   body: { date, time }
router.put('/appointments/:id/reschedule', loginRequired('patient'), (req, res) => {
  const appointment = findMyAppointment(req, res);
  if (!appointment) return;
  if (appointment.status !== 'Booked') {
    return res.status(400).json({ error: 'Only booked appointments can be rescheduled' });
  }
  const problem = checkSlot(appointment.doctorId, req.body.date, req.body.time, appointment.id);
  if (problem) return res.status(400).json({ error: problem });

  appointment.date = req.body.date;
  appointment.time = req.body.time;
  save();
  res.json(appointment);
});

// POST /api/appointments/7/prescription   body: { diagnosis, medicines: [...], advice }
// The doctor writes the prescription and the visit becomes "Completed".
router.post('/appointments/:id/prescription', loginRequired('doctor'), (req, res) => {
  const appointment = findMyAppointment(req, res);
  if (!appointment) return;
  if (appointment.status !== 'Booked') {
    return res.status(400).json({ error: 'This appointment is already closed' });
  }
  if (appointment.date > today()) {
    return res.status(400).json({ error: 'You can complete a visit only on or after its date' });
  }
  if (!req.body.diagnosis) {
    return res.status(400).json({ error: 'Please write the diagnosis' });
  }

  const prescription = {
    id: nextId(data.prescriptions),
    appointmentId: appointment.id,
    diagnosis: req.body.diagnosis,
    medicines: (req.body.medicines || []).filter((m) => m.trim() !== ''),
    advice: req.body.advice || '',
    date: today(),
  };
  data.prescriptions.push(prescription);
  appointment.status = 'Completed';
  save();
  res.json(prescription);
});

// POST /api/appointments/7/feedback   body: { rating, comment }
router.post('/appointments/:id/feedback', loginRequired('patient'), (req, res) => {
  const appointment = findMyAppointment(req, res);
  if (!appointment) return;
  if (appointment.status !== 'Completed') {
    return res.status(400).json({ error: 'You can rate a visit after it is completed' });
  }
  if (data.feedback.some((f) => f.appointmentId === appointment.id)) {
    return res.status(400).json({ error: 'You have already rated this visit' });
  }
  const rating = Number(req.body.rating);
  if (!(rating >= 1 && rating <= 5)) {
    return res.status(400).json({ error: 'Rating must be from 1 to 5' });
  }
  const feedback = {
    id: nextId(data.feedback),
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    rating,
    comment: req.body.comment || '',
  };
  data.feedback.push(feedback);
  save();
  res.json(feedback);
});

module.exports = router;
module.exports.doctorForBrowser = doctorForBrowser;
