const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const config = require('../config');

// ---------- HTTP errors & validation ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{7,15}$/;

function str(v, field, { required = true, max = 255 } = {}) {
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (!s) {
    if (required) fail(400, `${field} is required`);
    return null;
  }
  if (s.length > max) fail(400, `${field} must be at most ${max} characters`);
  return s;
}
function int(v, field, { min = -Infinity, max = Infinity, required = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) fail(400, `${field} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, `${field} must be a whole number between ${min} and ${max}`);
  return n;
}
function oneOf(v, field, options) {
  if (!options.includes(v)) fail(400, `${field} must be one of: ${options.join(', ')}`);
  return v;
}
function date(v, field, { required = true } = {}) {
  if (!v) {
    if (required) fail(400, `${field} is required`);
    return null;
  }
  if (!DATE_RE.test(v) || Number.isNaN(new Date(v + 'T00:00:00').getTime())) fail(400, `${field} must be a date (YYYY-MM-DD)`);
  return v;
}
function time(v, field) {
  if (!TIME_RE.test(v || '')) fail(400, `${field} must be a time (HH:MM)`);
  return v;
}
function email(v) {
  const s = str(v, 'Email', { max: 190 }).toLowerCase();
  if (!EMAIL_RE.test(s)) fail(400, 'Enter a valid email address');
  return s;
}
function phone(v, field = 'Phone', opts = {}) {
  const s = str(v, field, { max: 20, ...opts });
  if (s && !PHONE_RE.test(s)) fail(400, `${field} must be a valid phone number`);
  return s;
}
function bloodGroup(v, field = 'Blood group', { required = true } = {}) {
  if (!v && !required) return null;
  return oneOf(v, field, BLOOD_GROUPS);
}

const parseJson = (s, fallback) => {
  if (s === null || s === undefined || s === '') return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

// ---------- Dates (local server time) ----------
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toDateStr(new Date());
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nowIso = () => new Date().toISOString();
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
function ageFrom(dob) {
  if (!dob) return null;
  const b = new Date(dob + 'T00:00:00');
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age;
}

// ---------- Passwords (scrypt, built into Node) ----------
const scrypt = promisify(crypto.scrypt);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [, salt, hex] = String(stored).split('$');
  if (!salt || !hex) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

// ---------- Signed login tokens (HMAC-SHA256, like a minimal JWT) ----------
let secret = config.tokenSecret;
function getSecret() {
  if (secret) return secret;
  const file = path.join(config.root, 'data', '.secret');
  if (fs.existsSync(file)) secret = fs.readFileSync(file, 'utf8').trim();
  else {
    secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret);
  }
  return secret;
}
const b64 = (s) => Buffer.from(s).toString('base64url');
function signToken(user) {
  const payload = b64(JSON.stringify({ uid: user.id, role: user.role, exp: Date.now() + config.tokenDays * 86400000 }));
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = parseJson(Buffer.from(payload, 'base64url').toString(), null);
  if (!data || data.exp < Date.now()) return null;
  return data;
}

module.exports = {
  HttpError, fail, str, int, oneOf, date, time, email, phone, bloodGroup, parseJson,
  BLOOD_GROUPS, today, addDays, nowTime, nowIso, daysBetween, ageFrom, toDateStr,
  hashPassword, verifyPassword, signToken, verifyToken,
};
