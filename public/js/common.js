// Functions used by every page.

// Talks to our backend. Example: await api('/api/doctors')
// It sends the login token and turns the answer into a JavaScript object.
async function api(url, method = 'GET', body = null) {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: localStorage.getItem('token') || '',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const result = await response.json();

  // 401 = not logged in (for example after the server restarts)
  if (response.status === 401 && !url.includes('/login')) {
    localStorage.clear();
    window.location.href = 'index.html';
  }
  if (!response.ok) {
    throw new Error(result.error || 'Something went wrong');
  }
  return result;
}

// The logged-in user, saved in the browser at login
function getUser() {
  return JSON.parse(localStorage.getItem('user'));
}

// Sends the user back to the login page if they are not logged in
// with the right role. Every page calls this first.
function checkLogin(role) {
  const user = getUser();
  if (!user || user.role !== role) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

async function logout() {
  try {
    await api('/api/logout', 'POST');
  } catch (error) {
    // even if this fails, we still log out in the browser
  }
  localStorage.clear();
  window.location.href = 'index.html';
}

// Draws the top menu. "active" is the page we are on.
function showNavbar(role, active) {
  const menus = {
    patient: [
      ['patient-home.html', 'Home'],
      ['ai-assistant.html', 'AI Assistant'],
      ['doctors.html', 'Book Doctor'],
      ['my-appointments.html', 'My Appointments'],
      ['lab-tests.html', 'Lab Tests'],
      ['blood-bank.html', 'Blood Bank'],
      ['health-records.html', 'Health Records'],
    ],
    doctor: [['doctor.html', 'My Appointments']],
    admin: [['admin.html', 'Admin Panel']],
  };

  let links = '';
  for (const [page, label] of menus[role]) {
    const activeClass = page === active ? 'active' : '';
    links += `<a href="${page}" class="${activeClass}">${label}</a>`;
  }

  document.getElementById('navbar').innerHTML = `
    <div class="nav-top">
      <a class="logo" href="${menus[role][0][0]}"><span class="logo-icon">+</span> Smart Health Connect</a>
      <div class="nav-user">
        <span>${esc(getUser().name)}</span>
        <button class="btn btn-small btn-light" onclick="logout()">Logout</button>
      </div>
    </div>
    <div class="nav-links">${links}</div>`;
}

// Makes text safe to put inside HTML (so nobody can add their own HTML or scripts)
function esc(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// "2026-10-05" -> "Mon, 5 Oct 2026"
function formatDate(dateText) {
  if (!dateText) return '';
  const date = new Date(dateText + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// "14:30" -> "2:30 PM"
function formatTime(time) {
  let [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return hours + ':' + String(minutes).padStart(2, '0') + ' ' + ampm;
}

// Today's date as text, for example "2026-10-05"
function todayText(daysToAdd = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

// Age in years from date of birth
function getAge(dob) {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

// Shows a green (success) or red (error) message inside an element
function showMessage(elementId, text, type = 'success') {
  const box = document.getElementById(elementId);
  box.innerHTML = `<div class="message ${type}">${esc(text)}</div>`;
  if (type === 'success') {
    setTimeout(() => (box.innerHTML = ''), 4000);
  }
}

// Coloured label for a status like "Booked" or "Report Ready"
function statusBadge(status) {
  const colors = {
    Booked: 'blue', Completed: 'green', Cancelled: 'grey',
    'Sample Collected': 'orange', 'Report Ready': 'green',
    Pending: 'orange', Approved: 'blue', Fulfilled: 'green', Rejected: 'grey',
    Normal: 'green', Low: 'red', High: 'red', Abnormal: 'red',
    Critical: 'red', Urgent: 'orange',
    Verified: 'green', 'Not verified': 'orange',
  };
  return `<span class="badge ${colors[status] || 'grey'}">${esc(status)}</span>`;
}
