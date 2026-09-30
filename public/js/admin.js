// Admin panel: dashboard, doctors, lab tests and reports, blood bank, AI logs

checkLogin('admin');
showNavbar('admin', 'admin.html');

const TABS = ['dashboard', 'doctors', 'lab', 'blood', 'reports'];

// Shows one section and hides the others
function showTab(name) {
  for (const tab of TABS) {
    document.getElementById('section-' + tab).classList.add('hidden');
    document.getElementById('tab-' + tab).classList.remove('active');
  }
  document.getElementById('section-' + name).classList.remove('hidden');
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('page-message').innerHTML = '';

  if (name === 'dashboard') loadStats();
  if (name === 'doctors') loadDoctors();
  if (name === 'lab') loadLab();
  if (name === 'blood') loadBlood();
  if (name === 'reports') loadReports();
}

// Runs an admin action, shows a message, then reloads the section
async function doAction(promise, successText, reload) {
  try {
    await promise;
    showMessage('page-message', successText);
    reload();
  } catch (error) {
    showMessage('page-message', error.message, 'error');
  }
}

// ================= Dashboard =================
async function loadStats() {
  const s = await api('/api/stats');
  const card = (number, label, alert) =>
    `<div class="card stat ${alert ? 'alert' : ''}"><b>${number}</b><span class="muted">${label}</span></div>`;

  document.getElementById('stats').innerHTML =
    card(s.patients, 'Registered patients') +
    card(s.doctors, 'Doctors') +
    card(s.appointmentsToday, 'Appointments today') +
    card(s.testsPending, 'Lab tests pending') +
    card(s.bloodUnits, 'Blood units in stock') +
    card(s.lowStock.join(', ') || 'None', 'Low blood groups', s.lowStock.length > 0) +
    card(s.openRequests, 'Open blood requests', s.openRequests > 0) +
    card(s.donorsToVerify, 'Donors to verify', s.donorsToVerify > 0) +
    card(s.aiConsults, 'AI consultations');
}

// ================= Doctors =================
async function loadDoctors() {
  const departments = await api('/api/departments');
  let options = '';
  for (const d of departments) options += `<option>${esc(d.name)}</option>`;
  document.getElementById('doc-special').innerHTML = options;

  const doctors = await api('/api/doctors');
  let rows = '';
  for (const d of doctors) {
    rows += `<tr>
      <td><b>${esc(d.name)}</b><br><span class="muted">${esc(d.email)}</span></td>
      <td>${esc(d.specialization)}</td>
      <td>₹${d.fee}</td>
      <td>${d.rating ? '⭐ ' + d.rating : '-'}</td>
      <td><button class="btn btn-small btn-red" onclick="removeDoctor(${d.id})">Remove</button></td>
    </tr>`;
  }
  document.getElementById('doctor-list').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Doctor</th><th>Specialization</th><th>Fee</th><th>Rating</th><th></th></tr>${rows}
    </table></div>`;
}

document.getElementById('doctor-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const request = api('/api/doctors', 'POST', {
    name: document.getElementById('doc-name').value,
    specialization: document.getElementById('doc-special').value,
    email: document.getElementById('doc-email').value,
    password: document.getElementById('doc-password').value,
    qualification: document.getElementById('doc-qual').value,
    experience: document.getElementById('doc-exp').value,
    fee: document.getElementById('doc-fee').value,
  });
  doAction(request, 'Doctor added. They can now log in.', () => {
    document.getElementById('doctor-form').reset();
    loadDoctors();
  });
});

function removeDoctor(id) {
  if (!confirm('Remove this doctor?')) return;
  doAction(api('/api/doctors/' + id, 'DELETE'), 'Doctor removed.', loadDoctors);
}

// ================= Lab tests =================
let testBookings = [];
let reportBooking = null;

async function loadLab() {
  testBookings = await api('/api/test-bookings');
  let rows = '';
  for (const b of testBookings) {
    let buttons = '';
    if (b.status === 'Booked') buttons = `<button class="btn btn-small" onclick="markCollected(${b.id})">Sample collected</button>`;
    if (b.status === 'Sample Collected') buttons = `<button class="btn btn-small" onclick="openReport(${b.id})">Enter report</button>`;
    rows += `<tr>
      <td>${formatDate(b.date)}<br><span class="muted">${esc(b.timeSlot)}</span></td>
      <td><b>${esc(b.patientName)}</b></td>
      <td>${esc(b.test.name)}</td>
      <td>${b.collection === 'Home' ? 'Home: ' + esc(b.address) : 'Lab visit'}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${buttons}</td>
    </tr>`;
  }
  document.getElementById('booking-list').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Date</th><th>Patient</th><th>Test</th><th>Collection</th><th>Status</th><th></th></tr>${rows}
    </table></div>`;

  const tests = await api('/api/lab-tests');
  rows = '';
  for (const t of tests) {
    const measures = t.parameters.map((p) => esc(p.name)).join(', ');
    rows += `<tr><td><b>${esc(t.name)}</b><br><span class="muted">${measures}</span></td><td>₹${t.price}</td>
      <td>${t.homeCollection ? 'Home or lab' : 'Lab only'}</td>
      <td><button class="btn btn-small btn-red" onclick="removeTest(${t.id})">Remove</button></td></tr>`;
  }
  document.getElementById('test-list').innerHTML = `
    <div class="table-box"><table><tr><th>Test</th><th>Price</th><th>Collection</th><th></th></tr>${rows}</table></div>`;
}

function markCollected(id) {
  doAction(api('/api/test-bookings/' + id + '/collected', 'PUT'), 'Sample marked as collected.', loadLab);
}

// Shows one input for each thing the test measures
function openReport(id) {
  reportBooking = testBookings.find((b) => b.id === id);
  document.getElementById('report-title').textContent = 'Enter report: ' + reportBooking.test.name;
  document.getElementById('report-info').textContent = 'Patient: ' + reportBooking.patientName;

  let html = '<div class="table-box"><table><tr><th>Measured</th><th>Value</th><th>Normal range</th><th>Flag</th></tr>';
  reportBooking.test.parameters.forEach((p, index) => {
    const range = p.normal ? p.normal : p.min + ' – ' + p.max + ' ' + p.unit;
    html += `<tr>
      <td>${esc(p.name)}</td>
      <td><input id="value-${index}" oninput="showFlag(${index})" placeholder="${p.normal ? esc(p.normal) : 'Number'}"></td>
      <td>${esc(range)}</td>
      <td id="flag-${index}"></td>
    </tr>`;
  });
  html += '</table></div>';
  document.getElementById('report-fields').innerHTML = html;
  document.getElementById('report-remarks').value = '';
  document.getElementById('report-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Shows Low / High / Normal while the admin types
function showFlag(index) {
  const p = reportBooking.test.parameters[index];
  const value = document.getElementById('value-' + index).value.trim();
  let flag = '';
  if (value !== '') {
    if (p.normal) flag = value.toLowerCase() === p.normal.toLowerCase() ? 'Normal' : 'Abnormal';
    else if (Number(value) < p.min) flag = 'Low';
    else if (Number(value) > p.max) flag = 'High';
    else flag = 'Normal';
  }
  document.getElementById('flag-' + index).innerHTML = flag ? statusBadge(flag) : '';
}

function saveReport() {
  const values = {};
  reportBooking.test.parameters.forEach((p, index) => {
    values[p.name] = document.getElementById('value-' + index).value;
  });
  const request = api('/api/test-bookings/' + reportBooking.id + '/report', 'POST', {
    values: values,
    remarks: document.getElementById('report-remarks').value,
  });
  doAction(request, 'Report saved. The patient can now see and download it.', () => {
    document.getElementById('report-box').classList.add('hidden');
    loadLab();
  });
}

document.getElementById('test-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const request = api('/api/lab-tests', 'POST', {
    name: document.getElementById('t-name').value,
    price: document.getElementById('t-price').value,
    parameterName: document.getElementById('t-param').value,
    unit: document.getElementById('t-unit').value,
    min: document.getElementById('t-min').value,
    max: document.getElementById('t-max').value,
    homeCollection: document.getElementById('t-home').checked,
  });
  doAction(request, 'Lab test added.', () => {
    document.getElementById('test-form').reset();
    loadLab();
  });
});

function removeTest(id) {
  if (!confirm('Remove this test?')) return;
  doAction(api('/api/lab-tests/' + id, 'DELETE'), 'Test removed.', loadLab);
}

// ================= Blood bank =================
async function loadBlood() {
  // Requests
  const requests = await api('/api/blood-requests');
  let rows = '';
  for (const r of requests) {
    let buttons = '';
    if (r.status === 'Pending') buttons += `<button class="btn btn-small btn-light" onclick="updateRequest(${r.id}, 'approve')">Approve</button> `;
    if (r.status === 'Pending' || r.status === 'Approved') {
      buttons += `<button class="btn btn-small" onclick="updateRequest(${r.id}, 'fulfil')">Fulfil</button>
        <button class="btn btn-small btn-red" onclick="updateRequest(${r.id}, 'reject')">Reject</button>`;
    }
    rows += `<tr>
      <td><span class="blood-group">${r.bloodGroup}</span> × ${r.units}</td>
      <td><b>${esc(r.patientName)}</b><br><span class="muted">${esc(r.hospital)} · ${esc(r.phone)}</span></td>
      <td>${statusBadge(r.urgency)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${buttons}</td>
    </tr>`;
  }
  document.getElementById('request-list').innerHTML = requests.length === 0 ? '<p class="muted">No requests.</p>' : `
    <div class="table-box"><table>
      <tr><th>Blood</th><th>Patient</th><th>Urgency</th><th>Status</th><th></th></tr>${rows}
    </table></div>`;

  // Stock
  const result = await api('/api/blood-stock');
  let html = '';
  for (const row of result.stock) {
    html += `<div class="stock-row" style="grid-template-columns: 50px 1fr 80px">
      <span class="blood-group">${row.group}</span>
      <input type="number" min="0" id="stock-${row.group}" value="${row.units}">
      <button class="btn btn-small" onclick="saveStock('${row.group}')">Save</button>
    </div>`;
  }
  document.getElementById('stock-list').innerHTML = html;

  // Donors
  const donors = await api('/api/donors');
  rows = '';
  for (const d of donors) {
    const verifyButton = d.verified ? '' : `<button class="btn btn-small" onclick="verifyDonor(${d.id})">Verify</button> `;
    rows += `<tr>
      <td><span class="blood-group">${d.bloodGroup}</span></td>
      <td><b>${esc(d.name)}</b><br><span class="muted">${esc(d.city)} · ${d.age} yrs · ${d.weight} kg</span></td>
      <td>${statusBadge(d.verified ? 'Verified' : 'Not verified')}<br><span class="muted">${esc(d.reason)}</span></td>
      <td>${verifyButton}<button class="btn btn-small btn-light" onclick="recordDonation(${d.id})">Donated today</button></td>
    </tr>`;
  }
  document.getElementById('donor-list').innerHTML = `<div class="table-box"><table>${rows}</table></div>`;
}

function updateRequest(id, action) {
  const words = { approve: 'Request approved.', reject: 'Request rejected.', fulfil: 'Request fulfilled. Stock updated.' };
  doAction(api('/api/blood-requests/' + id, 'PUT', { action: action }), words[action], loadBlood);
}

function saveStock(group) {
  const units = document.getElementById('stock-' + group).value;
  doAction(api('/api/blood-stock', 'PUT', { group: group, units: units }), group + ' stock saved.', loadBlood);
}

function verifyDonor(id) {
  doAction(api('/api/donors/' + id + '/verify', 'PUT'), 'Donor verified. Patients can now find them.', loadBlood);
}

function recordDonation(id) {
  doAction(api('/api/donors/' + id + '/donated', 'PUT'), 'Donation recorded. 1 unit added to stock.', loadBlood);
}

// ================= AI logs and feedback =================
async function loadReports() {
  const logs = await api('/api/ai-logs');
  let rows = '';
  for (const l of logs) {
    rows += `<tr><td>${formatDate(l.date)}</td><td>${esc(l.patientName)}</td><td>${esc(l.symptoms.join(', '))}</td><td>${esc(l.result)}</td><td>${esc(l.urgency)}</td></tr>`;
  }
  document.getElementById('ai-logs').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Date</th><th>Patient</th><th>Symptoms</th><th>Result</th><th>Urgency</th></tr>${rows}
    </table></div>`;

  const feedback = await api('/api/feedback');
  rows = '';
  for (const f of feedback) {
    rows += `<tr><td>${esc(f.patientName)}</td><td>${esc(f.doctorName)}</td><td>${'⭐'.repeat(f.rating)}</td><td>${esc(f.comment)}</td></tr>`;
  }
  document.getElementById('feedback-list').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Patient</th><th>Doctor</th><th>Rating</th><th>Comment</th></tr>${rows}
    </table></div>`;
}

loadStats();
