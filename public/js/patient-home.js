// Patient home page: welcome, reminders and upcoming appointments

const user = checkLogin('patient');
showNavbar('patient', 'patient-home.html');
document.getElementById('welcome-name').textContent = 'Hello, ' + user.name.split(' ')[0];

async function loadHome() {
  const appointments = await api('/api/appointments');
  const tests = await api('/api/test-bookings');

  const today = todayText();
  const tomorrow = todayText(1);

  // ----- Automatic reminders: anything booked for today or tomorrow -----
  let reminders = '';
  for (const a of appointments) {
    if (a.status === 'Booked' && (a.date === today || a.date === tomorrow)) {
      const when = a.date === today ? 'today' : 'tomorrow';
      reminders += `<div class="reminder">⏰ Reminder: appointment with <b>${esc(a.doctorName)}</b> ${when} at ${formatTime(a.time)}.</div>`;
    }
  }
  for (const t of tests) {
    if (t.status === 'Booked' && (t.date === today || t.date === tomorrow)) {
      const when = t.date === today ? 'today' : 'tomorrow';
      const where = t.collection === 'Home' ? 'home sample collection' : 'lab visit';
      reminders += `<div class="reminder">⏰ Reminder: <b>${esc(t.test.name)}</b> ${when}, ${esc(t.timeSlot)} (${where}).</div>`;
    }
  }
  document.getElementById('reminders').innerHTML = reminders;

  // ----- Upcoming appointments -----
  const upcoming = appointments.filter((a) => a.status === 'Booked' && a.date >= today);
  if (upcoming.length === 0) {
    document.getElementById('upcoming').innerHTML =
      '<p class="muted">No upcoming appointments. <a href="doctors.html">Book a doctor</a></p>';
    return;
  }

  let rows = '';
  for (const a of upcoming) {
    rows += `<tr>
      <td>${formatDate(a.date)}<br><span class="muted">${formatTime(a.time)}</span></td>
      <td>${esc(a.doctorName)}<br><span class="muted">${esc(a.specialization)}</span></td>
      <td>${statusBadge(a.status)}</td>
    </tr>`;
  }
  document.getElementById('upcoming').innerHTML = `
    <div class="table-box"><table>
      <tr><th>Date</th><th>Doctor</th><th>Status</th></tr>
      ${rows}
    </table></div>`;
}

loadHome();
