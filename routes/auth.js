// Login, sign up and logout.
const express = require('express');
const crypto = require('crypto');
const { data, save, nextId } = require('../database');
const { hashPassword, today, timeNow } = require('../helpers');

const router = express.Router();

// Who is logged in. Key = login token, value = { role, id }
// (kept in memory, so everyone logs in again after the server restarts)
const sessions = {};

// Which database list to check for each login tab
const LISTS = { patient: 'patients', doctor: 'doctors', admin: 'admins' };

// POST /api/login   body: { role, email, password }
router.post('/login', (req, res) => {
  const { role, email, password } = req.body;
  const list = data[LISTS[role]];
  if (!list) return res.status(400).json({ error: 'Choose Patient, Doctor or Admin' });

  const user = list.find((u) => u.email === String(email).trim().toLowerCase());
  if (!user || user.password !== hashPassword(String(password))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  // Remember when this user last logged in and how many times
  user.lastLogin = today() + ' ' + timeNow();
  user.loginCount = (user.loginCount || 0) + 1;
  save();

  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = { role, id: user.id };
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
});

// POST /api/signup   (only patients can sign up themselves)
router.post('/signup', (req, res) => {
  const { name, email, password, phone, gender, dob, bloodGroup, city } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (data.patients.find((p) => p.email === cleanEmail)) {
    return res.status(400).json({ error: 'This email is already registered. Please log in.' });
  }

  const patient = {
    id: nextId(data.patients),
    name: name.trim(),
    email: cleanEmail,
    password: hashPassword(password),
    phone: phone || '',
    gender: gender || '',
    dob: dob || '',
    bloodGroup: bloodGroup || '',
    city: city || '',
    joinedOn: today(),                     // the day they signed up
    lastLogin: today() + ' ' + timeNow(),  // signing up also logs them in
    loginCount: 1,
  };
  data.patients.push(patient);
  save();

  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = { role: 'patient', id: patient.id };
  res.json({ token, user: { id: patient.id, name: patient.name, email: patient.email, role: 'patient' } });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  delete sessions[req.headers.authorization];
  res.json({ message: 'Logged out' });
});

// "Middleware": runs before a route to check the user is logged in
// with the right role. Example: loginRequired('doctor', 'admin')
function loginRequired(...roles) {
  return (req, res, next) => {
    const session = sessions[req.headers.authorization];
    if (!session) {
      return res.status(401).json({ error: 'Please log in again' });
    }
    if (roles.length > 0 && !roles.includes(session.role)) {
      return res.status(403).json({ error: 'You are not allowed to do this' });
    }
    req.user = session; // now every route knows who is asking
    next();
  };
}

// GET /api/me - details of the logged-in user (without the password)
router.get('/me', loginRequired(), (req, res) => {
  const user = data[LISTS[req.user.role]].find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...details } = user;
  res.json({ ...details, role: req.user.role });
});

module.exports = router;
module.exports.loginRequired = loginRequired;
