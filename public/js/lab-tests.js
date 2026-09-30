// Lab Tests page: list of tests, booking, my bookings and reports

checkLogin('patient');
showNavbar('patient', 'lab-tests.html');

let tests = [];
let bookings = [];
let chosenTest = null;

async function loadTests() {
  tests = await api('/api/lab-tests');
  let html = '';
  for (const t of tests) {
    html += `
      <div class="card">
        <h3>${esc(t.name)}</h3>
        <p class="muted">${esc(t.preparation)}<br>
          ${t.homeCollection ? '🏠 Home collection available' : '🏥 Lab visit only'}</p>
        <p><b>₹${t.price}</b></p>
        <button class="btn" onclick="openBooking(${t.id})">Book</button>
      </div>`;
  }
  document.getElementById('test-list').innerHTML = html;

  // Time slots for the drop-down
  const slots = await api('/api/lab-time-slots');
  for (const s of slots) {
    document.getElementById('time-slot').innerHTML += `<option>${esc(s)}</option>`;
  }
}

async function loadMyBookings() {
  bookings = await api('/api/test-bookings');
  if (bookings.length === 0) {
    document.getElementById('my-bookings').innerHTML = '<p class="muted">You have not booked any tests yet.</p>';
    return;
  }
  let rows = '';
  for (const b of bookings) {
    let action = '';
    if (b.status === 'Booked') action = `<button class="btn btn-small btn-red" onclick="cancelTest(${b.id})">Cancel</button>`;
    if (b.status === 'Report Ready') action = `<button class="btn btn-small" onclick="showReport(${b.id})">View report</button>`;
    rows += `<tr>
      <td>${esc(b.test.name)}</td>
      <td>${formatDate(b.date)}<br><span class="muted">${esc(b.timeSlot)}</span></td>
      <td>${b.collection === 'Home' ? 'Home' : 'Lab visit'}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${action}</td>
    </tr>`;
  }
  document.getElementById('my-bookings').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Test</th><th>Date</th><th>Collection</th><th>Status</th><th></th></tr>${rows}
    </table></div>`;
}

function closeBox(id) {
  document.getElementById(id).classList.add('hidden');
}

function openBooking(testId) {
  chosenTest = tests.find((t) => t.id === testId);
  document.getElementById('booking-title').textContent = 'Book ' + chosenTest.name;
  document.getElementById('booking-info').textContent = '₹' + chosenTest.price + ' · ' + chosenTest.preparation;

  const dateInput = document.getElementById('test-date');
  dateInput.min = todayText();
  dateInput.max = todayText(30);
  dateInput.value = todayText(1);

  // Some tests need a lab visit, so hide the "Home" option for them
  const collection = document.getElementById('collection');
  collection.value = chosenTest.homeCollection ? 'Home' : 'Lab';
  collection.options[0].disabled = !chosenTest.homeCollection;
  toggleAddress();

  document.getElementById('booking-message').innerHTML = '';
  document.getElementById('booking-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// The address box is needed only for home collection
function toggleAddress() {
  const isHome = document.getElementById('collection').value === 'Home';
  document.getElementById('address-field').style.display = isHome ? 'block' : 'none';
}

async function confirmTestBooking() {
  try {
    await api('/api/test-bookings', 'POST', {
      testId: chosenTest.id,
      date: document.getElementById('test-date').value,
      timeSlot: document.getElementById('time-slot').value,
      collection: document.getElementById('collection').value,
      address: document.getElementById('address').value,
    });
    closeBox('booking-box');
    showMessage('page-message', chosenTest.name + ' booked successfully.');
    loadMyBookings();
  } catch (error) {
    showMessage('booking-message', error.message, 'error');
  }
}

async function cancelTest(id) {
  if (!confirm('Cancel this test booking?')) return;
  try {
    await api('/api/test-bookings/' + id + '/cancel', 'PUT');
    showMessage('page-message', 'Test booking cancelled.');
    loadMyBookings();
  } catch (error) {
    showMessage('page-message', error.message, 'error');
  }
}

function showReport(id) {
  const b = bookings.find((x) => x.id === id);
  document.getElementById('report-box').innerHTML = reportHtml(b) + `
    <br>
    <button class="btn" onclick="downloadReport(bookings.find((x) => x.id === ${b.id}))">Download PDF</button>
    <button class="btn btn-light" onclick="closeBox('report-box')">Close</button>`;
  document.getElementById('report-box').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// The report as a table. Values outside the normal range get a red label.
function reportHtml(b) {
  let rows = '';
  for (const r of b.report.results) {
    rows += `<tr><td>${esc(r.name)}</td><td><b>${esc(r.value)}</b> ${esc(r.unit)}</td><td>${esc(r.range)} ${esc(r.unit)}</td><td>${statusBadge(r.flag)}</td></tr>`;
  }
  return `
    <h2>${esc(b.test.name)} – Report</h2>
    <p class="muted">Sample: ${formatDate(b.date)} · Report: ${formatDate(b.report.date)}</p>
    <div class="table-box"><table>
      <tr><th>Parameter</th><th>Result</th><th>Normal range</th><th>Flag</th></tr>${rows}
    </table></div>
    <p><b>Remarks:</b> ${esc(b.report.remarks)}</p>`;
}

loadTests();
loadMyBookings();
