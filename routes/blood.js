// Blood Bank module:
// blood stock, donors, donor eligibility and emergency blood requests.
const express = require('express');
const { data, save, nextId } = require('../database');
const { today, addDays } = require('../helpers');
const { loginRequired } = require('./auth');

const router = express.Router();

// Which blood groups a patient can safely receive
const CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

// Donor rules: age 18 to 65, weight at least 45 kg,
// and at least 90 days since the last donation.
function checkEligibility(donor) {
  if (donor.age < 18 || donor.age > 65) return { eligible: false, reason: 'Age must be 18 to 65' };
  if (donor.weight < 45) return { eligible: false, reason: 'Weight must be at least 45 kg' };
  if (donor.lastDonation) {
    const nextDate = addDays(donor.lastDonation, 90);
    if (nextDate > today()) return { eligible: false, reason: 'Can donate again from ' + nextDate };
  }
  return { eligible: true, reason: 'Can donate now' };
}

// GET /api/blood-stock
router.get('/blood-stock', loginRequired(), (req, res) => {
  res.json({ stock: data.bloodBank, canReceiveFrom: CAN_RECEIVE_FROM });
});

// PUT /api/blood-stock   body: { group, units }  (admin corrects the stock)
router.put('/blood-stock', loginRequired('admin'), (req, res) => {
  const row = data.bloodBank.find((b) => b.group === req.body.group);
  const units = Number(req.body.units);
  if (!row) return res.status(404).json({ error: 'Blood group not found' });
  if (!Number.isInteger(units) || units < 0) return res.status(400).json({ error: 'Units must be 0 or more' });
  row.units = units;
  save();
  res.json(row);
});

// GET /api/donors?group=B%2B&city=Noida&compatible=yes
// Patients see only verified donors. The admin sees everyone.
router.get('/donors', loginRequired(), (req, res) => {
  let donors = data.donors;
  if (req.user.role !== 'admin') donors = donors.filter((d) => d.verified);

  if (req.query.group) {
    const groups = req.query.compatible === 'yes' ? CAN_RECEIVE_FROM[req.query.group] || [] : [req.query.group];
    donors = donors.filter((d) => groups.includes(d.bloodGroup));
  }
  if (req.query.city) {
    const city = req.query.city.toLowerCase();
    donors = donors.filter((d) => d.city.toLowerCase().includes(city));
  }
  res.json(donors.map((d) => ({ ...d, ...checkEligibility(d) })));
});

// GET /api/my-donor - the logged-in patient's donor record (or null)
router.get('/my-donor', loginRequired('patient'), (req, res) => {
  const donor = data.donors.find((d) => d.patientId === req.user.id);
  res.json(donor ? { ...donor, ...checkEligibility(donor) } : null);
});

// POST /api/donors - a patient registers as a donor
router.post('/donors', loginRequired('patient'), (req, res) => {
  if (data.donors.some((d) => d.patientId === req.user.id)) {
    return res.status(400).json({ error: 'You are already registered as a donor' });
  }
  const patient = data.patients.find((p) => p.id === req.user.id);
  const donor = {
    id: nextId(data.donors),
    patientId: req.user.id,
    name: patient.name,
    bloodGroup: req.body.bloodGroup,
    city: req.body.city,
    phone: req.body.phone,
    age: Number(req.body.age),
    weight: Number(req.body.weight),
    lastDonation: req.body.lastDonation || '',
    verified: false, // the admin verifies new donors
  };
  if (!CAN_RECEIVE_FROM[donor.bloodGroup] || !donor.city || !donor.phone || !donor.age || !donor.weight) {
    return res.status(400).json({ error: 'Please fill in all the details' });
  }
  if (donor.lastDonation && donor.lastDonation > today()) {
    return res.status(400).json({ error: 'Last donation date cannot be in the future' });
  }
  const check = checkEligibility(donor);
  if (!check.eligible && !check.reason.startsWith('Can donate again')) {
    return res.status(400).json({ error: 'Sorry, you cannot register: ' + check.reason });
  }
  data.donors.push(donor);
  save();
  res.json(donor);
});

// PUT /api/donors/4/verify   (admin)
router.put('/donors/:id/verify', loginRequired('admin'), (req, res) => {
  const donor = data.donors.find((d) => d.id === Number(req.params.id));
  if (!donor) return res.status(404).json({ error: 'Donor not found' });
  donor.verified = true;
  save();
  res.json(donor);
});

// PUT /api/donors/4/donated   (admin records a donation: +1 unit in stock)
router.put('/donors/:id/donated', loginRequired('admin'), (req, res) => {
  const donor = data.donors.find((d) => d.id === Number(req.params.id));
  if (!donor) return res.status(404).json({ error: 'Donor not found' });
  const check = checkEligibility(donor);
  if (!check.eligible) return res.status(400).json({ error: donor.name + ' cannot donate: ' + check.reason });

  donor.lastDonation = today();
  donor.verified = true;
  const row = data.bloodBank.find((b) => b.group === donor.bloodGroup);
  row.units = row.units + 1;
  save();
  res.json(donor);
});

// POST /api/blood-requests - an emergency request for blood
router.post('/blood-requests', loginRequired('patient'), (req, res) => {
  const { patientName, bloodGroup, units, hospital, phone, urgency } = req.body;
  if (!patientName || !CAN_RECEIVE_FROM[bloodGroup] || !hospital || !phone) {
    return res.status(400).json({ error: 'Please fill in all the details' });
  }
  const request = {
    id: nextId(data.bloodRequests),
    requestedBy: req.user.id,
    patientName,
    bloodGroup,
    units: Number(units) || 1,
    hospital,
    phone,
    urgency: urgency || 'Urgent',
    status: 'Pending',
    date: today(),
  };
  data.bloodRequests.push(request);
  save();
  res.json(request);
});

// GET /api/blood-requests - patients see their own, the admin sees all
router.get('/blood-requests', loginRequired(), (req, res) => {
  let list = data.bloodRequests;
  if (req.user.role === 'patient') list = list.filter((r) => r.requestedBy === req.user.id);
  res.json([...list].reverse()); // newest first
});

// PUT /api/blood-requests/2   body: { action: "approve" | "reject" | "fulfil" }
// Fulfilling a request takes the units out of the stock.
router.put('/blood-requests/:id', loginRequired('admin'), (req, res) => {
  const request = data.bloodRequests.find((r) => r.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status === 'Fulfilled' || request.status === 'Rejected') {
    return res.status(400).json({ error: 'This request is already closed' });
  }

  const action = req.body.action;
  if (action === 'approve') {
    request.status = 'Approved';
  } else if (action === 'reject') {
    request.status = 'Rejected';
  } else if (action === 'fulfil') {
    const row = data.bloodBank.find((b) => b.group === request.bloodGroup);
    if (row.units < request.units) {
      return res.status(400).json({ error: 'Only ' + row.units + ' units of ' + row.group + ' in stock' });
    }
    row.units = row.units - request.units;
    request.status = 'Fulfilled';
  } else {
    return res.status(400).json({ error: 'Unknown action' });
  }
  save();
  res.json(request);
});

module.exports = router;
