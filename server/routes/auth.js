const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const U = require('../utils');

async function profile(user) {
  const out = { id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone };
  if (user.role === 'patient') {
    Object.assign(out, await db.get('SELECT id AS patient_id, dob, gender, blood_group, city, address FROM patients WHERE user_id = ?', [user.id]));
  }
  if (user.role === 'doctor') {
    Object.assign(
      out,
      await db.get(
        `SELECT d.id AS doctor_id, d.specialization, d.qualification, d.experience_years, d.fee, d.bio, d.work_days,
                d.start_time, d.end_time, d.slot_minutes, d.room, dep.name AS department
           FROM doctors d JOIN departments dep ON dep.id = d.department_id WHERE d.user_id = ?`,
        [user.id]
      )
    );
  }
  return out;
}

// Patient self-registration. Doctors, lab staff and admins are created by an admin.
router.post('/register', async (req, res) => {
  const b = req.body || {};
  const name = U.str(b.name, 'Name', { max: 120 });
  const email = U.email(b.email);
  const phone = U.phone(b.phone, 'Phone', { required: false });
  const password = U.str(b.password, 'Password', { max: 100 });
  if (password.length < 6) U.fail(400, 'Password must be at least 6 characters');
  const dob = U.date(b.dob, 'Date of birth', { required: false });
  const gender = b.gender ? U.oneOf(b.gender, 'Gender', ['female', 'male', 'other']) : null;
  const bloodGroup = U.bloodGroup(b.blood_group, 'Blood group', { required: false });

  if (await db.get('SELECT id FROM users WHERE email = ?', [email])) U.fail(409, 'An account with this email already exists. Log in instead.');
  const hash = await U.hashPassword(password);
  const user = await db.tx(async (t) => {
    const u = await t.run('INSERT INTO users (role, name, email, phone, password_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [
      'patient', name, email, phone, hash, U.nowIso(),
    ]);
    await t.run('INSERT INTO patients (user_id, dob, gender, blood_group, city, address) VALUES (?, ?, ?, ?, ?, ?)', [
      u.insertId, dob, gender, bloodGroup, U.str(b.city, 'City', { required: false, max: 80 }), null,
    ]);
    return { id: u.insertId, role: 'patient', name, email, phone };
  });
  res.status(201).json({ token: U.signToken(user), user: await profile(user) });
});

router.post('/login', async (req, res) => {
  const b = req.body || {};
  const email = U.email(b.email);
  const password = U.str(b.password, 'Password');
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await U.verifyPassword(password, user.password_hash))) U.fail(401, 'Email or password is incorrect');
  if (!user.active) U.fail(403, 'This account has been deactivated. Contact the hospital admin.');
  if (b.role && b.role !== user.role) {
    U.fail(403, `This is a ${user.role} account. Switch the login tab to "${user.role === 'lab' ? 'Lab' : user.role[0].toUpperCase() + user.role.slice(1)}".`);
  }
  res.json({ token: U.signToken(user), user: await profile(user) });
});

router.get('/me', authenticate, async (req, res) => {
  res.json(await profile(req.user));
});

router.patch('/me', authenticate, async (req, res) => {
  const b = req.body || {};
  const name = U.str(b.name ?? req.user.name, 'Name', { max: 120 });
  const phone = U.phone(b.phone ?? req.user.phone, 'Phone', { required: false });
  await db.run('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone, req.user.id]);
  if (req.user.role === 'patient') {
    await db.run('UPDATE patients SET dob = ?, gender = ?, blood_group = ?, city = ?, address = ? WHERE user_id = ?', [
      U.date(b.dob, 'Date of birth', { required: false }),
      b.gender ? U.oneOf(b.gender, 'Gender', ['female', 'male', 'other']) : null,
      U.bloodGroup(b.blood_group, 'Blood group', { required: false }),
      U.str(b.city, 'City', { required: false, max: 80 }),
      U.str(b.address, 'Address', { required: false, max: 255 }),
      req.user.id,
    ]);
  }
  res.json(await profile({ ...req.user, name, phone }));
});

router.post('/change-password', authenticate, async (req, res) => {
  const b = req.body || {};
  const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await U.verifyPassword(U.str(b.current_password, 'Current password'), user.password_hash))) U.fail(400, 'Current password is incorrect');
  const next = U.str(b.new_password, 'New password', { max: 100 });
  if (next.length < 6) U.fail(400, 'New password must be at least 6 characters');
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await U.hashPassword(next), req.user.id]);
  res.json({ ok: true });
});

// ---------- Notifications ----------
router.get('/notifications', authenticate, async (req, res) => {
  const items = await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', [req.user.id]);
  const unread = await db.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ items, unread: Number(unread.n) });
});
router.post('/notifications/read', authenticate, async (req, res) => {
  await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
