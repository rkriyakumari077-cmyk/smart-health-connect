const router = require('express').Router();
const db = require('../db');
const { authenticate, allow } = require('../middleware/auth');
const engine = require('../ai/engine');
const U = require('../utils');

const DISCLAIMER =
  'This is general guidance from a rule-based assistant, not a diagnosis. A doctor must examine you for a diagnosis and treatment.';

router.get('/symptoms', (_req, res) => res.json(engine.symptomList()));

// Turns engine output into a full response with real doctors and lab tests from the database.
async function enrich(result, consultId = null) {
  if (!result.recognised) return result;
  const dept = result.departmentName ? await db.get('SELECT id, name FROM departments WHERE name = ?', [result.departmentName]) : null;
  const doctors = dept
    ? await db.all(
        `SELECT d.id, u.name, d.specialization, d.experience_years, d.fee, d.qualification
           FROM doctors d JOIN users u ON u.id = d.user_id
          WHERE d.department_id = ? AND d.active = 1 AND u.active = 1 ORDER BY d.experience_years DESC LIMIT 3`,
        [dept.id]
      )
    : [];
  const tests = [];
  for (const name of result.testNames || []) {
    const t = await db.get('SELECT id, name, price, home_collection FROM lab_tests WHERE name = ? AND active = 1', [name]);
    if (t) tests.push(t);
  }
  return { ...result, consultId, department: dept, doctors, tests, disclaimer: DISCLAIMER };
}

router.post('/consult', authenticate, allow('patient'), async (req, res) => {
  const b = req.body || {};
  const text = U.str(b.text, 'Symptoms', { required: false, max: 1000 }) || '';
  const symptoms = Array.isArray(b.symptoms) ? b.symptoms.map(String).slice(0, 30) : [];
  const age = U.int(b.age, 'Age', { min: 0, max: 120, required: false });
  const durationDays = U.int(b.duration_days, 'Duration', { min: 0, max: 365, required: false });
  const severity = U.oneOf(b.severity || 'moderate', 'Severity', ['mild', 'moderate', 'severe']);
  if (!text && !symptoms.length) U.fail(400, 'Describe how you feel or pick at least one symptom');

  const result = engine.analyse({ text, symptoms, age, durationDays, severity });
  if (!result.recognised) return res.json(await enrich(result));

  const dept = result.departmentName ? await db.get('SELECT id FROM departments WHERE name = ?', [result.departmentName]) : null;
  const log = await db.run(
    `INSERT INTO ai_consult_logs (patient_id, symptoms_text, matched_symptoms, age, duration_days, severity, conditions,
       urgency, advice, medicine_code, department_id, suggested_tests, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.patientId, text, JSON.stringify(result.matched.map((m) => m.code)), age, result.durationDays ?? durationDays, severity,
      JSON.stringify(result.conditions), result.urgency.level, JSON.stringify(result.advice),
      result.medicine ? result.medicine.code : null, dept && dept.id, JSON.stringify(result.testNames), U.nowIso(),
    ]
  );
  res.json(await enrich(result, log.insertId));
});

router.get('/history', authenticate, allow('patient'), async (req, res) => {
  const rows = await db.all(
    `SELECT l.id, l.symptoms_text, l.matched_symptoms, l.conditions, l.urgency, l.created_at, d.name AS department
       FROM ai_consult_logs l LEFT JOIN departments d ON d.id = l.department_id
      WHERE l.patient_id = ? ORDER BY l.id DESC LIMIT 20`,
    [req.user.patientId]
  );
  const names = Object.fromEntries(engine.symptomList().map((s) => [s.code, s.name]));
  res.json(
    rows.map((r) => ({
      ...r,
      matched: U.parseJson(r.matched_symptoms, []).map((c) => names[c] || c),
      conditions: U.parseJson(r.conditions, []),
    }))
  );
});

module.exports = router;
module.exports.DISCLAIMER = DISCLAIMER;
