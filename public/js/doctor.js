// Doctor portal.
(function () {
  const { esc, icon } = UI;
  const FREQUENCIES = ['Once a day', 'Twice a day', 'Three times a day', 'At bedtime', 'Before breakfast', 'When needed'];

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };
  const patientLine = (a) => [UI.genderAge(a.patient_gender, a.patient_dob), a.patient_blood_group].filter(Boolean).join(', ');

  // =====================================================================
  // Schedule
  // =====================================================================
  async function schedule(view, { query }) {
    Shell.title('My schedule');
    const t = UI.today();
    const day = query.date || t;
    const all = await API.get('/appointments');
    const open = all.filter((a) => a.status === 'booked' && a.appt_date < t);
    const list = all.filter((a) => a.appt_date === day).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    const active = list.filter((a) => a.status !== 'cancelled');
    const seen = list.filter((a) => a.status === 'completed').length;
    const waiting = list.filter((a) => a.status === 'booked').length;
    const week = Array.from({ length: 7 }, (_, i) => UI.addDays(t, i)).map((d) => ({
      d,
      n: all.filter((a) => a.appt_date === d && a.status === 'booked').length,
    }));

    view.innerHTML = `
      <div class="page-intro">
        <div><h1>${greeting()}, ${esc(Shell.user.name)}</h1><p>${esc(UI.fmtDate(t, { year: true }))}. Open a patient to see their details and write the prescription.</p></div>
        <div class="row">
          <a class="btn ghost sm" href="#/schedule?date=${UI.addDays(day, -1)}" aria-label="Previous day">${icon('back', 'sm')}</a>
          <b style="min-width:140px;text-align:center">${esc(UI.relDay(day))}</b>
          <a class="btn ghost sm" href="#/schedule?date=${UI.addDays(day, 1)}" aria-label="Next day">${icon('chevron', 'sm')}</a>
          ${day !== t ? `<a class="btn sm" href="#/schedule">Today</a>` : ''}
        </div>
      </div>
      <div class="grid cols-4">
        <div class="stat"><b>${active.length}</b><span>Patients ${day === t ? 'today' : 'this day'}</span></div>
        <div class="stat"><b>${seen}</b><span>Seen</span></div>
        <div class="stat"><b>${waiting}</b><span>Waiting</span></div>
        <div class="stat ${open.length ? 'alert' : ''}"><b>${open.length}</b><span>Earlier visits to close</span></div>
      </div>
      ${
        open.length
          ? `<div class="notice warn">${icon('alert')}<div><b style="font-weight:500">${open.length} earlier appointment${open.length > 1 ? 's are' : ' is'} still open.</b>
             Complete ${open.length > 1 ? 'them' : 'it'} with a prescription or mark as no-show:
             ${open.map((a) => `<a href="#/appt/${a.id}">${esc(a.patient_name)} (${esc(UI.fmtDate(a.appt_date, { weekday: false }))})</a>`).join(', ')}</div></div>`
          : ''
      }
      <div class="split">
        <section class="panel flush">
          <div class="panel-head"><h2>${esc(UI.relDay(day))}'s patients</h2></div>
          ${
            list.length
              ? list
                  .map(
                    (a) => `<a class="item" href="#/appt/${a.id}">
                    <span class="time-col">${esc(UI.time12(a.slot_time))}</span>
                    <div class="grow"><div class="row"><b>${esc(a.patient_name)}</b>${UI.badge('appt', a.status)}${a.consult_id ? `<span class="badge teal plain">${icon('ai', 'sm')} AI consult</span>` : ''}</div>
                      <div class="sub">${esc(patientLine(a))}${a.reason ? `, ${esc(a.reason)}` : ''}</div></div>
                    ${icon('chevron')}</a>`
                  )
                  .join('')
              : UI.empty('No appointments on this day', 'Patients who book with you will appear here.', '', 'calendar')
          }
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Next 7 days</h2><a class="small" href="#/availability">Edit availability</a></div>
          ${week
            .map(
              (w) => `<a class="upnext" href="#/schedule?date=${w.d}" style="text-decoration:none;color:inherit">
              <div class="datebox"><b>${UI.dayParts(w.d).day}</b><span>${w.d === t ? 'Today' : UI.dayParts(w.d).dow}</span></div>
              <div class="grow">${w.n ? `<b>${w.n}</b> booked` : '<span class="muted">No bookings</span>'}${Views.worksOn(Shell.user, w.d) ? '' : ' <span class="badge grey plain">Day off</span>'}</div>${icon('chevron', 'sm')}</a>`
            )
            .join('')}
        </section>
      </div>`;
  }

  // =====================================================================
  // Appointment detail + prescription
  // =====================================================================
  async function appointment(view, { params }) {
    const a = await API.get(`/appointments/${params[0]}`);
    Shell.title(a.patient_name);
    const t = UI.today();
    const canClose = a.status === 'booked' && a.appt_date <= t;

    view.innerHTML = `
      <a class="small" href="#/schedule?date=${a.appt_date}">← Back to ${esc(UI.relDay(a.appt_date).toLowerCase() === 'today' ? "today's" : UI.fmtDate(a.appt_date))} schedule</a>
      <section class="panel">
        <div class="patient-strip">
          <span class="avatar lg">${esc(UI.initials(a.patient_name))}</span>
          <div style="flex:1;min-width:200px"><div class="row"><h2>${esc(a.patient_name)}</h2>${UI.badge('appt', a.status)}</div>
            <div class="muted small">${esc(patientLine(a)) || 'No age or gender on file'}</div></div>
          <div class="kv">
            <div><span>Visit</span>${esc(UI.fmtDate(a.appt_date))}, ${esc(UI.time12(a.slot_time))}</div>
            <div><span>Phone</span>${a.patient_phone ? `<a href="tel:${esc(a.patient_phone)}">${esc(a.patient_phone)}</a>` : '–'}</div>
            <div><span>Room</span>${esc(a.room || '–')}</div>
          </div>
        </div>
        ${a.reason ? `<div class="divider"></div><p><span class="muted small">Reason for visit</span><br>${esc(a.reason)}</p>` : ''}
      </section>

      <div class="split">
        <div class="stack" id="main-col"></div>
        <aside class="stack">
          ${
            a.consult
              ? `<section class="panel"><div class="panel-head"><h2>AI consult summary</h2>${UI.badge('triage', a.consult.urgency)}</div>
                  <p class="small muted">Patient's own words</p><p>“${esc(a.consult.symptoms_text || a.consult.matched.join(', '))}”</p>
                  <div class="chips" style="margin:12px 0">${a.consult.matched.map((m) => `<span class="chip static">${esc(m)}</span>`).join('')}</div>
                  <div class="kv small"><div><span>Duration</span>${a.consult.duration_days !== null ? `${a.consult.duration_days} day(s)` : '–'}</div><div><span>Severity</span>${esc(UI.cap(a.consult.severity || '–'))}</div></div>
                  ${a.consult.conditions.length ? `<p class="small muted" style="margin-top:12px">Rule-based matches</p>${a.consult.conditions.map((c) => `<div class="cond"><span>${esc(c.name)}</span><div class="bar"><i style="width:${c.match}%"></i></div><span class="small muted">${c.match}%</span></div>`).join('')}` : ''}
                  <p class="small muted" style="margin-top:12px">Generated by the assistant before booking. Not a diagnosis.</p></section>`
              : ''
          }
          <section class="panel"><div class="panel-head"><h2>Earlier visits</h2></div>
            ${a.history && a.history.length ? a.history.map((h) => `<div class="history-item"><span class="muted small">${esc(UI.fmtDate(h.appt_date, { year: true }))}</span><br>${esc(h.diagnosis)}</div>`).join('') : '<p class="muted small">No earlier prescriptions.</p>'}
          </section>
          ${a.feedback ? `<section class="panel"><div class="panel-head"><h2>Patient feedback</h2>${UI.stars(a.feedback.rating)}</div><p class="small">${esc(a.feedback.comments || 'No comment')}</p></section>` : ''}
        </aside>
      </div>`;

    const col = view.querySelector('#main-col');
    if (a.prescription) {
      col.innerHTML = `<section class="panel"><div class="panel-head"><h2>Prescription</h2><button class="btn ghost sm" id="pdf">${icon('download', 'sm')} Download PDF</button></div>${Views.prescriptionHtml(a)}</section>`;
      col.querySelector('#pdf').addEventListener('click', () => PDF.prescription({ ...a, ...a.prescription, appointment_id: a.id }));
      return;
    }
    if (a.status !== 'booked') {
      col.innerHTML = `<section class="panel">${UI.empty(a.status === 'cancelled' ? 'This appointment was cancelled' : 'Marked as no-show', '', '', 'calendar')}</section>`;
      return;
    }

    col.innerHTML = `
      <section class="panel">
        <div class="panel-head"><div><h2>Write prescription</h2><p>Saving completes the visit and sends the prescription to the patient's records.</p></div></div>
        ${canClose ? '' : `<div class="notice warn" style="margin-bottom:16px">${icon('info')}<div>This visit is on ${esc(UI.fmtDate(a.appt_date))}. You can complete it on or after that day.</div></div>`}
        <form id="rx" novalidate>
          <fieldset ${canClose ? '' : 'disabled'} style="border:0;padding:0;margin:0">
            ${UI.fieldHtml({ name: 'diagnosis', label: 'Diagnosis', required: true, placeholder: 'e.g. Acute viral fever', maxlength: 255 })}
            <div style="margin-top:18px"><span class="label" style="font-size:.86rem;font-weight:500">Medicines</span>
              <div class="med-row med-head" aria-hidden="true"><span>Medicine</span><span>Dosage</span><span>How often</span><span>For</span><span></span></div>
              <div id="meds"></div>
              <button type="button" class="btn ghost sm" id="add-med">${icon('plus', 'sm')} Add medicine</button>
            </div>
            <datalist id="freq">${FREQUENCIES.map((f) => `<option value="${f}">`).join('')}</datalist>
            <div class="form-grid" style="margin-top:18px">
              ${UI.fieldHtml({ name: 'advice', label: 'Advice', type: 'textarea', span: 2, optional: true, placeholder: 'Rest, diet, warning signs to watch for', maxlength: 1000 })}
              ${UI.fieldHtml({ name: 'follow_up_date', label: 'Follow-up date', type: 'date', optional: true, min: UI.addDays(t, 1) })}
            </div>
          </fieldset>
          <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
          <div class="form-actions" style="flex-wrap:wrap">
            <button type="button" class="btn danger" id="cancel-appt">Cancel appointment</button>
            ${canClose ? '<button type="button" class="btn ghost" id="no-show">Mark no-show</button>' : ''}
            <button class="btn" type="submit" ${canClose ? '' : 'disabled'}>${icon('check', 'sm')} Complete visit</button>
          </div>
        </form>
      </section>`;

    const meds = col.querySelector('#meds');
    const addMed = (m = {}) => {
      const row = document.createElement('div');
      row.className = 'med-row';
      row.innerHTML = `
        <input class="input" data-k="name" placeholder="e.g. Paracetamol 650 mg" aria-label="Medicine name" value="${esc(m.name || '')}">
        <input class="input" data-k="dosage" placeholder="1 tablet" aria-label="Dosage" value="${esc(m.dosage || '')}">
        <input class="input" data-k="frequency" list="freq" placeholder="Twice a day" aria-label="How often" value="${esc(m.frequency || '')}">
        <input class="input" data-k="duration" placeholder="5 days" aria-label="For how long" value="${esc(m.duration || '')}">
        <button type="button" class="icon-btn" data-remove aria-label="Remove medicine">${icon('x')}</button>`;
      meds.appendChild(row);
      return row;
    };
    addMed();
    col.querySelector('#add-med').addEventListener('click', () => addMed().querySelector('input').focus());
    meds.addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      b.closest('.med-row').remove();
      if (!meds.children.length) addMed();
    });

    const form = col.querySelector('#rx');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      const v = UI.readForm(form);
      const medicines = [...meds.querySelectorAll('.med-row')]
        .map((r) => Object.fromEntries([...r.querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.value.trim()])))
        .filter((m) => m.name);
      try {
        await UI.busy(form.querySelector('[type=submit]'), () => API.post(`/appointments/${a.id}/prescription`, { diagnosis: v.diagnosis, advice: v.advice, follow_up_date: v.follow_up_date, medicines }));
        UI.toast(`Visit completed. ${a.patient_name} can now download the prescription.`);
        Shell.go(`#/appt/${a.id}`);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
    const noShow = col.querySelector('#no-show');
    if (noShow)
      noShow.addEventListener('click', async () => {
        if (!(await UI.confirm({ title: 'Mark as no-show?', message: `${a.patient_name} did not come for the ${UI.time12(a.slot_time)} appointment.`, confirmLabel: 'Mark no-show' }))) return;
        try {
          await API.patch(`/appointments/${a.id}/no-show`);
          UI.toast('Marked as no-show.');
          Shell.go(`#/schedule?date=${a.appt_date}`);
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    col.querySelector('#cancel-appt').addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Cancel this appointment?', message: `${a.patient_name} will be notified and asked to book another slot.`, confirmLabel: 'Cancel appointment', cancelLabel: 'Keep it', danger: true }))) return;
      try {
        await API.patch(`/appointments/${a.id}/cancel`);
        UI.toast('Appointment cancelled. The patient has been notified.');
        Shell.go(`#/schedule?date=${a.appt_date}`);
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }

  // =====================================================================
  // Availability
  // =====================================================================
  async function availability(view) {
    Shell.title('Availability');
    const u = await API.get('/auth/me');
    view.innerHTML = `
      <div class="split">
        <section class="panel">
          <div class="panel-head"><div><h2>When patients can book you</h2><p>Changes apply to new bookings. Existing appointments stay as they are.</p></div></div>
          <form id="av" novalidate>
            <div class="form-grid">
              ${UI.fieldHtml({ name: 'work_days', label: 'Working days', type: 'days', value: u.work_days, span: 2 })}
              ${UI.fieldHtml({ name: 'start_time', label: 'Starts at', type: 'time', value: u.start_time, required: true })}
              ${UI.fieldHtml({ name: 'end_time', label: 'Ends at', type: 'time', value: u.end_time, required: true })}
              ${UI.fieldHtml({ name: 'slot_minutes', label: 'Time per patient', type: 'select', value: u.slot_minutes, options: [10, 15, 20, 30, 45, 60].map((n) => [n, `${n} minutes`]) })}
              ${UI.fieldHtml({ name: 'room', label: 'Room / cabin', value: u.room || '', maxlength: 40 })}
              ${UI.fieldHtml({ name: 'bio', label: 'About you (shown to patients)', type: 'textarea', span: 2, value: u.bio || '', maxlength: 500 })}
            </div>
            <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
            <div class="form-actions"><button class="btn" type="submit">Save availability</button></div>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><h2>Preview</h2></div><div id="preview"></div></section>
      </div>`;
    const form = view.querySelector('#av');
    const preview = () => {
      const v = UI.readForm(form);
      const toMin = (x) => (x ? Number(x.slice(0, 2)) * 60 + Number(x.slice(3)) : 0);
      const n = Math.max(0, Math.floor((toMin(v.end_time) - toMin(v.start_time)) / Number(v.slot_minutes || 20)));
      const days = v.work_days.split(',').filter(Boolean).length;
      view.querySelector('#preview').innerHTML = `
        <div class="summary-box"><dl>
          <dt>Days</dt><dd>${esc(Views.workDays(v.work_days))}</dd>
          <dt>Hours</dt><dd>${v.start_time && v.end_time ? esc(Views.hours(v.start_time, v.end_time)) : '–'}</dd>
          <dt>Slots</dt><dd>${n} per day, ${n * days} per week</dd>
        </dl></div>
        <p class="small muted" style="margin-top:12px">Patients see these slots on your profile and can book up to 30 days ahead.</p>`;
    };
    form.addEventListener('input', preview);
    form.addEventListener('change', preview);
    preview();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      try {
        await UI.busy(form.querySelector('[type=submit]'), () => API.patch('/doctors/me/availability', UI.readForm(form)));
        Shell.user = await API.get('/auth/me');
        UI.toast('Availability saved.');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // =====================================================================
  // Profile & reviews
  // =====================================================================
  async function profile(view) {
    Shell.title('Profile');
    const u = await API.get('/auth/me');
    const d = await API.get(`/doctors/${u.doctor_id}`);
    view.innerHTML = `
      <div class="split">
        <div class="stack">
          <section class="panel">
            <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="avatar lg">${esc(UI.initials(u.name))}</span>
              <div><h2>${esc(u.name)}</h2><div class="muted small">${esc(u.specialization)}, ${esc(u.department)}</div><div class="small">${esc(u.qualification || '')}</div></div></div>
            <div class="divider"></div>
            <form id="me" novalidate><div class="form-grid">
              ${UI.fieldHtml({ name: 'name', label: 'Name', required: true, value: u.name })}
              ${UI.fieldHtml({ name: 'phone', label: 'Phone', type: 'tel', value: u.phone || '' })}
            </div>
            <p class="small muted" style="margin-top:10px">Email ${esc(u.email)}. Speciality, fee and department are managed by the hospital admin.</p>
            <div class="form-error" hidden role="alert" style="margin-top:12px"></div>
            <div class="form-actions"><button class="btn" type="submit">Save changes</button></div></form>
          </section>
          ${Views.passwordPanel()}
        </div>
        <section class="panel">
          <div class="panel-head"><h2>Patient reviews</h2>${UI.stars(d.rating, d.reviews)}</div>
          ${
            d.recent_feedback.length
              ? d.recent_feedback.map((f) => `<div class="history-item"><div class="row between"><b style="font-weight:500">${esc(f.patient_name)}</b><span class="stars">${icon('star', 'sm')} ${f.rating}</span></div><p class="small">${esc(f.comments || 'No comment')}</p><span class="small muted">${esc(UI.ago(f.created_at))}</span></div>`).join('')
              : UI.empty('No reviews yet', 'Patients can rate a visit after you complete it.', '', 'star')
          }
        </section>
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
    role: 'doctor',
    portal: 'Doctor',
    defaultRoute: 'schedule',
    nav: [
      { route: 'schedule', label: 'My schedule', icon: 'calendar' },
      { route: 'availability', label: 'Availability', icon: 'sliders' },
      { route: 'profile', label: 'Profile & reviews', icon: 'user' },
    ],
    activeFor: (r) => (r === 'appt' ? 'schedule' : r),
    routes: { schedule, appt: appointment, availability, profile },
  });
})();
