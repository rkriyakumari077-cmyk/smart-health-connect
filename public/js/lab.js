// Lab technician portal.
(function () {
  const { esc, icon } = UI;
  const TABS = [
    ['booked', 'To collect'],
    ['sample_collected', 'Collected'],
    ['processing', 'Processing'],
    ['report_ready', 'Reports sent'],
    ['cancelled', 'Cancelled'],
  ];

  // =====================================================================
  // Sample queue
  // =====================================================================
  async function queue(view, { query }) {
    Shell.title('Sample queue');
    const all = await API.get('/lab/bookings');
    const t = UI.today();
    let tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'booked';
    let when = query.when || 'all';
    const byStatus = (k) => all.filter((b) => b.status === k);
    const todayCount = all.filter((b) => b.booking_date === t && b.status === 'booked').length;
    const overdue = all.filter((b) => b.booking_date < t && b.status === 'booked').length;

    view.innerHTML = `
      <div class="page-intro"><div><h1>Sample queue</h1><p>Collect samples, move them through processing and enter results. Patients get a notification at each step.</p></div></div>
      <div class="grid cols-4">
        <div class="stat"><b>${todayCount}</b><span>To collect today</span></div>
        <div class="stat ${overdue ? 'alert' : ''}"><b>${overdue}</b><span>Missed collections</span></div>
        <div class="stat"><b>${byStatus('sample_collected').length + byStatus('processing').length}</b><span>Waiting for results</span></div>
        <div class="stat"><b>${all.filter((b) => b.status === 'report_ready' && b.updated_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}</b><span>Reports sent today</span></div>
      </div>
      <section class="panel flush">
        <div class="row between" style="padding:0 16px;border-bottom:1px solid var(--line)">
          <div class="tabs" role="tablist" style="border:0">
            ${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}<span class="n">${byStatus(k).length}</span></button>`).join('')}
          </div>
          <div class="seg" id="when" style="margin:8px 0">${[['today', 'Today'], ['upcoming', 'Upcoming'], ['all', 'All dates']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === when}">${l}</button>`).join('')}</div>
        </div>
        <div id="rows"></div>
      </section>`;

    const rows = view.querySelector('#rows');
    const draw = () => {
      const list = byStatus(tab)
        .filter((b) => (when === 'today' ? b.booking_date === t : when === 'upcoming' ? b.booking_date >= t : true))
        .sort((a, b) => (tab === 'booked' || tab === 'cancelled' ? (a.booking_date + a.time_slot).localeCompare(b.booking_date + b.time_slot) : b.updated_at.localeCompare(a.updated_at)));
      rows.innerHTML = list.length
        ? list
            .map((b) => {
              const late = b.status === 'booked' && b.booking_date < t;
              return `<div class="item">
                <div class="datebox"><b>${UI.dayParts(b.booking_date).day}</b><span>${b.booking_date === t ? 'Today' : UI.dayParts(b.booking_date).mon}</span></div>
                <div class="grow">
                  <div class="row"><b>${esc(b.test_name)}</b>${late ? '<span class="badge red">Missed</span>' : UI.badge('lab', b.status)}</div>
                  <div class="sub">${esc(b.patient_name)}${b.patient_gender || b.patient_dob ? ` (${esc(UI.genderAge(b.patient_gender, b.patient_dob))})` : ''}${b.patient_phone ? `, <a href="tel:${esc(b.patient_phone)}">${esc(b.patient_phone)}</a>` : ''}</div>
                  <div class="sub">${icon(b.collection_type === 'home' ? 'home' : 'building', 'sm').replace('class="icon sm"', 'class="icon sm" style="display:inline;vertical-align:-3px"')}
                    ${b.collection_type === 'home' ? `Home collection: ${esc(b.address || 'address not given')}` : 'Lab visit'}, ${esc(UI.time12(b.time_slot))}, ${esc(b.sample_type)} sample</div>
                </div>
                <div class="acts">${actions(b)}</div></div>`;
            })
            .join('')
        : UI.empty(
            { booked: 'No samples to collect', sample_collected: 'Nothing collected and waiting', processing: 'Nothing in processing', report_ready: 'No reports sent yet', cancelled: 'No cancelled bookings' }[tab],
            when !== 'all' ? 'Try "All dates".' : '',
            '',
            'flask'
          );
    };
    const actions = (b) =>
      ({
        booked: `<button class="btn sm" data-status="sample_collected" data-id="${b.id}">${icon('check', 'sm')} Sample collected</button>`,
        sample_collected: `<button class="btn ghost sm" data-status="processing" data-id="${b.id}">Start processing</button><a class="btn sm" href="#/report/${b.id}">Enter results</a>`,
        processing: `<a class="btn sm" href="#/report/${b.id}">Enter results</a>`,
        report_ready: `<button class="btn ghost sm" data-view="${b.id}">${icon('file', 'sm')} View report</button>`,
      })[b.status] || '';

    draw();
    UI.bindTabs(view.querySelector('.tabs'), (k) => {
      tab = k;
      draw();
    });
    UI.bindPressed(view.querySelector('#when'), (v) => {
      when = v;
      draw();
    });
    rows.addEventListener('click', async (e) => {
      const v = e.target.closest('[data-view]');
      if (v) Views.reportModal(v.dataset.view);
      const s = e.target.closest('[data-status]');
      if (!s) return;
      try {
        const b = await UI.busy(s, () => API.patch(`/lab/bookings/${s.dataset.id}/status`, { status: s.dataset.status }));
        UI.toast(`${b.test_name} for ${b.patient_name}: ${s.dataset.status === 'sample_collected' ? 'sample collected' : 'processing started'}.`);
        Shell.go(`#/queue?tab=${b.status}&when=${when}`);
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }

  // =====================================================================
  // Result entry
  // =====================================================================
  function flagFor(p, raw) {
    const v = String(raw ?? '').trim();
    if (!v) return 'pending';
    if (p.ref_text) return v.toLowerCase() === p.ref_text.toLowerCase() ? 'normal' : 'abnormal';
    const n = Number(v);
    if (Number.isNaN(n)) return 'invalid';
    if (p.low !== null && p.low !== undefined && n < p.low) return 'low';
    if (p.high !== null && p.high !== undefined && n > p.high) return 'high';
    return 'normal';
  }

  async function report(view, { params }) {
    const b = await API.get(`/lab/bookings/${params[0]}`);
    Shell.title('Enter results');
    if (b.report) return Shell.go(`#/queue?tab=report_ready`);
    const ready = ['sample_collected', 'processing'].includes(b.status);
    view.innerHTML = `
      <a class="small" href="#/queue?tab=${b.status}">← Back to queue</a>
      <section class="panel">
        <div class="patient-strip">
          <span class="avatar lg">${icon('flask', 'lg')}</span>
          <div style="flex:1;min-width:200px"><div class="row"><h2>${esc(b.test_name)}</h2>${UI.badge('lab', b.status)}</div>
            <div class="muted small">${esc(b.category)}, ${esc(b.sample_type)} sample</div></div>
          <div class="kv">
            <div><span>Patient</span>${esc(b.patient_name)}</div>
            <div><span>Gender / age</span>${esc(UI.genderAge(b.patient_gender, b.patient_dob) || '–')}</div>
            <div><span>Sample date</span>${esc(UI.fmtDate(b.booking_date))}</div>
          </div>
        </div>
      </section>
      ${ready ? '' : `<div class="notice warn">${icon('info')}<div>Mark the sample as collected before entering results.</div></div>`}
      <section class="panel">
        <div class="panel-head"><div><h2>Results</h2><p>Flags update as you type, using the reference range for each parameter.</p></div></div>
        <form id="res" novalidate>
          <fieldset ${ready ? '' : 'disabled'} style="border:0;padding:0;margin:0">
          <div class="table-wrap"><table class="table results">
            <thead><tr><th>Parameter</th><th style="width:170px">Result</th><th>Unit</th><th>Reference range</th><th>Flag</th></tr></thead>
            <tbody>${b.parameters
              .map(
                (p, i) => `<tr data-i="${i}"><td><label for="p${i}">${esc(p.name)}</label></td>
                <td><input class="input" id="p${i}" data-name="${esc(p.name)}" ${p.ref_text ? `list="ref${i}" placeholder="${esc(p.ref_text)}"` : 'inputmode="decimal" placeholder="Value"'} style="min-height:38px;padding:6px 10px">
                  ${p.ref_text ? `<datalist id="ref${i}"><option value="${esc(p.ref_text)}"></datalist>` : ''}</td>
                <td class="muted">${esc(p.unit || '')}</td><td class="muted">${esc(PDF.rangeText(p).replace(' - ', '–'))}</td>
                <td><span class="flag pending" data-flag>Waiting</span></td></tr>`
              )
              .join('')}</tbody>
          </table></div>
          <div class="field" style="margin-top:18px"><label for="summary">Summary for the patient <span class="muted">(optional)</span></label>
            <textarea id="summary" name="summary" maxlength="1000"></textarea>
            <span class="hint" id="auto-sum"></span></div>
          </fieldset>
          <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
          <div class="form-actions"><a class="btn ghost" href="#/queue">Cancel</a><button class="btn" type="submit" ${ready ? '' : 'disabled'}>${icon('send', 'sm')} Send report to patient</button></div>
        </form>
      </section>`;

    const form = view.querySelector('#res');
    const update = () => {
      const bad = [];
      for (const tr of form.querySelectorAll('tbody tr')) {
        const p = b.parameters[Number(tr.dataset.i)];
        const f = flagFor(p, tr.querySelector('input').value);
        const el = tr.querySelector('[data-flag]');
        el.className = `flag ${f === 'invalid' ? 'abnormal' : f}`;
        el.textContent = { pending: 'Waiting', invalid: 'Not a number' }[f] || UI.cap(f);
        tr.className = f;
        if (!['normal', 'pending'].includes(f)) bad.push(p.name);
      }
      form.querySelector('#auto-sum').textContent = `If left empty: "${
        bad.length ? `${bad.length} value(s) outside the reference range: ${bad.join(', ')}. Please discuss with your doctor.` : 'All values are within the reference range.'
      }"`;
    };
    form.addEventListener('input', update);
    update();
    const first = form.querySelector('tbody input');
    if (first && ready) first.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      const values = Object.fromEntries([...form.querySelectorAll('tbody input')].map((i) => [i.dataset.name, i.value.trim()]));
      const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
      if (missing.length) {
        err.textContent = `Enter a value for ${missing.join(', ')}.`;
        err.hidden = false;
        return;
      }
      try {
        await UI.busy(form.querySelector('[type=submit]'), () => API.post(`/lab/bookings/${b.id}/report`, { values, summary: form.querySelector('#summary').value }));
        UI.toast(`Report sent to ${b.patient_name}.`);
        Shell.go('#/queue?tab=report_ready');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // =====================================================================
  // Profile
  // =====================================================================
  async function profile(view) {
    Shell.title('Profile');
    const u = await API.get('/auth/me');
    view.innerHTML = `
      <div class="split">
        <section class="panel">
          <div class="panel-head"><h2>Your details</h2></div>
          <form id="me" novalidate><div class="form-grid">
            ${UI.fieldHtml({ name: 'name', label: 'Name', required: true, value: u.name })}
            ${UI.fieldHtml({ name: 'phone', label: 'Phone', type: 'tel', value: u.phone || '' })}
          </div>
          <p class="small muted" style="margin-top:10px">Email ${esc(u.email)}</p>
          <div class="form-error" hidden role="alert" style="margin-top:12px"></div>
          <div class="form-actions"><button class="btn" type="submit">Save changes</button></div></form>
        </section>
        ${Views.passwordPanel()}
      </div>`;
    const form = view.querySelector('#me');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      try {
        Shell.user = await UI.busy(form.querySelector('[type=submit]'), () => API.patch('/auth/me', UI.readForm(form)));
        UI.toast('Changes saved.');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
    Views.bindPassword(view);
  }

  Shell.start({
    role: 'lab',
    portal: 'Lab',
    defaultRoute: 'queue',
    nav: [
      { route: 'queue', label: 'Sample queue', icon: 'flask' },
      { route: 'profile', label: 'Profile', icon: 'user' },
    ],
    activeFor: (r) => (r === 'report' ? 'queue' : r),
    routes: { queue, report, profile },
    counts: async () => {
      const b = await API.get('/lab/bookings', { status: 'booked', date: UI.today() });
      return { queue: b.length };
    },
  });
})();
