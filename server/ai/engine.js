// Rule-based AI Health Assistant.
//
// Pipeline:
//   1. extractSymptoms  - find known symptoms in free text (English + Hinglish),
//                         skipping negated ones ("no fever", "bukhar nahi")
//   2. red-flag rules   - dangerous combinations override everything else
//   3. score conditions - weighted match between the patient's symptoms and each
//                         condition profile in knowledge.js
//   4. adjust urgency   - duration, severity and age can raise the urgency
//   5. build response   - advice, medicine category, specialist, suggested tests
//
// It is deliberately explainable: every result lists which rules fired.
const K = require('./knowledge');

const BY_CODE = Object.fromEntries(K.SYMPTOMS.map((s) => [s.code, s]));
const MED_BY_CODE = Object.fromEntries(K.MEDICINES.map((m) => [m.code, m]));
const LEVELS = ['self_care', 'doctor_soon', 'urgent', 'emergency'];

// All aliases, longest first, so "period cramps" wins over "cramps".
const ALIASES = K.SYMPTOMS.flatMap((s) => s.aliases.map((a) => ({ alias: a.toLowerCase(), code: s.code }))).sort(
  (a, b) => b.alias.length - a.alias.length
);
const NEGATE_BEFORE = /\b(no|not|without|never|denies|don't have|dont have|do not have|koi)\s+(\w+\s+){0,2}$/;
const NEGATE_AFTER = /^\s*(nahi|nahin|nhi|nai|nahi hai)\b/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extractSymptoms(text) {
  let t = ` ${String(text || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ')} `;
  const found = new Set();
  const negated = new Set();
  for (const { alias, code } of ALIASES) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(alias)}(?=[^a-z]|$)`, 'g');
    let m;
    while ((m = re.exec(t))) {
      const start = m.index + m[1].length;
      const end = start + alias.length;
      const before = t.slice(Math.max(0, start - 40), start);
      const after = t.slice(end, end + 12);
      if (NEGATE_BEFORE.test(before) || NEGATE_AFTER.test(after)) negated.add(code);
      else found.add(code);
      // Blank out the matched words so shorter aliases can't match them again.
      t = t.slice(0, start) + ' '.repeat(alias.length) + t.slice(end);
      re.lastIndex = end;
    }
  }
  for (const c of found) negated.delete(c);
  return { found: [...found], negated: [...negated] };
}

// Reads how long the patient has been unwell from free text:
// "2 din se", "since 3 days", "for a week" is NOT matched ("a" is too ambiguous: "twice a day"),
// "ek hafte se" = 7, "kal se" / "since yesterday" = 1, "subah se" / "since morning" = 0.
const NUMBER_WORDS = { one: 1, ek: 1, two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4, five: 5, paanch: 5, panch: 5, six: 6, chhe: 6, seven: 7, saat: 7, ten: 10, das: 10 };
function extractDuration(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const m = t.match(/(?:^|[^a-z0-9])(\d{1,3}|one|two|three|four|five|six|seven|ten|ek|do|teen|chaar|char|paanch|panch|chhe|saat|das)\s*(days?|din|dino|dinon|weeks?|hafte|hafta|haftey|months?|mahine|mahina)(?![a-z])/);
  if (m) {
    const n = /\d/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
    const mult = /week|haft/.test(m[2]) ? 7 : /month|mahin/.test(m[2]) ? 30 : 1;
    return Math.min(365, n * mult);
  }
  if (/(since yesterday|from yesterday|kal se|kal raat se)/.test(t)) return 1;
  if (/(since morning|since today|subah se|aaj se|since last night|raat se)/.test(t)) return 0;
  return null;
}

function scoreConditions(codes) {
  const has = new Set(codes);
  const results = [];
  for (const c of K.CONDITIONS) {
    if (!(c.need || []).every((group) => group.some((s) => has.has(s)))) continue;
    const total = Object.values(c.weights).reduce((a, b) => a + b, 0);
    const matched = Object.keys(c.weights).filter((s) => has.has(s));
    const matchedWeight = matched.reduce((a, s) => a + c.weights[s], 0);
    const conditionCoverage = matchedWeight / total; // how much of the profile is present
    const patientCoverage = matched.length / has.size; // how much of the patient is explained
    let score = 0.6 * conditionCoverage + 0.4 * patientCoverage;
    if ((c.against || []).some((s) => has.has(s))) score *= 0.5;
    results.push({ condition: c, score, matched });
  }
  return results.sort((a, b) => b.score - a.score);
}

const raise = (level, to) => (LEVELS.indexOf(to) > LEVELS.indexOf(level) ? to : level);
const bump = (level) => LEVELS[Math.min(LEVELS.indexOf(level) + 1, 2)]; // never auto-bump into emergency

/**
 * @param {object} input
 * @param {string} input.text           free-text description
 * @param {string[]} input.symptoms     symptom codes picked from the list
 * @param {number|null} input.age
 * @param {number|null} input.durationDays
 * @param {'mild'|'moderate'|'severe'} input.severity
 */
function analyse({ text = '', symptoms = [], age = null, durationDays = null, severity = 'moderate' }) {
  const reasons = []; // which rules fired - shown to the user as "why"
  if (durationDays === null || durationDays === undefined) {
    durationDays = extractDuration(text);
    if (durationDays !== null) reasons.push(`Duration read from your message: ${durationDays} day${durationDays === 1 ? '' : 's'}`);
  }
  const extracted = extractSymptoms(text);
  const codes = [...new Set([...symptoms.filter((c) => BY_CODE[c]), ...extracted.found])];
  const has = (c) => codes.includes(c);
  const ctx = { age, durationDays, severity };

  if (!codes.length) {
    return {
      recognised: false,
      matched: [],
      negated: extracted.negated.map((c) => BY_CODE[c].name),
      message: 'I couldn\'t pick out specific symptoms. Choose them from the list, or describe them simply — for example "fever and headache for 2 days".',
    };
  }

  // Crisis support comes first and is handled differently from medical triage.
  if (has('self_harm_thoughts')) {
    return {
      recognised: true,
      crisis: true,
      matched: codes.map((c) => ({ code: c, name: BY_CODE[c].name })),
      conditions: [],
      urgency: {
        level: 'emergency',
        label: 'Please reach out for support now',
        message: 'You deserve support right now. Call Tele-MANAS on 14416 (free, 24×7, in many Indian languages). If you might act on these thoughts, call 112 or go to the nearest emergency department. If you can, stay with someone you trust.',
      },
      advice: [
        'You don\'t have to go through this alone — tell someone close to you how you are feeling.',
        'Move away from anything you could use to hurt yourself.',
        'A psychiatrist or counsellor can help; you can book one below.',
      ],
      medicine: null,
      departmentName: 'Psychiatry',
      testNames: [],
      reasons: ['Mentions of self-harm always get crisis support first.'],
    };
  }

  // 1. Red flags
  let level = 'self_care';
  let departmentName = null;
  const redFlags = [];
  for (const rule of K.RED_FLAGS) {
    if (rule.when(has, ctx)) {
      redFlags.push(rule.message);
      level = raise(level, rule.level);
      if (!departmentName) departmentName = rule.department; // rules are ordered most-serious first
      reasons.push(`Red-flag rule "${rule.code}" → ${K.URGENCY[rule.level].label}`);
    }
  }
  const emergency = level === 'emergency';

  // 2. Conditions
  const ranked = scoreConditions(codes).filter((r) => r.score >= 0.35).slice(0, 3);
  const top = ranked[0] ? ranked[0].condition : null;
  if (top) {
    level = raise(level, top.base);
    if (!departmentName) departmentName = top.department;
    reasons.push(`Best match: ${top.name} (${Math.round(ranked[0].score * 100)}%) → starts at "${K.URGENCY[top.base].label}"`);
    if (top.minDays && durationDays !== null && durationDays < top.minDays && ranked[1]) {
      reasons.push(`${top.name} usually lasts ${top.minDays}+ days; keep watching.`);
    }
  } else {
    // No clear pattern: route by the body system most symptoms belong to.
    const counts = {};
    for (const c of codes) counts[BY_CODE[c].system] = (counts[BY_CODE[c].system] || 0) + 1;
    const system = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    if (!departmentName) departmentName = K.SYSTEM_DEPARTMENT[system];
    level = raise(level, 'doctor_soon');
    reasons.push(`No single condition fits well → routed to ${departmentName} by body system`);
  }

  // 3. Urgency adjustments
  if (!emergency) {
    const hasFever = has('fever') || has('high_fever');
    if (hasFever && durationDays !== null && durationDays >= 3) {
      level = raise(level, 'doctor_soon');
      reasons.push('Fever for 3 or more days → see a doctor');
    }
    if (has('cough') && durationDays !== null && durationDays >= 14) {
      level = raise(level, 'doctor_soon');
      reasons.push('Cough for 2+ weeks → check-up including a TB test');
    }
    if (durationDays !== null && durationDays >= 7 && level === 'self_care') {
      level = 'doctor_soon';
      reasons.push('Symptoms for a week or more → see a doctor');
    }
    if (severity === 'severe') {
      const before = level;
      level = bump(level);
      if (before !== level) reasons.push('Severe symptoms → urgency raised one level');
    }
  }

  // 4. Children go to Paediatrics (except emergencies, which go to emergency care anyway).
  if (age !== null && age < 14 && !emergency) {
    departmentName = 'Paediatrics';
    reasons.push('Age under 14 → Paediatrics');
  }

  // 5. Advice & medicine
  const advice = [];
  if (emergency) advice.push('Don\'t wait for an appointment — get emergency care now.');
  if (top) advice.push(...top.advice);
  else advice.push('Rest, drink enough fluids and note how your symptoms change.', 'A doctor can examine you and find the cause.');
  if (has('cough') && durationDays !== null && durationDays >= 14) {
    advice.push('A cough lasting more than 2 weeks should be checked for tuberculosis (TB). Testing is free at government health centres.');
  }
  if ((has('fever') || has('high_fever')) && durationDays !== null && durationDays >= 3 && !(top && top.tests)) {
    advice.push('Fever for 3+ days: a blood test (CBC) helps the doctor find the cause.');
  }

  let medicineCode = emergency ? 'emergency' : top ? top.medicine : 'no_medicine';
  const medicine = { ...MED_BY_CODE[medicineCode] };
  if (age !== null && age < 12 && medicine.otc) {
    medicine.caution = `${medicine.caution} Children need doses based on their weight — ask a doctor or pharmacist first.`;
  }

  const testNames = [...new Set([...(top && top.tests ? top.tests : []), ...(!top && (has('fever') || has('high_fever')) ? ['Complete Blood Count (CBC)'] : [])])];

  return {
    recognised: true,
    crisis: false,
    matched: codes.map((c) => ({ code: c, name: BY_CODE[c].name })),
    negated: extracted.negated.map((c) => BY_CODE[c].name),
    conditions: ranked.map((r) => ({ code: r.condition.code, name: r.condition.name, match: Math.round(r.score * 100) })),
    urgency: { level, label: K.URGENCY[level].label, message: K.URGENCY[level].message },
    redFlags,
    advice,
    medicine,
    departmentName,
    testNames,
    reasons,
    durationDays,
  };
}

const symptomList = () => K.SYMPTOMS.map(({ code, name, system, redFlag }) => ({ code, name, system, redFlag }));

module.exports = { analyse, extractSymptoms, extractDuration, symptomList };
