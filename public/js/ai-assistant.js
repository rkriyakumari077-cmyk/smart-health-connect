// AI Health Assistant page.
// The rules (SYMPTOMS, CONDITIONS, RED_FLAGS, checkSymptoms) are in ai-rules.js

checkLogin('patient');
showNavbar('patient', 'ai-assistant.html');

// Show a tick box for every symptom
let boxes = '';
for (const symptom of SYMPTOMS) {
  boxes += `<label><input type="checkbox" value="${symptom.id}"> ${symptom.name}</label>`;
}
document.getElementById('symptom-list').innerHTML = boxes;

// Fill in the patient's age from their profile
api('/api/me').then((me) => {
  document.getElementById('age').value = getAge(me.dob);
});

async function runCheck() {
  const text = document.getElementById('symptom-text').value;

  // Symptoms from the text + symptoms from the tick boxes (no duplicates)
  const symptomIds = findSymptomsInText(text);
  const ticked = document.querySelectorAll('#symptom-list input:checked');
  for (const box of ticked) {
    if (!symptomIds.includes(box.value)) symptomIds.push(box.value);
  }

  if (symptomIds.length === 0) {
    showMessage('check-message', 'I could not find any symptoms. Try simple words like "fever and headache", or tick the boxes.', 'error');
    document.getElementById('result').innerHTML = '';
    return;
  }
  document.getElementById('check-message').innerHTML = '';

  // Days: from the box, or read from the text ("3 din se")
  const days = Number(document.getElementById('days').value) || findDaysInText(text);
  const age = Number(document.getElementById('age').value);

  const result = checkSymptoms(symptomIds, days, age);
  const symptomNames = symptomIds.map((id) => SYMPTOMS.find((s) => s.id === id).name);
  showResult(result, symptomNames, days);

  // Save this check in the database (AI consult log)
  await api('/api/ai-logs', 'POST', {
    symptoms: symptomNames,
    result: result.condition ? result.condition.name : 'No clear match',
    urgency: result.levelText,
  });
  loadHistory();
}

function showResult(result, symptomNames, days) {
  let html = `
    <div class="result-box ${result.levelCss}">
      <h2>${result.levelText}</h2>
      <p>${result.levelMessage}</p>
      ${result.level === 'Emergency' ? '<a class="btn btn-light" href="tel:112">📞 Call 112</a> <a class="btn btn-light" href="tel:108">🚑 Ambulance 108</a>' : ''}
    </div>
    <div class="card">`;

  for (const warning of result.warnings) {
    html += `<div class="message error">⚠️ ${esc(warning)}</div>`;
  }

  html += `<h3>What I understood</h3>
    <p>${symptomNames.map(esc).join(', ')}${days ? ' – for ' + days + ' days' : ''}</p>`;

  if (result.matches.length > 0) {
    html += '<h3>Possible causes</h3><ul>';
    for (const m of result.matches) {
      html += `<li>${esc(m.condition.name)} – ${m.percent}% of its symptoms match</li>`;
    }
    html += '</ul>';
  }

  if (result.condition) {
    html += '<h3>What you can do now</h3><ul>';
    for (const tip of result.condition.advice) html += `<li>${esc(tip)}</li>`;
    html += `</ul>
      <h3>Medicine category</h3>
      <p>💊 ${esc(result.condition.medicine)}</p>
      <p class="muted">We never suggest a dose. Ask a doctor or pharmacist before taking any medicine.</p>`;
  }

  // Link to book the right specialist (the reason is filled in automatically)
  const reason = 'AI check: ' + symptomNames.join(', ') + (result.condition ? ' (' + result.condition.name + ')' : '');
  html += `<h3>Suggested doctor: ${esc(result.specialist)}</h3>
    <a class="btn" href="doctors.html?specialization=${encodeURIComponent(result.specialist)}&reason=${encodeURIComponent(reason)}">Book a ${esc(result.specialist)}</a>`;

  if (result.condition && result.condition.tests.length > 0) {
    html += `<h3>Tests that can help</h3><p>${result.condition.tests.map(esc).join(', ')}</p>
      <a class="btn btn-light" href="lab-tests.html">Book a lab test</a>`;
  }

  html += `<h3>Why this result?</h3><ul class="muted">`;
  for (const r of result.reasons) html += `<li>${esc(r)}</li>`;
  html += `</ul>
    <p class="muted"><b>Note:</b> This is guidance from a rule-based assistant, not a diagnosis. Please consult a doctor.</p>
  </div>`;

  document.getElementById('result').innerHTML = html;
  document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
}

async function loadHistory() {
  const logs = await api('/api/ai-logs');
  if (logs.length === 0) {
    document.getElementById('history').innerHTML = '<p class="muted">No checks yet.</p>';
    return;
  }
  let rows = '';
  for (const log of logs) {
    rows += `<tr><td>${formatDate(log.date)}</td><td>${esc(log.symptoms.join(', '))}</td><td>${esc(log.result)}</td><td>${esc(log.urgency)}</td></tr>`;
  }
  document.getElementById('history').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Date</th><th>Symptoms</th><th>Result</th><th>Urgency</th></tr>${rows}
    </table></div>`;
}

loadHistory();
