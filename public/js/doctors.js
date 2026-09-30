// Book a Doctor page: list of doctors, free time slots and booking

checkLogin('patient');
showNavbar('patient', 'doctors.html');

let doctors = [];
let chosenDoctor = null;
let chosenTime = null;

// The AI assistant can send us here with a speciality and a reason in the link,
// for example doctors.html?specialization=Dermatologist&reason=...
const params = new URLSearchParams(window.location.search);
const reasonFromAI = params.get('reason') || '';

async function loadSpecialities() {
  const departments = await api('/api/departments');
  const select = document.getElementById('specialization');
  for (const d of departments) {
    select.innerHTML += `<option>${esc(d.name)}</option>`;
  }
  if (params.get('specialization')) select.value = params.get('specialization');
  loadDoctors();
}

async function loadDoctors() {
  const specialization = document.getElementById('specialization').value;
  doctors = await api('/api/doctors?specialization=' + encodeURIComponent(specialization));

  if (doctors.length === 0) {
    document.getElementById('doctor-list').innerHTML = '<p class="muted">No doctors found.</p>';
    return;
  }

  let html = '';
  for (const d of doctors) {
    const rating = d.rating ? '⭐ ' + d.rating + ' (' + d.reviews + ' reviews)' : 'New doctor';
    html += `
      <div class="card doctor-card">
        <h3>${esc(d.name)}</h3>
        <p class="muted">${esc(d.specialization)} · ${esc(d.qualification)}</p>
        <p>${d.experience} years experience<br>${esc(d.timings)}<br>${rating}</p>
        <p><b>Fee: ₹${d.fee}</b></p>
        <button class="btn" onclick="openBooking(${d.id})">Book</button>
      </div>`;
  }
  document.getElementById('doctor-list').innerHTML = html;
}

function openBooking(doctorId) {
  chosenDoctor = doctors.find((d) => d.id === doctorId);
  chosenTime = null;
  document.getElementById('booking-title').textContent = 'Book appointment with ' + chosenDoctor.name;
  document.getElementById('booking-info').textContent = chosenDoctor.specialization + ' · Fee ₹' + chosenDoctor.fee + ' (pay at the hospital)';
  document.getElementById('booking-reason').value = reasonFromAI;
  document.getElementById('booking-message').innerHTML = '';

  // Dates allowed: today to 30 days ahead
  const dateInput = document.getElementById('booking-date');
  dateInput.min = todayText();
  dateInput.max = todayText(30);
  dateInput.value = todayText();

  document.getElementById('booking-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadSlots();
}

function closeBooking() {
  document.getElementById('booking-box').classList.add('hidden');
}

// When the date changes, load the free slots again
document.getElementById('booking-date').addEventListener('change', loadSlots);

async function loadSlots() {
  const date = document.getElementById('booking-date').value;
  chosenTime = null;
  document.getElementById('confirm-button').disabled = true;

  const slots = await api('/api/doctors/' + chosenDoctor.id + '/slots?date=' + date);
  if (slots.length === 0) {
    document.getElementById('slots').innerHTML = '<p class="muted">The hospital is closed on Sunday. Please choose another date.</p>';
    return;
  }

  let html = '';
  for (const slot of slots) {
    // booked slots are shown but cannot be clicked
    html += `<button class="slot" onclick="chooseTime(this, '${slot.time}')" ${slot.booked ? 'disabled' : ''}>${formatTime(slot.time)}</button>`;
  }
  document.getElementById('slots').innerHTML = html;
}

function chooseTime(button, time) {
  chosenTime = time;
  for (const b of document.querySelectorAll('.slot')) b.classList.remove('selected');
  button.classList.add('selected');
  document.getElementById('confirm-button').disabled = false;
}

async function confirmBooking() {
  try {
    await api('/api/appointments', 'POST', {
      doctorId: chosenDoctor.id,
      date: document.getElementById('booking-date').value,
      time: chosenTime,
      reason: document.getElementById('booking-reason').value,
    });
    alert('Appointment booked with ' + chosenDoctor.name + '!');
    window.location.href = 'my-appointments.html';
  } catch (error) {
    showMessage('booking-message', error.message, 'error');
    loadSlots(); // refresh, the slot may have been taken
  }
}

loadSpecialities();
