// Login and sign up page

let selectedRole = 'patient';

// Which page to open after login
const HOME_PAGE = {
  patient: 'patient-home.html',
  doctor: 'doctor.html',
  admin: 'admin.html',
};

// If already logged in, go straight to the right page
const savedUser = getUser();
if (savedUser) {
  window.location.href = HOME_PAGE[savedUser.role];
}

// When a tab (Patient / Doctor / Admin) is clicked
function selectRole(role) {
  selectedRole = role;
  document.getElementById('tab-patient').classList.remove('active');
  document.getElementById('tab-doctor').classList.remove('active');
  document.getElementById('tab-admin').classList.remove('active');
  document.getElementById('tab-' + role).classList.add('active');

  // Only patients can create their own account
  document.getElementById('signup-link').style.display = role === 'patient' ? 'block' : 'none';
}

function fillDemo() {
  document.getElementById('email').value = selectedRole + '@demo.in';
  document.getElementById('password').value = 'demo1234';
}

function showSignup() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('signup-section').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('signup-section').classList.add('hidden');
  document.getElementById('login-section').classList.remove('hidden');
}

// Saves the login and opens the user's home page
function loginSuccess(result) {
  localStorage.setItem('token', result.token);
  localStorage.setItem('user', JSON.stringify(result.user));
  window.location.href = HOME_PAGE[result.user.role];
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); // stop the page from reloading
  try {
    const result = await api('/api/login', 'POST', {
      role: selectedRole,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
    });
    loginSuccess(result);
  } catch (error) {
    showMessage('login-message', error.message, 'error');
  }
});

document.getElementById('signup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/api/signup', 'POST', {
      name: document.getElementById('s-name').value,
      email: document.getElementById('s-email').value,
      password: document.getElementById('s-password').value,
      phone: document.getElementById('s-phone').value,
      dob: document.getElementById('s-dob').value,
      gender: document.getElementById('s-gender').value,
      bloodGroup: document.getElementById('s-blood').value,
      city: document.getElementById('s-city').value,
    });
    loginSuccess(result);
  } catch (error) {
    showMessage('signup-message', error.message, 'error');
  }
});
