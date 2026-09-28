// Login / sign-up page.
(function () {
  const { esc, icon } = UI;
  const ROLES = [
    { id: 'patient', label: 'Patient', demo: 'patient@demo.in' },
    { id: 'doctor', label: 'Doctor', demo: 'doctor@demo.in' },
    { id: 'lab', label: 'Lab', demo: 'lab@demo.in' },
    { id: 'admin', label: 'Admin', demo: 'admin@demo.in' },
  ];
  const DEMO_PASSWORD = 'demo1234';

  // Already logged in? Go straight to the right dashboard.
  if (API.session.token && API.session.user) {
    location.replace(API.homeFor(API.session.user.role));
    return;
  }

  document.getElementById('modules').innerHTML = [
    ['ai', 'AI Health Assistant', 'Symptoms to advice, urgency and the right specialist'],
    ['doctor', 'Doctor appointments', 'Search by speciality, pick a slot, get your prescription'],
    ['flask', 'Lab tests', 'Home collection or lab visit, reports online'],
    ['drop', 'Blood bank', 'Live stock, donors near you, emergency requests'],
  ]
    .map(([ic, t, d]) => `<div>${icon(ic)}<p><b>${t}</b><span>${d}</span></p></div>`)
    .join('');

  const card = document.getElementById('card');
  let role = new URLSearchParams(location.search).get('role') || 'patient';
  if (!ROLES.some((r) => r.id === role)) role = 'patient';

  function renderLogin(message = '') {
    const r = ROLES.find((x) => x.id === role);
    card.innerHTML = `
      <h2>Log in</h2>
      <p>Choose who you are, then enter your email and password.</p>
      ${message}
      <div class="role-tabs" role="tablist" aria-label="Account type">
        ${ROLES.map((x) => `<button role="tab" type="button" data-role="${x.id}" aria-selected="${x.id === role}">${x.label}</button>`).join('')}
      </div>
      <form id="login" class="stack" novalidate>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
        <div class="form-error" hidden role="alert"></div>
        <button class="btn block" type="submit">Log in as ${esc(r.label.toLowerCase())}</button>
      </form>
      ${role === 'patient' ? `<p class="small" style="margin-top:16px">New here? <button class="link-btn" id="to-signup">Create a patient account</button></p>` : `<p class="small muted" style="margin-top:16px">${r.label} accounts are created by the hospital admin.</p>`}
      <div class="demo-box">
        <div>Demo: <code>${esc(r.demo)}</code><br><span class="muted">Password <code>${DEMO_PASSWORD}</code></span></div>
        <button class="btn ghost sm" type="button" id="fill-demo">Use demo account</button>
      </div>`;

    card.querySelector('.role-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-role]');
      if (!b) return;
      role = b.dataset.role;
      history.replaceState(null, '', `/?role=${role}`);
      renderLogin();
      card.querySelector(`[data-role="${role}"]`).focus();
    });
    card.querySelector('#fill-demo').addEventListener('click', () => {
      card.querySelector('#email').value = r.demo;
      card.querySelector('#password').value = DEMO_PASSWORD;
      card.querySelector('[type=submit]').focus();
    });
    const signup = card.querySelector('#to-signup');
    if (signup) signup.addEventListener('click', renderSignup);

    const form = card.querySelector('#login');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      const v = UI.readForm(form);
      if (!v.email || !v.password) {
        err.textContent = 'Enter your email and password.';
        err.hidden = false;
        return;
      }
      try {
        const data = await UI.busy(form.querySelector('[type=submit]'), () => API.post('/auth/login', { ...v, role }));
        API.session.save(data.token, data.user);
        location.href = API.homeFor(data.user.role);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  function renderSignup() {
    card.innerHTML = `
      <h2>Create your account</h2>
      <p>For patients. It takes a minute and you can book right after.</p>
      <form id="signup" novalidate>
        <div class="form-grid">
          ${UI.fieldHtml({ name: 'name', label: 'Full name', required: true, span: 2, autocomplete: 'name' })}
          ${UI.fieldHtml({ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' })}
          ${UI.fieldHtml({ name: 'phone', label: 'Mobile number', type: 'tel', placeholder: '98xxxxxxxx', autocomplete: 'tel' })}
          ${UI.fieldHtml({ name: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 6 characters', autocomplete: 'new-password' })}
          ${UI.fieldHtml({ name: 'dob', label: 'Date of birth', type: 'date', max: UI.today() })}
          ${UI.fieldHtml({ name: 'gender', label: 'Gender', type: 'select', placeholder: 'Select', options: [['female', 'Female'], ['male', 'Male'], ['other', 'Other']] })}
          ${UI.fieldHtml({ name: 'blood_group', label: 'Blood group', type: 'select', placeholder: "Don't know", options: UI.BLOOD_GROUPS })}
          ${UI.fieldHtml({ name: 'city', label: 'City', span: 2, placeholder: 'e.g. Noida' })}
        </div>
        <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
        <button class="btn block" type="submit" style="margin-top:18px">Create account</button>
      </form>
      <p class="small" style="margin-top:16px">Already registered? <button class="link-btn" id="to-login">Log in</button></p>`;
    card.querySelector('#to-login').addEventListener('click', () => renderLogin());
    const form = card.querySelector('#signup');
    form.querySelector('input').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      try {
        const data = await UI.busy(form.querySelector('[type=submit]'), () => API.post('/auth/register', UI.readForm(form)));
        API.session.save(data.token, data.user);
        location.href = '/patient';
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  const expired = new URLSearchParams(location.search).get('expired');
  renderLogin(expired ? `<div class="notice warn" style="margin-bottom:16px">${icon('info')}<div>Your session ended. Please log in again.</div></div>` : '');
})();
