// Small helper functions used by many files.
const crypto = require('crypto');

// We never save passwords as plain text. We save a "hash":
// a scrambled version of the password that cannot be turned back.
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Today's date as text, for example "2026-10-05"
function today() {
  return dateToText(new Date());
}

// Add (or subtract) days to a date written as text
function addDays(dateText, days) {
  const date = new Date(dateText + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return dateToText(date);
}

function dateToText(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

// Current time as text, for example "14:30"
function timeNow() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

module.exports = { hashPassword, today, addDays, timeNow };
