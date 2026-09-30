// AI Health Assistant - saving and viewing consultation logs.
// (The rules that check symptoms are in public/js/ai-rules.js
//  and run in the browser.)
const express = require('express');
const { data, save, nextId } = require('../database');
const { today } = require('../helpers');
const { loginRequired } = require('./auth');

const router = express.Router();

// POST /api/ai-logs - save one consultation   body: { symptoms, result, urgency }
router.post('/ai-logs', loginRequired('patient'), (req, res) => {
  const { symptoms, result, urgency } = req.body;
  const log = {
    id: nextId(data.aiConsultLogs),
    patientId: req.user.id,
    date: today(),
    symptoms: symptoms || [],
    result: result || 'No clear match',
    urgency: urgency || '',
  };
  data.aiConsultLogs.push(log);
  save();
  res.json(log);
});

// GET /api/ai-logs - patients see their own, the admin sees all
router.get('/ai-logs', loginRequired('patient', 'admin'), (req, res) => {
  let logs = data.aiConsultLogs;
  if (req.user.role === 'patient') {
    logs = logs.filter((l) => l.patientId === req.user.id);
  }
  const result = logs.map((l) => {
    const patient = data.patients.find((p) => p.id === l.patientId);
    return { ...l, patientName: patient ? patient.name : '' };
  });
  res.json(result.reverse()); // newest first
});

module.exports = router;
