// Admin portal.
(function () {
  const { esc, icon } = UI;
  const table = (head, rows, emptyHtml) =>
    rows.length
      ? `<div class="table-wrap"><table class="table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
      : emptyHtml;
  const intro = (title, text, action = '') => `<div class="page-intro"><div><h1>${esc(title)}</h1><p>${esc(text)}</p></div>${action}</div>`;
  const onClick = (root, sel, fn) =>
    root.addEventListener('click', (e) => {
      const el = e.target.closest(sel);
      if (el && root.contains(el)) fn(el, e);
    });
  const reload = () => Shell.go(location.hash);
  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) UI.toast(ok);
      Shell.refreshCounts();
      reload();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  };

  // =====================================================================
  // Overview
  // =====================================================================
  async function overview(view) {
    Shell.title('Overview');
    const [s, stock, reqs, donors] = await Promise.all([API.get('/admin/stats'), API.get('/blood/stock'), API.get('/blood/requests'), API.get('/blood/admin/donors')]);
    const open = reqs.filter((r) => ['pending', 'approved'].includes(r.status));
    const unverified = donors.filter((d) => !d.verified);
    const LEVELS = [['self_care', 'Self-care'], ['doctor_soon', 'Doctor in 1–2 days'], ['urgent', 'See a doctor today'], ['emergency', 'Emergency']];
    const totalAi = s.urgency_breakdown.reduce((n, r) => n + Number(r.n), 0);
    const colors = { self_care: 'var(--u-self)', doctor_soon: 'var(--u-soon)', urgent: 'var(--u-urgent)', emergency: 'var(--u-emerg)' };
    const stat = (href, n, label, alert = false) => `<a class="stat ${alert ? 'alert' : ''}" href="${href}"><b>${n}</b><span>${label}</span></a>`;

    view.innerHTML = `
      ${intro('Hospital overview', `Today is ${UI.fmtDate(UI.today(), { year: true })}. Items that need you are highlighted.`)}
      <div class="grid cols-4">
        ${stat('#/appointments', s.appointments_today, 'Appointments today')}
        ${stat('#/lab-bookings', s.lab_pending, 'Lab tests in progress')}
        ${stat('#/requests', s.requests_pending, 'Open blood requests', s.requests_pending > 0)}
        ${stat('#/donors', s.donors_unverified, 'Donors to verify', s.donors_unverified > 0)}
        ${stat('#/users', s.patients, 'Registered patients')}
        ${stat('#/doctors', s.doctors, 'Active doctors')}
        ${stat('#/feedback', s.avg_rating === '0.0' ? '–' : `${s.avg_rating} ★`, 'Average visit rating')}
        ${stat('#/ai', s.ai_consults_7d, 'AI consults this week')}
      </div>
      <section class="bank">
        <div class="bank-head"><div><h2>Blood stock</h2><p>${s.low_stock_groups.length ? `Low: ${esc(s.low_stock_groups.join(', '))}. Record donations or contact donors.` : 'All groups above the low-stock line.'}</p></div>
          <div class="row"><div class="bank-total"><b>${s.blood_units}</b><span>units</span></div><a class="btn mint sm" href="#/blood">Update stock</a></div></div>
        ${Views.tubes(stock.stock)}
      </section>
      <div class="split">
        <section class="panel">
          <div class="panel-head"><h2>Needs attention</h2></div>
          ${
            open.length || unverified.length
              ? [
                  ...open.slice(0, 5).map(
                    (r) => `<a class="donor-row" href="#/requests" style="color:inherit;text-decoration:none"><span class="bg-pill">${esc(r.blood_group)}</span><div class="grow">
                    <div class="row"><b style="font-weight:500">${r.units} unit${r.units > 1 ? 's' : ''} for ${esc(r.patient_name)}</b>${UI.badge('urgency', r.urgency)}</div>
                    <div class="small muted">${esc(r.hospital)}, ${esc(UI.ago(r.created_at))}</div></div>${UI.badge('request', r.status)}</a>`
                  ),
                  ...unverified.slice(0, 4).map(
                    (d) => `<a class="donor-row" href="#/donors" style="color:inherit;text-decoration:none"><span class="avatar">${icon('user', 'sm')}</span><div class="grow">
                    <b style="font-weight:500">${esc(d.name)} registered as a donor</b><div class="small muted">${esc(d.blood_group)}, ${esc(d.city)}</div></div><span class="badge amber">Verify</span></a>`
                  ),
                ].join('')
              : UI.empty('Nothing waiting', 'Blood requests and new donors will show up here.', '', 'check')
          }
        </section>
        <section class="panel">
          <div class="panel-head"><h2>AI triage results</h2><a class="small" href="#/ai">All consults</a></div>
          <div class="mini-bars">${LEVELS.map(([k, l]) => {
            const n = Number((s.urgency_breakdown.find((r) => r.urgency === k) || {}).n || 0);
            const pct = totalAi ? Math.round((n / totalAi) * 100) : 0;
            return `<div class="b"><span>${l}</span><div class="bar"><i style="width:${pct}%;background:${colors[k]}"></i></div><span class="small muted">${n}</span></div>`;
          }).join('')}</div>
          <p class="small muted" style="margin-top:10px">How the assistant sorted ${totalAi} consultation${totalAi === 1 ? '' : 's'} by urgency.</p>
        </section>
      </div>`;
    Views.fillTubes(view);
  }

  // =====================================================================
  // Appointments
  // =====================================================================
  async function appointments(view, { query }) {
    Shell.title('Appointments');
    const date = query.date || '';
    const status = query.status || '';
    const rows = await API.get('/appointments', { date, status });
    view.innerHTML = `
      ${intro('Appointments', 'Every booking across all doctors. Filter by date or status.')}
      <section class="panel flush">
        <form class="row" id="f" style="padding:16px 16px 0;align-items:flex-end">
          <div class="field" style="width:180px"><label for="fd">Date</label><input id="fd" type="date" value="${esc(date)}"></div>
          <div class="field" style="width:180px"><label for="fs">Status</label><select id="fs"><option value="">Any status</option>${['booked', 'completed', 'cancelled', 'no_show'].map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${UI.cap(s)}</option>`).join('')}</select></div>
          <button class="btn ghost" type="submit">Apply</button>${date || status ? '<a class="btn ghost" href="#/appointments">Clear</a>' : ''}
        </form>
        <div style="margin-top:12px">${table(
          ['When', 'Patient', 'Doctor', 'Status', 'Fee', ''],
          rows.map(
            (a) => `<tr><td class="nowrap">${esc(UI.fmtDate(a.appt_date))}<br><span class="muted">${esc(UI.time12(a.slot_time))}</span></td>
            <td>${esc(a.patient_name)}<br><span class="muted small">${esc(a.reason || '')}</span></td>
            <td>${esc(a.doctor_name)}<br><span class="muted small">${esc(a.department)}</span></td>
            <td>${UI.badge('appt', a.status)}${a.feedback_rating ? `<br><span class="stars">${icon('star', 'sm')} ${a.feedback_rating}</span>` : ''}</td>
            <td>${UI.money(a.fee)}</td>
            <td class="actions">${a.status === 'booked' ? `<button class="btn danger sm" data-cancel="${a.id}">Cancel</button>` : ''}</td></tr>`
          ),
          UI.empty('No appointments match', 'Try another date or status.', '', 'calendar')
        )}</div>
      </section>`;
    view.querySelector('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      Shell.go(`#/appointments${API.qs({ date: view.querySelector('#fd').value, status: view.querySelector('#fs').value })}`);
    });
    onClick(view, '[data-cancel]', async (b) => {
      const a = rows.find((x) => String(x.id) === b.dataset.cancel);
      if (await UI.confirm({ title: 'Cancel this appointment?', message: `${a.patient_name} with ${a.doctor_name} on ${UI.fmtDate(a.appt_date)}. Both will be notified.`, confirmLabel: 'Cancel appointment', cancelLabel: 'Keep it', danger: true }))
        act(() => API.patch(`/appointments/${a.id}/cancel`), 'Appointment cancelled.');
    });
  }

  // =====================================================================
  // Doctors
  // =====================================================================
  async function doctors(view) {
    Shell.title('Doctors');
    const [rows, deps] = await Promise.all([API.get('/doctors', { all: 1 }), API.get('/doctors/departments')]);
    view.innerHTML = `
      ${intro('Doctors', 'Add doctors, set their fees and timings, or pause bookings for a doctor.', `<button class="btn" id="add">${icon('plus', 'sm')} Add doctor</button>`)}
      <section class="panel flush">${table(
        ['Doctor', 'Department', 'Timings', 'Fee', 'Rating', 'Status', ''],
        rows.map(
          (d) => `<tr class="${d.active ? '' : 'off'}"><td><b style="font-weight:500">${esc(d.name)}</b><br><span class="muted small">${esc(d.email)}</span></td>
          <td>${esc(d.department)}<br><span class="muted small">${esc(d.specialization)}</span></td>
          <td class="small">${esc(Views.workDays(d.work_days))}<br><span class="muted">${esc(Views.hours(d.start_time, d.end_time))}, ${d.slot_minutes} min</span></td>
          <td>${UI.money(d.fee)}</td><td>${UI.stars(d.rating, d.reviews)}</td>
          <td>${d.active ? '<span class="badge green">Taking bookings</span>' : '<span class="badge grey">Paused</span>'}</td>
          <td class="actions"><button class="btn ghost sm" data-edit="${d.id}">Edit</button><button class="btn ${d.active ? 'danger' : 'ghost'} sm" data-toggle="${d.id}">${d.active ? 'Pause' : 'Resume'}</button></td></tr>`
        ),
        UI.empty('No doctors yet', 'Add the first doctor to start taking bookings.', '', 'doctor')
      )}</section>`;
    const form = (d = null) =>
      UI.formModal({
        title: d ? `Edit ${d.name}` : 'Add a doctor',
        subtitle: d ? '' : 'The doctor logs in with this email and the temporary password, then changes it.',
        submitLabel: d ? 'Save changes' : 'Add doctor',
        wide: true,
        fields: [
          { name: 'name', label: 'Full name', required: true, value: d ? d.name : 'Dr. ' },
          ...(d ? [] : [{ name: 'email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Temporary password', required: true, value: 'welcome123', hint: 'At least 6 characters' }]),
          { name: 'phone', label: 'Phone', type: 'tel', optional: true, value: d ? d.phone || '' : '' },
          { name: 'department_id', label: 'Department', type: 'select', required: true, placeholder: 'Select', value: d ? d.department_id : '', options: deps.map((x) => [x.id, x.name]) },
          { name: 'specialization', label: 'Specialization', required: true, value: d ? d.specialization : '', placeholder: 'e.g. Dermatologist' },
          { name: 'qualification', label: 'Qualification', optional: true, value: d ? d.qualification || '' : '', placeholder: 'e.g. MBBS, MD' },
          { name: 'experience_years', label: 'Experience (years)', type: 'number', min: 0, max: 60, value: d ? d.experience_years : 0 },
          { name: 'fee', label: 'Consultation fee (₹)', type: 'number', min: 0, value: d ? d.fee : 500 },
          { name: 'room', label: 'Room', optional: true, value: d ? d.room || '' : '' },
          { name: 'work_days', label: 'Working days', type: 'days', span: 2, value: d ? d.work_days : '1,2,3,4,5,6' },
          { name: 'start_time', label: 'Starts at', type: 'time', value: d ? d.start_time : '10:00' },
          { name: 'end_time', label: 'Ends at', type: 'time', value: d ? d.end_time : '16:00' },
          { name: 'slot_minutes', label: 'Time per patient', type: 'select', value: d ? d.slot_minutes : 20, options: [10, 15, 20, 30, 45, 60].map((n) => [n, `${n} minutes`]) },
          { name: 'bio', label: 'Short bio', type: 'textarea', span: 2, optional: true, value: d ? d.bio || '' : '' },
        ],
        onSubmit: async (v) => {
          if (d) await API.patch(`/admin/doctors/${d.id}`, v);
          else await API.post('/admin/doctors', v);
          UI.toast(d ? 'Doctor updated.' : `${v.name} added. They can log in now.`);
          reload();
        },
      });
    view.querySelector('#add').addEventListener('click', () => form());
    onClick(view, '[data-edit]', (b) => form(rows.find((d) => String(d.id) === b.dataset.edit)));
    onClick(view, '[data-toggle]', (b) => {
      const d = rows.find((x) => String(x.id) === b.dataset.toggle);
      act(() => API.patch(`/admin/doctors/${d.id}`, { active: !d.active }), d.active ? `${d.name} is hidden from booking.` : `${d.name} is taking bookings again.`);
    });
  }

  // =====================================================================
  // Departments
  // =====================================================================
  async function departments(view) {
    Shell.title('Departments');
    const rows = await API.get('/doctors/departments');
    view.innerHTML = `
      ${intro('Departments', 'Departments group doctors for search. The AI assistant routes patients to them by name.', `<button class="btn" id="add">${icon('plus', 'sm')} Add department</button>`)}
      <section class="panel flush">${table(
        ['Department', 'What it covers', 'Doctors', ''],
        rows.map((d) => `<tr><td><b style="font-weight:500">${esc(d.name)}</b></td><td class="muted">${esc(d.description || '')}</td><td>${d.doctor_count}</td><td class="actions"><button class="btn ghost sm" data-edit="${d.id}">Edit</button></td></tr>`),
        UI.empty('No departments', '', '', 'building')
      )}</section>
      <p class="small muted">Renaming a department that the AI assistant uses (for example "General Medicine") stops the assistant from suggesting its doctors.</p>`;
    const form = (d = null) =>
      UI.formModal({
        title: d ? `Edit ${d.name}` : 'Add a department',
        submitLabel: d ? 'Save changes' : 'Add department',
        fields: [
          { name: 'name', label: 'Name', required: true, span: 2, value: d ? d.name : '' },
          { name: 'description', label: 'What it covers', type: 'textarea', span: 2, optional: true, value: d ? d.description || '' : '' },
        ],
        onSubmit: async (v) => {
          if (d) await API.patch(`/admin/departments/${d.id}`, v);
          else await API.post('/admin/departments', v);
          UI.toast(d ? 'Department updated.' : 'Department added.');
          reload();
        },
      });
    view.querySelector('#add').addEventListener('click', () => form());
    onClick(view, '[data-edit]', (b) => form(rows.find((d) => String(d.id) === b.dataset.edit)));
  }

  // =====================================================================
  // Lab tests catalogue
  // =====================================================================
  async function tests(view) {
    Shell.title('Lab tests');
    const rows = await API.get('/lab/tests', { all: 1 });
    view.innerHTML = `
      ${intro('Lab tests', 'The test menu patients book from. Each parameter\'s reference range is used to flag results automatically.', `<button class="btn" id="add">${icon('plus', 'sm')} Add test</button>`)}
      <section class="panel flush">${table(
        ['Test', 'Sample', 'Price', 'Report in', 'Collection', 'Parameters', ''],
        rows.map(
          (t) => `<tr class="${t.active ? '' : 'off'}"><td><b style="font-weight:500">${esc(t.name)}</b><br><span class="muted small">${esc(t.category)}</span></td>
          <td>${esc(t.sample_type)}</td><td>${UI.money(t.price)}</td><td>${t.turnaround_hours} h</td>
          <td>${t.home_collection ? 'Home or lab' : 'Lab only'}</td><td>${t.parameters.length}</td>
          <td class="actions"><button class="btn ghost sm" data-edit="${t.id}">Edit</button><button class="btn ${t.active ? 'danger' : 'ghost'} sm" data-toggle="${t.id}">${t.active ? 'Hide' : 'Show'}</button></td></tr>`
        ),
        UI.empty('No tests yet', '', '', 'flask')
      )}</section>`;

    const paramRow = (p = {}) => `<div class="param-row">
        <input class="input" data-k="name" placeholder="Parameter, e.g. Haemoglobin" aria-label="Parameter name" value="${esc(p.name || '')}">
        <input class="input" data-k="unit" placeholder="Unit" aria-label="Unit" value="${esc(p.unit || '')}">
        <input class="input" data-k="low" placeholder="Low" inputmode="decimal" aria-label="Lowest normal value" value="${esc(p.low ?? '')}">
        <input class="input" data-k="high" placeholder="High" inputmode="decimal" aria-label="Highest normal value" value="${esc(p.high ?? '')}">
        <input class="input" data-k="ref_text" placeholder="or text, e.g. Negative" aria-label="Normal result as text" value="${esc(p.ref_text || '')}">
        <button type="button" class="icon-btn" data-remove aria-label="Remove parameter">${icon('x')}</button></div>`;
    const form = (t = null) =>
      UI.formModal({
        title: t ? `Edit ${t.name}` : 'Add a lab test',
        submitLabel: t ? 'Save changes' : 'Add test',
        wide: true,
        fields: [
          { name: 'name', label: 'Test name', required: true, span: 2, value: t ? t.name : '' },
          { name: 'category', label: 'Category', required: true, value: t ? t.category : '', placeholder: 'e.g. Blood, Hormones' },
          { name: 'sample_type', label: 'Sample', value: t ? t.sample_type : 'Blood' },
          { name: 'price', label: 'Price (₹)', type: 'number', min: 0, required: true, value: t ? t.price : '' },
          { name: 'turnaround_hours', label: 'Report ready in (hours)', type: 'number', min: 1, value: t ? t.turnaround_hours : 24 },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, optional: true, value: t ? t.description || '' : '' },
          { name: 'preparation', label: 'Preparation', optional: true, span: 2, value: t ? t.preparation || '' : '', placeholder: 'e.g. 10–12 hours fasting' },
          { name: 'home_collection', label: 'Home sample collection available', type: 'checkbox', span: 2, value: t ? t.home_collection : true },
        ],
        extra: (box) => {
          box.innerHTML = `<div style="margin-top:18px"><span class="label" style="font-size:.86rem;font-weight:500">Result parameters</span>
            <p class="small muted" style="margin:2px 0 10px">Give a numeric range (low / high) or a text result that counts as normal.</p>
            <div id="params">${(t ? t.parameters : [{}]).map(paramRow).join('')}</div>
            <button type="button" class="btn ghost sm" id="add-param">${icon('plus', 'sm')} Add parameter</button></div>`;
          box.querySelector('#add-param').addEventListener('click', () => box.querySelector('#params').insertAdjacentHTML('beforeend', paramRow()));
          onClick(box, '[data-remove]', (b) => b.closest('.param-row').remove());
        },
        onSubmit: async (v, f) => {
          const parameters = [...f.querySelectorAll('.param-row')]
            .map((r) => Object.fromEntries([...r.querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.value.trim()])))
            .filter((p) => p.name);
          if (t) await API.patch(`/admin/tests/${t.id}`, { ...v, parameters });
          else await API.post('/admin/tests', { ...v, parameters });
          UI.toast(t ? 'Test updated.' : 'Test added to the menu.');
          reload();
        },
      });
    view.querySelector('#add').addEventListener('click', () => form());
    onClick(view, '[data-edit]', (b) => form(rows.find((t) => String(t.id) === b.dataset.edit)));
    onClick(view, '[data-toggle]', (b) => {
      const t = rows.find((x) => String(x.id) === b.dataset.toggle);
      act(() => API.patch(`/admin/tests/${t.id}`, { active: !t.active }), t.active ? `${t.name} hidden from patients.` : `${t.name} is bookable again.`);
    });
  }

  // =====================================================================
  // Lab bookings
  // =====================================================================
  async function labBookings(view, { query }) {
    Shell.title('Lab bookings');
    const status = query.status || '';
    const rows = await API.get('/lab/bookings', { status });
    view.innerHTML = `
      ${intro('Lab bookings', 'Every test booking. Lab technicians work through these in their sample queue.')}
      <div class="seg" id="st">${[['', 'All'], ['booked', 'Booked'], ['sample_collected', 'Collected'], ['processing', 'Processing'], ['report_ready', 'Report ready'], ['cancelled', 'Cancelled']]
        .map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === status}">${l}</button>`)
        .join('')}</div>
      <section class="panel flush">${table(
        ['When', 'Patient', 'Test', 'Collection', 'Status', 'Price', ''],
        rows.map(
          (b) => `<tr><td class="nowrap">${esc(UI.fmtDate(b.booking_date))}<br><span class="muted small">${esc(UI.time12(b.time_slot))}</span></td>
          <td>${esc(b.patient_name)}</td><td>${esc(b.test_name)}</td><td>${b.collection_type === 'home' ? 'Home' : 'Lab'}</td>
          <td>${UI.badge('lab', b.status)}</td><td>${UI.money(b.price)}</td>
          <td class="actions">${b.report_id ? `<button class="btn ghost sm" data-report="${b.id}">Report</button>` : ''}${b.status === 'booked' ? `<button class="btn danger sm" data-cancel="${b.id}">Cancel</button>` : ''}</td></tr>`
        ),
        UI.empty('No bookings', '', '', 'flask')
      )}</section>`;
    UI.bindPressed(view.querySelector('#st'), (v) => Shell.go(`#/lab-bookings${API.qs({ status: v })}`));
    onClick(view, '[data-report]', (b) => Views.reportModal(b.dataset.report));
    onClick(view, '[data-cancel]', async (b) => {
      if (await UI.confirm({ title: 'Cancel this booking?', message: 'The patient will need to book again.', confirmLabel: 'Cancel booking', cancelLabel: 'Keep it', danger: true }))
        act(() => API.patch(`/lab/bookings/${b.dataset.cancel}/cancel`), 'Booking cancelled.');
    });
  }

  // =====================================================================
  // Blood stock
  // =====================================================================
  async function blood(view) {
    Shell.title('Blood stock');
    const data = await API.get('/blood/stock');
    const total = data.stock.reduce((n, s) => n + s.units, 0);
    view.innerHTML = `
      <section class="bank">
        <div class="bank-head"><div><h2>Blood stock</h2><p>Patients see these numbers live. Fulfilling a request and recording a donation update them automatically.</p></div>
          <div class="bank-total"><b>${total}</b><span>units</span></div></div>
        ${Views.tubes(data.stock)}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>Correct stock</h2><p>Use this after a stock count, expiry or transfer. Enter the number of units on the shelf now.</p></div></div>
        <div class="grid cols-4">${data.stock
          .map(
            (s) => `<form class="stat" data-group="${esc(s.blood_group)}" style="gap:8px">
            <div class="row between"><b style="font-size:1.3rem">${esc(s.blood_group)}</b>${s.low ? '<span class="badge red">Low</span>' : ''}</div>
            <div class="row" style="flex-wrap:nowrap"><input class="input" type="number" min="0" value="${s.units}" aria-label="${esc(s.blood_group)} units" style="min-height:38px">
            <button class="btn sm" type="submit">Save</button></div>
            <span class="small">Updated ${esc(UI.ago(s.updated_at))}</span></form>`
          )
          .join('')}</div>
      </section>`;
    Views.fillTubes(view);
    view.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target.closest('[data-group]');
      act(() => UI.busy(f.querySelector('button'), () => API.patch('/blood/stock', { blood_group: f.dataset.group, units: f.querySelector('input').value })), `${f.dataset.group} stock updated.`);
    });
  }

  // =====================================================================
  // Blood requests
  // =====================================================================
  async function requests(view, { query }) {
    Shell.title('Blood requests');
    const [rows, stock] = await Promise.all([API.get('/blood/requests'), API.get('/blood/stock')]);
    const units = Object.fromEntries(stock.stock.map((s) => [s.blood_group, s.units]));
    let tab = query.tab === 'closed' ? 'closed' : 'open';
    const open = rows.filter((r) => ['pending', 'approved'].includes(r.status));
    const closed = rows.filter((r) => !['pending', 'approved'].includes(r.status));
    view.innerHTML = `
      ${intro('Blood requests', 'Approve to confirm you are arranging blood. Fulfil when units are issued; stock goes down automatically.')}
      <section class="panel flush">
        <div class="tabs" role="tablist" style="padding:0 16px">
          <button role="tab" data-tab="open" aria-selected="${tab === 'open'}">Open<span class="n">${open.length}</span></button>
          <button role="tab" data-tab="closed" aria-selected="${tab === 'closed'}">Closed<span class="n">${closed.length}</span></button>
        </div><div id="rows"></div>
      </section>`;
    const draw = () => {
      const list = tab === 'open' ? open : closed;
      view.querySelector('#rows').innerHTML = list.length
        ? list
            .map((r) => {
              const enough = units[r.blood_group] >= r.units;
              return `<div class="item"><span class="bg-pill">${esc(r.blood_group)}</span>
              <div class="grow"><div class="row"><b>${r.units} unit${r.units > 1 ? 's' : ''} for ${esc(r.patient_name)}</b>${UI.badge('urgency', r.urgency)}${UI.badge('request', r.status)}</div>
                <div class="sub">${esc(r.hospital)}, ${esc(r.city)}. Contact <a href="tel:${esc(r.contact_phone)}">${esc(r.contact_phone)}</a> (requested by ${esc(r.requested_by_name)}, ${esc(UI.ago(r.created_at))})</div>
                ${r.notes ? `<div class="sub">Note: ${esc(r.notes)}</div>` : ''}${r.admin_note ? `<div class="sub">Your note: ${esc(r.admin_note)}</div>` : ''}
                ${tab === 'open' ? `<div class="sub" style="color:${enough ? 'var(--u-self)' : 'var(--danger)'}">${units[r.blood_group]} unit${units[r.blood_group] === 1 ? '' : 's'} of ${esc(r.blood_group)} in stock${enough ? '' : '. Not enough to fulfil; search donors.'}</div>` : ''}</div>
              <div class="acts">${
                tab === 'open'
                  ? `${r.status === 'pending' ? `<button class="btn ghost sm" data-act="approve" data-id="${r.id}">Approve</button>` : ''}
                     <button class="btn sm" data-act="fulfil" data-id="${r.id}" ${enough ? '' : 'disabled title="Not enough stock"'}>Fulfil</button>
                     <button class="btn danger sm" data-act="reject" data-id="${r.id}">Reject</button>`
                  : ''
              }</div></div>`;
            })
            .join('')
        : UI.empty(tab === 'open' ? 'No open requests' : 'No closed requests yet', '', '', 'drop');
    };
    draw();
    UI.bindTabs(view.querySelector('.tabs'), (k) => {
      tab = k;
      draw();
    });
    onClick(view, '[data-act]', async (b) => {
      const r = rows.find((x) => String(x.id) === b.dataset.id);
      const action = b.dataset.act;
      if (action === 'fulfil') {
        if (await UI.confirm({ title: `Issue ${r.units} unit${r.units > 1 ? 's' : ''} of ${r.blood_group}?`, message: `Stock goes from ${units[r.blood_group]} to ${units[r.blood_group] - r.units} units and ${r.requested_by_name} is notified.`, confirmLabel: 'Fulfil request' }))
          act(() => API.patch(`/blood/requests/${r.id}`, { action }), 'Request fulfilled and stock updated.');
        return;
      }
      UI.formModal({
        title: action === 'approve' ? 'Approve request' : 'Reject request',
        subtitle: `${r.units} unit(s) of ${r.blood_group} for ${r.patient_name}`,
        submitLabel: action === 'approve' ? 'Approve' : 'Reject request',
        fields: [{ name: 'admin_note', label: 'Message to the requester', type: 'textarea', span: 2, optional: action === 'approve', required: action === 'reject', placeholder: action === 'approve' ? 'e.g. Collect from blood bank counter 2' : 'e.g. No B- units; try the donors listed in the app' }],
        onSubmit: async (v) => {
          if (action === 'reject' && !v.admin_note) throw new Error('Tell the requester why, so they can look elsewhere.');
          await API.patch(`/blood/requests/${r.id}`, { action, admin_note: v.admin_note });
          UI.toast(action === 'approve' ? 'Request approved.' : 'Request rejected.');
          Shell.refreshCounts();
          reload();
        },
      });
    });
  }

  // =====================================================================
  // Donors
  // =====================================================================
  async function donors(view, { query }) {
    Shell.title('Donors');
    const rows = await API.get('/blood/admin/donors');
    let tab = ['verify', 'verified'].includes(query.tab) ? query.tab : rows.some((d) => !d.verified) ? 'verify' : 'verified';
    view.innerHTML = `
      ${intro('Blood donors', 'Verify new donors so patients can find them, and record donations made at the blood bank.')}
      <section class="panel flush">
        <div class="tabs" role="tablist" style="padding:0 16px">
          <button role="tab" data-tab="verify" aria-selected="${tab === 'verify'}">To verify<span class="n">${rows.filter((d) => !d.verified).length}</span></button>
          <button role="tab" data-tab="verified" aria-selected="${tab === 'verified'}">Verified<span class="n">${rows.filter((d) => d.verified).length}</span></button>
        </div><div id="rows"></div>
      </section>`;
    const draw = () => {
      const list = rows.filter((d) => (tab === 'verify' ? !d.verified : d.verified));
      view.querySelector('#rows').innerHTML = table(
        ['Donor', 'Details', 'Last donation', 'Eligibility', ''],
        list.map(
          (d) => `<tr><td><div class="row" style="flex-wrap:nowrap"><span class="bg-pill" style="width:38px;height:38px;font-size:.85rem">${esc(d.blood_group)}</span>
            <div><b style="font-weight:500">${esc(d.name)}</b><br><span class="muted small">${esc(d.city)}, ${esc(d.phone)}</span></div></div></td>
          <td class="small">${esc(UI.genderAge(d.gender, d.dob))}, ${d.weight_kg} kg${d.available ? '' : '<br><span class="badge grey">Not available</span>'}</td>
          <td class="small">${d.last_donation_date ? esc(UI.fmtDate(d.last_donation_date, { year: true })) : 'Never'}<br><span class="muted">${d.donation_count} recorded here</span></td>
          <td>${d.eligibility.eligible ? '<span class="badge green">Can donate</span>' : `<span class="badge grey" title="${esc(d.eligibility.reasons.join('; '))}">${esc(d.eligibility.reasons[0])}</span>`}</td>
          <td class="actions">${d.verified ? `<button class="btn ghost sm" data-unverify="${d.id}">Unverify</button>` : `<button class="btn sm" data-verify="${d.id}">${icon('check', 'sm')} Verify</button>`}
            <button class="btn ghost sm" data-donation="${d.id}">Record donation</button></td></tr>`
        ),
        UI.empty(tab === 'verify' ? 'Everyone is verified' : 'No verified donors yet', '', '', 'drop')
      );
    };
    draw();
    UI.bindTabs(view.querySelector('.tabs'), (k) => {
      tab = k;
      draw();
    });
    onClick(view, '[data-verify]', (b) => act(() => API.patch(`/blood/admin/donors/${b.dataset.verify}/verify`, { verified: true }), 'Donor verified. They now appear in donor search.'));
    onClick(view, '[data-unverify]', (b) => act(() => API.patch(`/blood/admin/donors/${b.dataset.unverify}/verify`, { verified: false }), 'Donor hidden from search.'));
    onClick(view, '[data-donation]', (b) => {
      const d = rows.find((x) => String(x.id) === b.dataset.donation);
      UI.formModal({
        title: `Record donation: ${d.name}`,
        subtitle: `${d.blood_group}. Stock goes up by the units you enter.`,
        submitLabel: 'Record donation',
        intro: d.eligibility.eligible ? '' : `<div class="notice warn" style="margin-bottom:14px">${icon('alert')}<div>${esc(d.eligibility.reasons.join('. '))}.</div></div>`,
        fields: [
          { name: 'donation_date', label: 'Date', type: 'date', value: UI.today(), max: UI.today() },
          { name: 'units', label: 'Units', type: 'select', value: 1, options: [1, 2] },
          ...(d.eligibility.eligible ? [] : [{ name: 'override', label: 'Doctor has cleared this donation', type: 'checkbox', span: 2 }]),
        ],
        onSubmit: async (v) => {
          await API.post('/blood/admin/donations', { donor_id: d.id, ...v });
          UI.toast(`Donation recorded. ${d.blood_group} stock increased.`);
          Shell.refreshCounts();
          reload();
        },
      });
    });
  }

  // =====================================================================
  // Users & staff
  // =====================================================================
  async function users(view, { query }) {
    Shell.title('Users & staff');
    const role = ['patient', 'doctor', 'lab', 'admin'].includes(query.role) ? query.role : 'patient';
    const rows = await API.get('/admin/users', { role });
    view.innerHTML = `
      ${intro('Users & staff', 'Patients sign up themselves. Add lab technicians and admins here; add doctors on the Doctors page.', `<button class="btn" id="add">${icon('plus', 'sm')} Add staff</button>`)}
      <div class="seg" id="role">${[['patient', 'Patients'], ['doctor', 'Doctors'], ['lab', 'Lab staff'], ['admin', 'Admins']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === role}">${l}</button>`).join('')}</div>
      <section class="panel flush">${table(
        ['Name', 'Contact', ...(role === 'patient' ? ['City', 'Blood group'] : []), 'Joined', 'Status', ''],
        rows.map(
          (u) => `<tr class="${u.active ? '' : 'off'}"><td><b style="font-weight:500">${esc(u.name)}</b></td><td class="small">${esc(u.email)}<br><span class="muted">${esc(u.phone || '')}</span></td>
          ${role === 'patient' ? `<td>${esc(u.city || '–')}</td><td>${esc(u.blood_group || '–')}</td>` : ''}
          <td class="small">${esc(UI.fmtDate(u.created_at.slice(0, 10), { weekday: false }))}</td>
          <td>${u.active ? '<span class="badge green">Active</span>' : '<span class="badge grey">Deactivated</span>'}</td>
          <td class="actions">${u.id === Shell.user.id ? '<span class="muted small">You</span>' : `<button class="btn ${u.active ? 'danger' : 'ghost'} sm" data-toggle="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button>`}</td></tr>`
        ),
        UI.empty('No accounts', '', '', 'users')
      )}</section>`;
    UI.bindPressed(view.querySelector('#role'), (v) => Shell.go(`#/users?role=${v}`));
    onClick(view, '[data-toggle]', async (b) => {
      const u = rows.find((x) => String(x.id) === b.dataset.toggle);
      if (u.active && !(await UI.confirm({ title: `Deactivate ${u.name}?`, message: 'They will be logged out and cannot log in until you activate the account again.', confirmLabel: 'Deactivate', danger: true }))) return;
      act(() => API.patch(`/admin/users/${u.id}/active`, { active: !u.active }), u.active ? 'Account deactivated.' : 'Account activated.');
    });
    view.querySelector('#add').addEventListener('click', () =>
      UI.formModal({
        title: 'Add a staff account',
        subtitle: 'Share the temporary password with them; they can change it from their profile.',
        submitLabel: 'Add account',
        fields: [
          { name: 'role', label: 'Role', type: 'select', value: role === 'admin' ? 'admin' : 'lab', options: [['lab', 'Lab technician'], ['admin', 'Admin']] },
          { name: 'name', label: 'Full name', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', optional: true },
          { name: 'password', label: 'Temporary password', required: true, value: 'welcome123', span: 2 },
        ],
        onSubmit: async (v) => {
          await API.post('/admin/staff', v);
          UI.toast(`${v.name} can now log in.`);
          Shell.go(`#/users?role=${v.role}`);
        },
      })
    );
  }

  // =====================================================================
  // Feedback
  // =====================================================================
  async function feedback(view) {
    Shell.title('Feedback');
    const rows = await API.get('/admin/feedback');
    const avg = rows.length ? (rows.reduce((n, r) => n + r.rating, 0) / rows.length).toFixed(1) : null;
    view.innerHTML = `
      ${intro('Patient feedback', avg ? `${rows.length} ratings, ${avg} out of 5 on average.` : 'Patients rate visits after the doctor completes them.')}
      <section class="panel flush">${table(
        ['Visit', 'Patient', 'Doctor', 'Rating', 'Comments'],
        rows.map(
          (f) => `<tr><td class="nowrap small">${esc(UI.fmtDate(f.appt_date, { weekday: false }))}</td><td>${esc(f.patient_name)}</td><td>${esc(f.doctor_name)}</td>
          <td><span class="stars">${icon('star', 'sm')} ${f.rating}</span></td><td class="small">${esc(f.comments || '')}</td></tr>`
        ),
        UI.empty('No feedback yet', '', '', 'star')
      )}</section>`;
  }

  // =====================================================================
  // AI consult logs & knowledge base
  // =====================================================================
  async function aiLogs(view) {
    Shell.title('AI consult logs');
    const [rows, kb] = await Promise.all([API.get('/admin/ai-logs'), API.get('/admin/knowledge')]);
    view.innerHTML = `
      ${intro('AI consult logs', 'Every symptom check the assistant has done, with what it understood and where it sent the patient. Use this to review and improve the rules.')}
      <section class="panel flush">${table(
        ['When', 'Patient', 'What they typed', 'Understood as', 'Top match', 'Urgency', 'Sent to'],
        rows.map(
          (l) => `<tr><td class="nowrap small">${esc(UI.ago(l.created_at))}</td><td>${esc(l.patient_name)}${l.age !== null ? `<br><span class="muted small">${l.age} yrs</span>` : ''}</td>
          <td class="small">${esc(l.symptoms_text || '(picked from list)')}</td><td class="small">${esc(l.matched.join(', '))}</td>
          <td class="small">${l.conditions[0] ? `${esc(l.conditions[0].name)} <span class="muted">${l.conditions[0].match}%</span>` : '<span class="muted">No clear match</span>'}</td>
          <td>${UI.badge('triage', l.urgency)}</td><td class="small">${esc(l.department || '–')}</td></tr>`
        ),
        UI.empty('No consultations yet', '', '', 'ai')
      )}</section>
      <section class="panel">
        <div class="panel-head"><div><h2>Knowledge base</h2><p>${kb.symptoms.length} symptoms (with English and Hinglish words) and ${kb.medicines.length} medicine categories. Edit them in server/ai/knowledge.js.</p></div></div>
        ${table(
          ['Medicine category', 'Examples', 'Caution'],
          kb.medicines.map((m) => `<tr><td><b style="font-weight:500">${esc(m.category)}</b>${m.otc ? '' : '<br><span class="badge amber plain">Doctor only</span>'}</td><td class="small">${esc(m.examples || '–')}</td><td class="small muted">${esc(m.caution)}</td></tr>`),
          ''
        )}
      </section>`;
  }

  Shell.start({
    role: 'admin',
    portal: 'Admin',
    defaultRoute: 'overview',
    nav: [
      { route: 'overview', label: 'Overview', icon: 'chart' },
      { group: 'Hospital' },
      { route: 'appointments', label: 'Appointments', icon: 'calendar' },
      { route: 'doctors', label: 'Doctors', icon: 'doctor' },
      { route: 'departments', label: 'Departments', icon: 'building' },
      { route: 'tests', label: 'Lab tests', icon: 'flask' },
      { route: 'lab-bookings', label: 'Lab bookings', icon: 'clipboard' },
      { group: 'Blood bank' },
      { route: 'blood', label: 'Blood stock', icon: 'drop' },
      { route: 'requests', label: 'Requests', icon: 'alert' },
      { route: 'donors', label: 'Donors', icon: 'heart' },
      { group: 'People & insights' },
      { route: 'users', label: 'Users & staff', icon: 'users' },
      { route: 'feedback', label: 'Feedback', icon: 'star' },
      { route: 'ai', label: 'AI consult logs', icon: 'ai' },
    ],
    routes: { overview, appointments, doctors, departments, tests, 'lab-bookings': labBookings, blood, requests, donors, users, feedback, ai: aiLogs },
    counts: async () => {
      const s = await API.get('/admin/stats');
      return { requests: s.requests_pending, donors: s.donors_unverified };
    },
  });
})();
