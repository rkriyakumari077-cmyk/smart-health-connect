// AI Health Assistant - the rules.
// This is a RULE-BASED system: we wrote the medical rules ourselves as lists.
// 1. SYMPTOMS: each symptom and the words (English + Hinglish) patients may type
// 2. CONDITIONS: each condition, its symptoms, the specialist and advice
// 3. RED_FLAGS: dangerous combinations that need a doctor today or an emergency

const SYMPTOMS = [
  { id: 'fever', name: 'Fever', words: ['fever', 'bukhar', 'temperature'] },
  { id: 'high_fever', name: 'High fever', words: ['high fever', 'tez bukhar', 'very high temperature'] },
  { id: 'chills', name: 'Chills / shivering', words: ['chills', 'shivering', 'kapkapi'] },
  { id: 'headache', name: 'Headache', words: ['headache', 'head pain', 'sar dard', 'sir dard'] },
  { id: 'body_ache', name: 'Body ache', words: ['body ache', 'body pain', 'badan dard'] },
  { id: 'eye_pain', name: 'Pain behind the eyes', words: ['pain behind eyes', 'pain behind the eyes', 'aankh ke peeche dard'] },
  { id: 'tiredness', name: 'Tiredness / weakness', words: ['tired', 'weakness', 'fatigue', 'thakan', 'kamzori'] },
  { id: 'cough', name: 'Cough', words: ['cough', 'khansi'] },
  { id: 'runny_nose', name: 'Runny nose / cold', words: ['runny nose', 'blocked nose', 'zukam', 'jukam', 'cold'] },
  { id: 'sneezing', name: 'Sneezing', words: ['sneezing', 'sneeze', 'chheenk'] },
  { id: 'sore_throat', name: 'Sore throat', words: ['sore throat', 'throat pain', 'gala dard', 'gale mein dard'] },
  { id: 'ear_pain', name: 'Ear pain', words: ['ear pain', 'earache', 'kaan dard', 'kaan mein dard'] },
  { id: 'vomiting', name: 'Vomiting', words: ['vomiting', 'vomit', 'ulti'] },
  { id: 'loose_motions', name: 'Loose motions', words: ['loose motion', 'diarrhea', 'diarrhoea', 'dast'] },
  { id: 'stomach_pain', name: 'Stomach pain', words: ['stomach pain', 'stomach ache', 'pet dard', 'pet mein dard'] },
  { id: 'acidity', name: 'Acidity / heartburn', words: ['acidity', 'heartburn', 'gas', 'khatti dakar'] },
  { id: 'burning_urine', name: 'Burning while passing urine', words: ['burning urine', 'burning while passing urine', 'peshab mein jalan'] },
  { id: 'rash', name: 'Skin rash', words: ['rash', 'daane'] },
  { id: 'itching', name: 'Itching', words: ['itching', 'itchy', 'khujli'] },
  { id: 'joint_pain', name: 'Joint / knee pain', words: ['joint pain', 'knee pain', 'jodon mein dard', 'ghutne mein dard'] },
  { id: 'back_pain', name: 'Back pain', words: ['back pain', 'kamar dard'] },
  { id: 'period_pain', name: 'Period pain', words: ['period pain', 'menstrual pain', 'period cramps'] },
  { id: 'dizziness', name: 'Dizziness', words: ['dizzy', 'dizziness', 'chakkar'] },
  { id: 'chest_pain', name: 'Chest pain', words: ['chest pain', 'seene mein dard'] },
  { id: 'breathlessness', name: 'Difficulty breathing', words: ['breathless', 'shortness of breath', 'difficulty breathing', 'saans lene mein dikkat'] },
  { id: 'sweating', name: 'Heavy sweating', words: ['sweating', 'pasina'] },
  { id: 'fainting', name: 'Fainting', words: ['fainted', 'fainting', 'unconscious', 'behosh'] },
];

// Urgency levels, from least to most urgent
const LEVELS = {
  Low: { text: 'Home care', message: 'You can take care of this at home. See a doctor if you do not feel better.', css: 'level-low' },
  Medium: { text: 'See a doctor in 1–2 days', message: 'Please book an appointment in the next day or two.', css: 'level-medium' },
  High: { text: 'See a doctor today', message: 'Please see a doctor today. Book the earliest slot.', css: 'level-high' },
  Emergency: { text: 'Emergency – get help now', message: 'Call 112 or 108 for an ambulance, or go to the nearest hospital now.', css: 'level-emergency' },
};

// The order matters: if two conditions get the same score, the first one wins.
const CONDITIONS = [
  {
    name: 'Common Cold', symptoms: ['runny_nose', 'sneezing', 'sore_throat', 'cough'], level: 'Low',
    specialist: 'General Physician', medicine: 'Cold relief: steam inhalation, saline nose drops, throat lozenges',
    advice: ['Drink warm fluids like soup and tea.', 'Take steam 2–3 times a day.', 'Rest well.'], tests: [],
  },
  {
    name: 'Viral Fever', symptoms: ['fever', 'body_ache', 'headache', 'tiredness', 'chills'], level: 'Low',
    specialist: 'General Physician', medicine: 'Fever reliever such as paracetamol (follow the dose on the pack)',
    advice: ['Rest and drink plenty of water.', 'Check your temperature morning and evening.', 'See a doctor if the fever lasts more than 3 days.'], tests: ['Complete Blood Count (CBC)'],
  },
  {
    name: 'Dengue (suspected)', symptoms: ['high_fever', 'eye_pain', 'body_ache', 'headache', 'rash'], level: 'High',
    specialist: 'General Physician', medicine: 'Only paracetamol for fever. Do NOT take ibuprofen or aspirin in dengue.',
    advice: ['Get a Dengue NS1 test and platelet count today.', 'Drink lots of fluids: water, ORS, coconut water.', 'Go to hospital for bleeding, severe stomach pain or repeated vomiting.'], tests: ['Dengue NS1 Test', 'Complete Blood Count (CBC)'],
  },
  {
    name: 'Malaria (suspected)', symptoms: ['fever', 'chills', 'sweating', 'headache', 'vomiting'], level: 'High',
    specialist: 'General Physician', medicine: 'Needs a doctor\'s prescription after a malaria test',
    advice: ['Get a malaria test today.', 'Use mosquito nets and repellent.'], tests: ['Malaria Test', 'Complete Blood Count (CBC)'],
  },
  {
    name: 'Food Poisoning', symptoms: ['vomiting', 'loose_motions', 'stomach_pain', 'fever'], level: 'Medium',
    specialist: 'Gastroenterologist', medicine: 'ORS (oral rehydration salts) to replace lost water',
    advice: ['Sip ORS or water often.', 'Eat light food like khichdi and banana.', 'Avoid outside food.'], tests: [],
  },
  {
    name: 'Acidity', symptoms: ['acidity', 'stomach_pain'], level: 'Low',
    specialist: 'Gastroenterologist', medicine: 'Antacid (gel or tablets)',
    advice: ['Eat small meals on time.', 'Avoid spicy and oily food.', 'Do not lie down just after eating.'], tests: [],
  },
  {
    name: 'Migraine', symptoms: ['headache', 'dizziness', 'vomiting'], level: 'Low',
    specialist: 'Neurologist', medicine: 'Pain reliever (ask a pharmacist)',
    advice: ['Rest in a dark, quiet room.', 'Sleep on time and drink enough water.'], tests: [],
  },
  {
    name: 'Skin Allergy', symptoms: ['rash', 'itching'], level: 'Low',
    specialist: 'Dermatologist', medicine: 'Anti-allergy tablet (antihistamine) and calamine lotion',
    advice: ['Do not scratch.', 'Avoid new soaps or creams.', 'Wear loose cotton clothes.'], tests: [],
  },
  {
    name: 'Urinary Infection (UTI)', symptoms: ['burning_urine', 'fever', 'stomach_pain'], level: 'Medium',
    specialist: 'General Physician', medicine: 'Needs antibiotics prescribed by a doctor',
    advice: ['Drink 2–3 litres of water a day.', 'Do not hold urine for long.'], tests: ['Urine Routine'],
  },
  {
    name: 'Ear / Throat Infection', symptoms: ['ear_pain', 'sore_throat', 'fever'], level: 'Medium',
    specialist: 'ENT Specialist', medicine: 'Pain reliever; antibiotics only if a doctor prescribes',
    advice: ['Gargle with warm salt water.', 'Do not put anything inside the ear.'], tests: [],
  },
  {
    name: 'Joint / Back Pain', symptoms: ['joint_pain', 'back_pain'], level: 'Low',
    specialist: 'Orthopaedic', medicine: 'Pain relief gel or spray',
    advice: ['Use a hot or cold pack.', 'Do light stretching.', 'Sit with a straight back.'], tests: ['Vitamin D'],
  },
  {
    name: 'Period Pain', symptoms: ['period_pain', 'stomach_pain', 'back_pain'], level: 'Low',
    specialist: 'Gynaecologist', medicine: 'Pain reliever for cramps (ask a pharmacist)',
    advice: ['Use a hot water bag on the lower stomach.', 'Do light exercise and drink warm fluids.'], tests: [],
  },
  {
    name: 'Weakness / Low Haemoglobin', symptoms: ['tiredness', 'dizziness'], level: 'Medium',
    specialist: 'General Physician', medicine: 'Iron supplements only if a doctor advises',
    advice: ['Eat iron-rich food: spinach, jaggery, dates, beans.', 'Get a blood test.'], tests: ['Complete Blood Count (CBC)'],
  },
];

// Red flags are checked FIRST. If all the symptoms in "needs" are present,
// the urgency becomes at least this level.
const RED_FLAGS = [
  { needs: ['chest_pain', 'sweating'], level: 'Emergency', specialist: 'Cardiologist', message: 'Chest pain with sweating can be a heart attack.' },
  { needs: ['chest_pain', 'breathlessness'], level: 'Emergency', specialist: 'Cardiologist', message: 'Chest pain with difficulty breathing can be a heart attack.' },
  { needs: ['fainting'], level: 'Emergency', specialist: 'Neurologist', message: 'Fainting needs to be checked by a doctor immediately.' },
  { needs: ['chest_pain'], level: 'High', specialist: 'Cardiologist', message: 'Chest pain should be checked by a doctor today.' },
  { needs: ['breathlessness'], level: 'High', specialist: 'General Physician', message: 'Difficulty in breathing should be checked by a doctor today.' },
];

// Step 1: find symptoms in what the patient typed
function findSymptomsInText(text) {
  const lowerText = text.toLowerCase();
  const found = [];
  for (const symptom of SYMPTOMS) {
    for (const word of symptom.words) {
      if (lowerText.includes(word)) {
        found.push(symptom.id);
        break;
      }
    }
  }
  return found;
}

// Step 2: read how many days from the text, for example "3 din se" or "2 days"
function findDaysInText(text) {
  const match = text.toLowerCase().match(/(\d+)\s*(days?|din)/);
  return match ? Number(match[1]) : 0;
}

// Returns the higher of two urgency levels
function higherLevel(a, b) {
  const order = ['Low', 'Medium', 'High', 'Emergency'];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}

// Step 3: check the symptoms and build the result
function checkSymptoms(symptomIds, days, age) {
  // Score every condition: what percentage of its symptoms the patient has
  const scores = [];
  for (const condition of CONDITIONS) {
    const matched = condition.symptoms.filter((s) => symptomIds.includes(s)).length;
    const percent = Math.round((matched / condition.symptoms.length) * 100);
    if (percent >= 40) scores.push({ condition, percent });
  }
  scores.sort((a, b) => b.percent - a.percent); // highest first (same score keeps list order)

  const best = scores.length > 0 ? scores[0].condition : null;
  let level = best ? best.level : 'Medium';
  let specialist = best ? best.specialist : 'General Physician';
  const reasons = [];
  if (best) reasons.push('Best match: ' + best.name + ' (' + scores[0].percent + '% of its symptoms)');
  else reasons.push('No clear match, so a General Physician should check you');

  // Red flags
  const warnings = [];
  for (const flag of RED_FLAGS) {
    const allPresent = flag.needs.every((s) => symptomIds.includes(s));
    // Use the red flag only if it is MORE urgent than what we have so far
    if (allPresent && higherLevel(flag.level, level) !== level) {
      level = flag.level;
      specialist = flag.specialist;
      warnings.push(flag.message);
      reasons.push('Red flag rule: ' + flag.message);
    }
  }

  // Duration rule: 3 or more days of symptoms should be seen by a doctor
  if (days >= 3 && level === 'Low') {
    level = 'Medium';
    reasons.push('Symptoms for ' + days + ' days, so see a doctor');
  }

  // Age rule: children go to a Paediatrician
  if (age && age < 12 && level !== 'Emergency') {
    specialist = 'Paediatrician';
    reasons.push('Age under 12, so a Paediatrician');
  }

  return {
    level,
    levelText: LEVELS[level].text,
    levelMessage: LEVELS[level].message,
    levelCss: LEVELS[level].css,
    warnings,
    matches: scores.slice(0, 3),
    condition: best,
    specialist,
    reasons,
  };
}
