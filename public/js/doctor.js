// Doctor page: see appointments, write prescriptions, complete visits

const user = checkLogin('doctor');
showNavbar('doctor', 'doctor.html');
document.getElementById('doctor-name').textContent = 'Welcome, ' + user.name;

let appointments = [];
let filter = 'today';
let selected = null; // the appointment we are writing a prescription for

async function loadAppointments() {
  appointments = await api('/api/appointments');
  const today = todayText();

  // Numbers at the top
  const todays = appointments.filter((a) => a.date === today && a.status !== 'Cancelled');
  document.getElementById('count-today').textContent = todays.length;
  document.getElementById('count-waiting').textContent = todays.filter((a) => a.status === 'Booked').length;

  const ratings = appointments.filter((a) => a.feedback).map((a) => a.feedback.rating);
  if (ratings.length > 0) {
    const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    document.getElementById('count-rating').textContent = '⭐ ' + average.toFixed(1);
  }

  showList();
}

function setFilter(name) {
  filter = name;
  for (const f of ['today', 'upcoming', 'completed', 'all']) {
    document.getElementById('filter-' + f).classList.remove('active');
  }
  document.getElementById('filter-' + name).classList.add('active');
  showList();
}

function showList() {
  const today = todayText();
  let list = appointments;
  if (filter === 'today') list = list.filter((a) => a.date === today);
  if (filter === 'upcoming') list = list.filter((a) => a.date > today && a.status === 'Booked');
  if (filter === 'completed') list = list.filter((a) => a.status === 'Completed').reverse();

  if (list.length === 0) {
    document.getElementById('appointment-list').innerHTML = '<p class="muted">No appointments here.</p>';
    return;
  }

  let rows = '';
  for (const a of list) {
    let buttons = '';
    if (a.status === 'Booked' && a.date <= today) {
      buttons = `<button class="btn btn-small" onclick="openPrescription(${a.id})">Write prescription</button> `;
    }
    if (a.status === 'Booked') {
      buttons += `<button class="btn btn-small btn-light" onclick="cancelAppointment(${a.id})">Cancel</button>`;
    }
    if (a.prescription) {
      buttons = `<button class="btn btn-small btn-light" onclick="viewPrescription(${a.id})">View prescription</button>`;
    }
    rows += `<tr>
      <td>${formatDate(a.date)}<br><b>${formatTime(a.time)}</b></td>
      <td><b>${esc(a.patientName)}</b><br><span class="muted">${esc(a.patientGender)}, ${getAge(a.patientDob)} yrs · ${esc(a.patientPhone)}</span></td>
      <td>${esc(a.reason)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${buttons}</td>
    </tr>`;
  }
  document.getElementById('appointment-list').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th></th></tr>${rows}
    </table></div>`;
}

function closeBox(id) {
  document.getElementById(id).classList.add('hidden');
}

function openPrescription(id) {
  selected = appointments.find((a) => a.id === id);
  document.getElementById('patient-info').textContent =
    selected.patientName + ' · ' + formatTime(selected.time) + ' · Reason: ' + (selected.reason || '-');
  document.getElementById('prescription-form').reset();
  document.getElementById('prescription-message').innerHTML = '';
  document.getElementById('prescription-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('prescription-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/appointments/' + selected.id + '/prescription', 'POST', {
      diagnosis: document.getElementById('diagnosis').value,
      medicines: document.getElementById('medicines').value.split('\n'), // one medicine per line
      advice: document.getElementById('advice').value,
    });
    closeBox('prescription-box');
    showMessage('page-message', 'Visit completed. ' + selected.patientName + ' can now see the prescription.');
    loadAppointments();
  } catch (error) {
    showMessage('prescription-message', error.message, 'error');
  }
});

function viewPrescription(id) {
  const a = appointments.find((x) => x.id === id);
  const p = a.prescription;
  let medicines = '';
  for (const m of p.medicines) medicines += `<li>${esc(m)}</li>`;
  document.getElementById('view-box').innerHTML = `
    <h2>Prescription – ${esc(a.patientName)}</h2>
    <p class="muted">${formatDate(a.date)}</p>
    <h3>Diagnosis</h3><p>${esc(p.diagnosis)}</p>
    <h3>Medicines</h3><ol>${medicines}</ol>
    <h3>Advice</h3><p>${esc(p.advice || '-')}</p>
    ${a.feedback ? `<p><b>Patient rating:</b> ${'⭐'.repeat(a.feedback.rating)} ${esc(a.feedback.comment)}</p>` : ''}
    <button class="btn" onclick="downloadPrescription(appointments.find((x) => x.id === ${a.id}))">Download PDF</button>
    <button class="btn btn-light" onclick="closeBox('view-box')">Close</button>`;
  document.getElementById('view-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await api('/api/appointments/' + id + '/cancel', 'PUT');
    showMessage('page-message', 'Appointment cancelled.');
    loadAppointments();
  } catch (error) {
    showMessage('page-message', error.message, 'error');
  }
}

loadAppointments();
