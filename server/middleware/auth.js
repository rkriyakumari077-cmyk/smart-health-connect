const db = require('../db');
const { verifyToken, fail } = require('../utils');

// Reads "Authorization: Bearer <token>", loads the user and, for patients and
// doctors, their profile id. Sets req.user = { id, role, name, email, patientId?, doctorId? }.
async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const data = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!data) fail(401, 'Please log in to continue');
  const user = await db.get('SELECT id, role, name, email, phone, active FROM users WHERE id = ?', [data.uid]);
  if (!user || !user.active) fail(401, 'Your account is not active. Please log in again.');
  if (user.role === 'patient') {
    const p = await db.get('SELECT id FROM patients WHERE user_id = ?', [user.id]);
    user.patientId = p && p.id;
  }
  if (user.role === 'doctor') {
    const d = await db.get('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
    user.doctorId = d && d.id;
  }
  req.user = user;
  next();
}

// Usage: router.post('/x', allow('admin', 'lab'), handler)
const allow = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) fail(403, 'You do not have access to this action');
  next();
};

module.exports = { authenticate, allow };
