// View components shared by more than one role.
(function () {
  const { esc, icon } = UI;

  // "1,2,3,4,5,6" → "Mon–Sat"
  function workDays(csv) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const on = new Set(String(csv || '').split(',').filter(Boolean).map(Number));
    const days = order.filter((d) => on.has(d));
    if (days.length === 7) return 'Every day';
    if (!days.length) return 'No working days';
    const idx = days.map((d) => order.indexOf(d));
    const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
    if (consecutive && days.length > 2) return `${UI.DAY_NAMES[days[0]]}–${UI.DAY_NAMES[days[days.length - 1]]}`;
    return days.map((d) => UI.DAY_NAMES[d]).join(', ');
  }
  const hours = (s, e) => `${UI.time12(s)} – ${UI.time12(e)}`;
  const worksOn = (doctor, dateStr) => String(doctor.work_days).split(',').includes(String(new Date(dateStr + 'T00:00:00').getDay()));

  // ---------- Date strip + slot grid ----------
  function slotPicker(el, doctor, { exclude = 0, initialDate = null, onChange = () => {} } = {}) {
    const state = { date: null, time: null };
    const t = UI.today();
    const dates = Array.from({ length: 21 }, (_, i) => UI.addDays(t, i));
    el.innerHTML = `
      <div class="date-strip" role="group" aria-label="Choose a date">
        ${dates
          .map((d) => {
            const p = UI.dayParts(d);
            const works = worksOn(doctor, d);
            return `<button type="button" data-date="${d}" aria-pressed="false" ${works ? '' : 'disabled title="Doctor not available"'}>
              <small>${d === t ? 'Today' : p.dow}</small><b>${p.day}</b><small>${p.mon}</small></button>`;
          })
          .join('')}
      </div>
      <div class="slots" aria-live="polite"></div>`;
    const strip = el.querySelector('.date-strip');
    const slotsEl = el.querySelector('.slots');

    async function pick(dateStr, { auto = false, tries = 0 } = {}) {
      state.date = dateStr;
      state.time = null;
      onChange({ ...state });
      for (const b of strip.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.date === dateStr));
      const btn = strip.querySelector(`[data-date="${dateStr}"]`);
      if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      slotsEl.innerHTML = UI.loading();
      const { slots } = await API.get(`/doctors/${doctor.id}/slots`, { date: dateStr, exclude });
      if (state.date !== dateStr) return;
      const free = slots.filter((s) => s.available);
      if (!free.length && auto && tries < 10) {
        const next = dates.find((d) => d > dateStr && worksOn(doctor, d));
        if (next) return pick(next, { auto: true, tries: tries + 1 });
      }
      if (!slots.length) {
        slotsEl.innerHTML = UI.empty('No slots on this day', 'Pick another date.', '', 'calendar');
        return;
      }
      const groups = [
        ['Morning', slots.filter((s) => s.time < '12:00')],
        ['Afternoon', slots.filter((s) => s.time >= '12:00' && s.time < '17:00')],
        ['Evening', slots.filter((s) => s.time >= '17:00')],
      ].filter(([, list]) => list.length);
      slotsEl.innerHTML =
        (free.length ? '' : `<div class="notice warn" style="margin-top:14px">${icon('info')}<div>This day is fully booked. Try another date.</div></div>`) +
        groups
          .map(
            ([name, list]) => `<div class="slot-group">${name}</div><div class="slot-grid">
              ${list.map((s) => `<button type="button" data-time="${s.time}" aria-pressed="false" ${s.available ? '' : 'disabled aria-label="' + UI.time12(s.time) + ' taken"'}>${UI.time12(s.time)}</button>`).join('')}
            </div>`
          )
          .join('');
    }

    strip.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-date]');
      if (b && !b.disabled) pick(b.dataset.date).catch((err) => (slotsEl.innerHTML = UI.errorBox(err)));
    });
    slotsEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-time]');
      if (!b || b.disabled) return;
      for (const x of slotsEl.querySelectorAll('button[data-time]')) x.setAttribute('aria-pressed', String(x === b));
      state.time = b.dataset.time;
      onChange({ ...state });
    });

    const first = initialDate && worksOn(doctor, initialDate) && initialDate >= t ? initialDate : dates.find((d) => worksOn(doctor, d));
    if (first) pick(first, { auto: !initialDate }).catch((err) => (slotsEl.innerHTML = UI.errorBox(err)));
    else slotsEl.innerHTML = UI.empty('No working days set', 'This doctor has no available days right now.', '', 'calendar');
    return { get: () => ({ ...state }) };
  }

  // ---------- Prescription ----------
  function prescriptionHtml(a) {
    const p = a.prescription;
    return `
      <div class="summary-box"><dl>
        <dt>Patient</dt><dd>${esc(a.patient_name)}${a.patient_dob || a.patient_gender ? ` <span class="muted">(${esc(UI.genderAge(a.patient_gender, a.patient_dob))})</span>` : ''}</dd>
        <dt>Doctor</dt><dd>${esc(a.doctor_name)}, ${esc(a.specialization)}</dd>
        <dt>Visit</dt><dd>${esc(UI.fmtDate(a.appt_date, { year: true }))}, ${esc(UI.time12(a.slot_time))}</dd>
      </dl></div>
      <h3 style="margin:18px 0 6px">Diagnosis</h3><p>${esc(p.diagnosis)}</p>
      <h3 style="margin:18px 0 8px">Medicines</h3>
      ${
        p.medicines.length
          ? `<div class="table-wrap"><table class="table"><thead><tr><th>Medicine</th><th>Dosage</th><th>How often</th><th>For</th></tr></thead><tbody>
            ${p.medicines.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.dosage || '–')}</td><td>${esc(m.frequency || '–')}</td><td>${esc(m.duration || '–')}</td></tr>`).join('')}
            </tbody></table></div>`
          : '<p class="muted">No medicines prescribed.</p>'
      }
      ${p.advice ? `<h3 style="margin:18px 0 6px">Advice</h3><p>${esc(p.advice)}</p>` : ''}
      ${p.follow_up_date ? `<div class="notice" style="margin-top:16px">${icon('calendar')}<div>Follow-up on <b>${esc(UI.fmtDate(p.follow_up_date, { year: true }))}</b></div></div>` : ''}`;
  }

  async function prescriptionModal(appointmentId) {
    const m = UI.modal({ title: 'Prescription', wide: true, body: UI.loading() });
    try {
      const a = await API.get(`/appointments/${appointmentId}`);
      if (!a.prescription) throw new Error('No prescription has been written for this visit yet.');
      m.body.innerHTML = `${prescriptionHtml(a)}
        <div class="form-actions"><button class="btn ghost" data-close>Close</button><button class="btn" data-pdf>${icon('download')} Download PDF</button></div>`;
      m.body.querySelector('[data-pdf]').addEventListener('click', () => PDF.prescription({ ...a, ...a.prescription, appointment_id: a.id }));
    } catch (err) {
      m.body.innerHTML = UI.errorBox(err);
    }
  }

  // ---------- Lab report ----------
  function resultsTable(results) {
    return `<div class="table-wrap"><table class="table results"><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Flag</th></tr></thead><tbody>
      ${results
        .map(
          (r) => `<tr class="${esc(r.flag)}"><td>${esc(r.name)}</td><td class="val">${esc(r.value)}</td><td class="muted">${esc(r.unit || '')}</td>
          <td class="muted">${esc(PDF.rangeText(r).replace(' - ', '–'))}</td><td><span class="flag ${esc(r.flag)}">${esc(UI.cap(r.flag))}</span></td></tr>`
        )
        .join('')}
      </tbody></table></div>`;
  }

  async function reportModal(bookingId) {
    const m = UI.modal({ title: 'Lab report', wide: true, body: UI.loading() });
    try {
      const b = await API.get(`/lab/bookings/${bookingId}`);
      if (!b.report) throw new Error('The report is not ready yet.');
      const abnormal = b.report.results.filter((r) => r.flag !== 'normal').length;
      m.el.querySelector('h2').textContent = b.test_name;
      m.body.innerHTML = `
        <div class="summary-box"><dl>
          <dt>Patient</dt><dd>${esc(b.patient_name)}${b.patient_dob || b.patient_gender ? ` <span class="muted">(${esc(UI.genderAge(b.patient_gender, b.patient_dob))})</span>` : ''}</dd>
          <dt>Sample</dt><dd>${esc(UI.fmtDate(b.booking_date, { year: true }))}, ${b.collection_type === 'home' ? 'home collection' : 'lab visit'}</dd>
          <dt>Reported</dt><dd>${esc(UI.fmtDate(b.report.created_at.slice(0, 10), { year: true }))}${b.report.technician_name ? ` by ${esc(b.report.technician_name)}` : ''}</dd>
        </dl></div>
        <div class="notice ${abnormal ? 'warn' : ''}" style="margin:16px 0">${icon(abnormal ? 'alert' : 'check')}<div>${esc(b.report.summary)}</div></div>
        ${resultsTable(b.report.results)}
        <p class="small muted" style="margin-top:12px">Reference ranges are for adults. Discuss your results with a doctor.</p>
        <div class="form-actions"><button class="btn ghost" data-close>Close</button><button class="btn" data-pdf>${icon('download')} Download PDF</button></div>`;
      m.body.querySelector('[data-pdf]').addEventListener('click', () => PDF.report({ ...b, ...b.report, booking_id: b.id }));
    } catch (err) {
      m.body.innerHTML = UI.errorBox(err);
    }
  }

  // ---------- Lab status stepper ----------
  const LAB_STEPS = [
    ['booked', 'Booked'],
    ['sample_collected', 'Collected'],
    ['processing', 'Processing'],
    ['report_ready', 'Report ready'],
  ];
  function stepper(status) {
    if (status === 'cancelled') return '';
    const at = LAB_STEPS.findIndex(([s]) => s === status);
    return `<div class="stepper" aria-label="Progress: ${esc(UI.cap(status))}">${LAB_STEPS.map(
      ([, label], i) => `<div class="${i < at || (i === at && at === 3) ? 'done' : i === at ? 'now' : ''}">${label}</div>`
    ).join('')}</div>`;
  }

  // ---------- Blood stock tubes ----------
  // A tube holds 30 units when full; the level is capped so small stocks stay visible.
  function tubes(stock, { mine = null, compatible = null, clickable = false } = {}) {
    const FULL = 30;
    return `<div class="tubes">${stock
      .map((s) => {
        const level = Math.max(4, Math.min(100, Math.round((s.units / FULL) * 100)));
        const cls = ['tube', s.low ? 'low' : '', mine === s.blood_group ? 'mine' : '', compatible && !compatible.includes(s.blood_group) ? 'dim' : ''].join(' ');
        const label = `${s.blood_group}: ${s.units} unit${s.units === 1 ? '' : 's'}${s.low ? ', low stock' : ''}`;
        const tag = clickable ? 'button' : 'div';
        return `<${tag} class="${cls}" ${clickable ? `type="button" data-group="${esc(s.blood_group)}"` : ''} aria-label="${esc(label)}" title="${esc(label)}">
          <div class="glass"><div class="fill" data-level="${s.units ? level : 0}%" style="--level:0%"></div></div>
          <span class="grp">${esc(s.blood_group)}</span><span class="units">${s.units} unit${s.units === 1 ? '' : 's'}</span>
        </${tag}>`;
      })
      .join('')}</div>`;
  }

  // ---------- Change password (every role) ----------
  function passwordPanel() {
    return `<section class="panel"><div class="panel-head"><h2>Change password</h2></div>
      <form id="pw" class="stack" novalidate>
        ${UI.fieldHtml({ name: 'current_password', label: 'Current password', type: 'password', required: true, autocomplete: 'current-password' })}
        ${UI.fieldHtml({ name: 'new_password', label: 'New password', type: 'password', required: true, hint: 'At least 6 characters', autocomplete: 'new-password' })}
        <div class="form-error" hidden role="alert"></div>
        <button class="btn ghost" type="submit">${icon('lock', 'sm')} Change password</button>
      </form></section>`;
  }
  function bindPassword(view) {
    const form = view.querySelector('#pw');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      try {
        await UI.busy(form.querySelector('[type=submit]'), () => API.post('/auth/change-password', UI.readForm(form)));
        form.reset();
        UI.toast('Password changed.');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // Fill the tubes after they are on screen so the liquid rises once, on page load.
  function fillTubes(root) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const f of root.querySelectorAll('.fill[data-level]')) f.style.setProperty('--level', f.dataset.level);
      })
    );
  }

  window.Views = { fillTubes, passwordPanel, bindPassword, workDays, hours, worksOn, slotPicker, prescriptionHtml, prescriptionModal, resultsTable, reportModal, stepper, tubes };
})();
