// My Appointments page: cancel, reschedule, view prescription, rate the visit

checkLogin('patient');
showNavbar('patient', 'my-appointments.html');

let appointments = [];
let selected = null; // the appointment being rescheduled or rated
let newTime = null;

async function loadAppointments() {
  appointments = await api('/api/appointments');
  const today = todayText();

  const upcoming = appointments.filter((a) => a.status === 'Booked' && a.date >= today);
  const past = appointments.filter((a) => !(a.status === 'Booked' && a.date >= today)).reverse();

  // Upcoming table
  let rows = '';
  for (const a of upcoming) {
    rows += `<tr>
      <td>${formatDate(a.date)}<br><span class="muted">${formatTime(a.time)}</span></td>
      <td>${esc(a.doctorName)}<br><span class="muted">${esc(a.specialization)}</span></td>
      <td>${esc(a.reason)}</td>
      <td>
        <button class="btn btn-small btn-light" onclick="openReschedule(${a.id})">Reschedule</button>
        <button class="btn btn-small btn-red" onclick="cancelAppointment(${a.id})">Cancel</button>
      </td>
    </tr>`;
  }
  document.getElementById('upcoming-list').innerHTML = upcoming.length === 0
    ? '<p class="muted">No upcoming appointments. <a href="doctors.html">Book a doctor</a></p>'
    : `<div class="table-box"><table><tr><th>Date</th><th>Doctor</th><th>Reason</th><th></th></tr>${rows}</table></div>`;

  // Past table
  rows = '';
  for (const a of past) {
    let buttons = '';
    if (a.prescription) {
      buttons += `<button class="btn btn-small" onclick="showPrescription(${a.id})">Prescription</button> `;
    }
    if (a.status === 'Completed' && !a.feedback) {
      buttons += `<button class="btn btn-small btn-light" onclick="openFeedback(${a.id})">Rate visit</button>`;
    }
    if (a.feedback) {
      buttons += `<span class="muted">Your rating: ${'⭐'.repeat(a.feedback.rating)}</span>`;
    }
    rows += `<tr>
      <td>${formatDate(a.date)}<br><span class="muted">${formatTime(a.time)}</span></td>
      <td>${esc(a.doctorName)}<br><span class="muted">${esc(a.specialization)}</span></td>
      <td>${statusBadge(a.status)}</td>
      <td>${buttons}</td>
    </tr>`;
  }
  document.getElementById('past-list').innerHTML = past.length === 0
    ? '<p class="muted">No past appointments yet.</p>'
    : `<div class="table-box"><table><tr><th>Date</th><th>Doctor</th><th>Status</th><th></th></tr>${rows}</table></div>`;
}

function closeBox(id) {
  document.getElementById(id).classList.add('hidden');
}

// ---------- Cancel ----------
async function cancelAppointment(id) {
  if (!confirm('Do you want to cancel this appointment?')) return;
  try {
    await api('/api/appointments/' + id + '/cancel', 'PUT');
    showMessage('page-message', 'Appointment cancelled.');
    loadAppointments();
  } catch (error) {
    showMessage('page-message', error.message, 'error');
  }
}

// ---------- Reschedule ----------
function openReschedule(id) {
  selected = appointments.find((a) => a.id === id);
  document.getElementById('reschedule-info').textContent =
    selected.doctorName + ' – now on ' + formatDate(selected.date) + ' at ' + formatTime(selected.time);
  const dateInput = document.getElementById('new-date');
  dateInput.min = todayText();
  dateInput.max = todayText(30);
  dateInput.value = selected.date;
  document.getElementById('reschedule-message').innerHTML = '';
  document.getElementById('reschedule-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadNewSlots();
}

document.getElementById('new-date').addEventListener('change', loadNewSlots);

async function loadNewSlots() {
  newTime = null;
  document.getElementById('save-reschedule').disabled = true;
  const date = document.getElementById('new-date').value;
  const slots = await api('/api/doctors/' + selected.doctorId + '/slots?date=' + date);
  if (slots.length === 0) {
    document.getElementById('new-slots').innerHTML = '<p class="muted">Closed on Sunday.</p>';
    return;
  }
  let html = '';
  for (const slot of slots) {
    html += `<button class="slot" onclick="chooseNewTime(this, '${slot.time}')" ${slot.booked ? 'disabled' : ''}>${formatTime(slot.time)}</button>`;
  }
  document.getElementById('new-slots').innerHTML = html;
}

function chooseNewTime(button, time) {
  newTime = time;
  for (const b of document.querySelectorAll('#new-slots .slot')) b.classList.remove('selected');
  button.classList.add('selected');
  document.getElementById('save-reschedule').disabled = false;
}

async function saveReschedule() {
  try {
    await api('/api/appointments/' + selected.id + '/reschedule', 'PUT', {
      date: document.getElementById('new-date').value,
      time: newTime,
    });
    closeBox('reschedule-box');
    showMessage('page-message', 'Appointment rescheduled.');
    loadAppointments();
  } catch (error) {
    showMessage('reschedule-message', error.message, 'error');
  }
}

// ---------- Prescription ----------
function showPrescription(id) {
  const a = appointments.find((x) => x.id === id);
  const p = a.prescription;
  let medicines = '';
  for (const m of p.medicines) medicines += `<li>${esc(m)}</li>`;

  document.getElementById('prescription-box').innerHTML = `
    <h2>Prescription</h2>
    <p class="muted">${esc(a.doctorName)} · ${formatDate(a.date)}</p>
    <h3>Diagnosis</h3><p>${esc(p.diagnosis)}</p>
    <h3>Medicines</h3><ol>${medicines}</ol>
    <h3>Advice</h3><p>${esc(p.advice || '-')}</p>
    <button class="btn" onclick="downloadPrescription(appointments.find((x) => x.id === ${a.id}))">Download PDF</button>
    <button class="btn btn-light" onclick="closeBox('prescription-box')">Close</button>`;
  document.getElementById('prescription-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Feedback ----------
function openFeedback(id) {
  selected = appointments.find((a) => a.id === id);
  document.getElementById('feedback-info').textContent = selected.doctorName + ' · ' + formatDate(selected.date);
  document.getElementById('feedback-message').innerHTML = '';
  document.getElementById('feedback-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveFeedback() {
  try {
    await api('/api/appointments/' + selected.id + '/feedback', 'POST', {
      rating: document.getElementById('rating').value,
      comment: document.getElementById('comment').value,
    });
    closeBox('feedback-box');
    showMessage('page-message', 'Thank you for your feedback!');
    loadAppointments();
  } catch (error) {
    showMessage('feedback-message', error.message, 'error');
  }
}

loadAppointments();
