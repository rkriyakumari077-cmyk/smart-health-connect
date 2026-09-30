// Lab / Blood Test module:
// test list, booking a test, sample collection and reports.
const express = require('express');
const { data, save, nextId } = require('../database');
const { today, addDays } = require('../helpers');
const { loginRequired } = require('./auth');

const router = express.Router();

const TIME_SLOTS = ['8 AM – 10 AM', '10 AM – 12 PM', '12 PM – 2 PM', '4 PM – 6 PM'];

// GET /api/lab-tests
router.get('/lab-tests', loginRequired(), (req, res) => {
  res.json(data.labTests);
});

// GET /api/lab-time-slots
router.get('/lab-time-slots', loginRequired(), (req, res) => {
  res.json(TIME_SLOTS);
});

// POST /api/test-bookings   body: { testId, date, timeSlot, collection, address }
router.post('/test-bookings', loginRequired('patient'), (req, res) => {
  const { date, timeSlot, collection, address } = req.body;
  const test = data.labTests.find((t) => t.id === Number(req.body.testId));
  if (!test) return res.status(404).json({ error: 'Test not found' });
  if (!date || date < today()) return res.status(400).json({ error: 'Choose today or a future date' });
  if (date > addDays(today(), 30)) return res.status(400).json({ error: 'You can book up to 30 days ahead' });
  if (!TIME_SLOTS.includes(timeSlot)) return res.status(400).json({ error: 'Choose a time slot' });
  if (collection !== 'Home' && collection !== 'Lab') return res.status(400).json({ error: 'Choose home collection or lab visit' });
  if (collection === 'Home' && !test.homeCollection) {
    return res.status(400).json({ error: test.name + ' needs a lab visit' });
  }
  if (collection === 'Home' && !address) {
    return res.status(400).json({ error: 'Please enter your address for home collection' });
  }

  const booking = {
    id: nextId(data.testBookings),
    patientId: req.user.id,
    testId: test.id,
    date,
    timeSlot,
    collection,
    address: collection === 'Home' ? address : '',
    status: 'Booked',
  };
  data.testBookings.push(booking);
  save();
  res.json(booking);
});

// GET /api/test-bookings - patients see their own, the admin sees all.
// Each booking also carries the test, patient name and the report.
router.get('/test-bookings', loginRequired('patient', 'admin'), (req, res) => {
  let list = data.testBookings;
  if (req.user.role === 'patient') list = list.filter((b) => b.patientId === req.user.id);

  const result = list.map((b) => {
    const patient = data.patients.find((p) => p.id === b.patientId) || {};
    return {
      ...b,
      test: data.labTests.find((t) => t.id === b.testId),
      patientName: patient.name,
      patientGender: patient.gender,
      patientDob: patient.dob,
      report: data.testReports.find((r) => r.bookingId === b.id) || null,
    };
  });
  result.sort((x, y) => y.date.localeCompare(x.date)); // newest first
  res.json(result);
});

// PUT /api/test-bookings/3/cancel
router.put('/test-bookings/:id/cancel', loginRequired('patient', 'admin'), (req, res) => {
  const booking = data.testBookings.find((b) => b.id === Number(req.params.id));
  if (!booking || (req.user.role === 'patient' && booking.patientId !== req.user.id)) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.status !== 'Booked') {
    return res.status(400).json({ error: 'The sample is already collected, so it cannot be cancelled' });
  }
  booking.status = 'Cancelled';
  save();
  res.json(booking);
});

// PUT /api/test-bookings/3/collected - admin marks the sample as collected
router.put('/test-bookings/:id/collected', loginRequired('admin'), (req, res) => {
  const booking = data.testBookings.find((b) => b.id === Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'Booked') return res.status(400).json({ error: 'This booking is not waiting for collection' });
  booking.status = 'Sample Collected';
  save();
  res.json(booking);
});

// Compares a result with the normal range and gives: Low, High, Normal or Abnormal
function getFlag(parameter, value) {
  if (parameter.normal) {
    return value.toLowerCase() === parameter.normal.toLowerCase() ? 'Normal' : 'Abnormal';
  }
  const number = Number(value);
  if (number < parameter.min) return 'Low';
  if (number > parameter.max) return 'High';
  return 'Normal';
}

// POST /api/test-bookings/3/report   body: { values: { "Haemoglobin": "11.2", ... }, remarks }
router.post('/test-bookings/:id/report', loginRequired('admin'), (req, res) => {
  const booking = data.testBookings.find((b) => b.id === Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'Sample Collected') {
    return res.status(400).json({ error: 'Mark the sample as collected first' });
  }

  const test = data.labTests.find((t) => t.id === booking.testId);
  const values = req.body.values || {};
  const results = [];

  for (const parameter of test.parameters) {
    const value = String(values[parameter.name] || '').trim();
    if (value === '') {
      return res.status(400).json({ error: 'Please enter a value for ' + parameter.name });
    }
    if (!parameter.normal && isNaN(Number(value))) {
      return res.status(400).json({ error: parameter.name + ' must be a number' });
    }
    results.push({
      name: parameter.name,
      unit: parameter.unit,
      value,
      range: parameter.normal ? parameter.normal : parameter.min + ' – ' + parameter.max,
      flag: getFlag(parameter, value),
    });
  }

  // If the admin writes no remarks, we write a simple summary
  let remarks = req.body.remarks;
  if (!remarks) {
    const outOfRange = results.filter((r) => r.flag !== 'Normal').map((r) => r.name);
    remarks = outOfRange.length > 0
      ? 'Outside the normal range: ' + outOfRange.join(', ') + '. Please discuss with your doctor.'
      : 'All values are within the normal range.';
  }

  const report = { id: nextId(data.testReports), bookingId: booking.id, date: today(), results, remarks };
  data.testReports.push(report);
  booking.status = 'Report Ready';
  save();
  res.json(report);
});

module.exports = router;
