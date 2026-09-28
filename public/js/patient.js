// Patient portal.
(function () {
  const { esc, icon } = UI;
  const firstName = () => String(Shell.user.name || '').split(' ')[0];
  const myAge = () => UI.age(Shell.user.dob);

  // =====================================================================
  // Home
  // =====================================================================
  async function home(view) {
    Shell.title('Home');
    const [appts, bookings, records] = await Promise.all([API.get('/appointments'), API.get('/lab/bookings'), API.get('/records')]);
    const t = UI.today();
    const upcoming = appts
      .filter((a) => a.status === 'booked' && a.appt_date >= t)
      .sort((a, b) => (a.appt_date + a.slot_time).localeCompare(b.appt_date + b.slot_time));
    const labActive = bookings.filter((b) => ['booked', 'sample_collected', 'processing'].includes(b.status));
    const report = records.reports[0];
    const rx = records.prescriptions[0];

    const next = [
      ...upcoming.slice(0, 3).map(
        (a) => `<div class="upnext">${dateBox(a.appt_date)}<div class="grow"><b>${esc(a.doctor_name)}</b>
          <div class="small muted">${esc(a.specialization)}, ${esc(UI.time12(a.slot_time))}${a.room ? `, ${esc(a.room)}` : ''}</div></div>
          <a class="btn ghost sm" href="#/appointments">Manage</a></div>`
      ),
      ...labActive.slice(0, 2).map(
        (b) => `<div class="upnext">${dateBox(b.booking_date)}<div class="grow"><b>${esc(b.test_name)}</b>
          <div class="small muted">${b.collection_type === 'home' ? 'Home collection' : 'Lab visit'}, ${esc(UI.time12(b.time_slot))}</div>${Views.stepper(b.status)}</div></div>`
      ),
    ];

    view.innerHTML = `
      <section class="hello">
        <div><h1>Hello, ${esc(firstName())}</h1><p>Not feeling well? Tell the assistant your symptoms and it will point you to the right doctor.</p></div>
        <a class="btn mint" href="#/ai">${icon('ai')} Check my symptoms</a>
      </section>

      <div class="actions-grid">
        ${action('ai', 'ai', 'AI consult', 'Symptoms to advice and the right specialist', 'ai')}
        ${action('doctors', 'doctor', 'Book a doctor', 'Search by speciality and pick a slot')}
        ${action('lab', 'flask', 'Book a lab test', 'Home collection or lab visit')}
        ${action('blood', 'drop', 'Blood bank', 'Stock, donors and emergency requests', 'blood')}
      </div>

      <div class="split">
        <section class="panel">
          <div class="panel-head"><h2>Coming up</h2><a class="small" href="#/appointments">All appointments</a></div>
          ${next.length ? next.join('') : UI.empty('Nothing booked', 'Book a doctor or a lab test and it will show up here.', `<a class="btn sm" href="#/doctors">Find a doctor</a>`, 'calendar')}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Latest records</h2><a class="small" href="#/records">All records</a></div>
          ${
            report || rx
              ? `${report ? recordRow('flask', report.test_name, `Report, ${UI.fmtDate(report.created_at.slice(0, 10))}`, abnormalBadge(report.results), `data-report="${report.booking_id}"`) : ''}
                 ${rx ? recordRow('pill', rx.diagnosis, `Prescription by ${rx.doctor_name}, ${UI.fmtDate(rx.appt_date)}`, '', `data-rx="${rx.appointment_id}"`) : ''}`
              : UI.empty('No records yet', 'Prescriptions and lab reports are saved here automatically.', '', 'file')
          }
        </section>
      </div>`;
    bindRecordButtons(view);
  }

  const dateBox = (d) => {
    const p = UI.dayParts(d);
    return `<div class="datebox"><b>${p.day}</b><span>${d === UI.today() ? 'Today' : p.mon}</span></div>`;
  };
  const action = (route, ic, title, text, cls = '') =>
    `<a class="action ${cls}" href="#/${route}"><span class="ic">${icon(ic)}</span><div><b>${title}</b><br><span>${text}</span></div></a>`;
  const abnormalBadge = (results) => {
    const n = results.filter((r) => r.flag !== 'normal').length;
    return n ? `<span class="badge red">${n} out of range</span>` : '<span class="badge green">All normal</span>';
  };
  const recordRow = (ic, title, sub, extra, data) =>
    `<div class="upnext"><span class="avatar">${icon(ic)}</span><div class="grow"><b>${esc(title)}</b><div class="small muted">${esc(sub)}</div>${extra ? `<div style="margin-top:4px">${extra}</div>` : ''}</div>
     <button class="btn ghost sm" ${data}>View</button></div>`;
  function bindRecordButtons(root) {
    root.addEventListener('click', (e) => {
      const r = e.target.closest('[data-report]');
      if (r) Views.reportModal(r.dataset.report);
      const p = e.target.closest('[data-rx]');
      if (p) Views.prescriptionModal(p.dataset.rx);
    });
  }

  // =====================================================================
  // AI Health Assistant
  // =====================================================================
  const SYSTEMS = {
    general: 'General', neuro: 'Head & nerves', respiratory: 'Breathing', ent: 'Ear, nose & throat', cardio: 'Heart',
    gi: 'Stomach & digestion', urinary: 'Urine', skin: 'Skin', eyes: 'Eyes', musculoskeletal: 'Bones & joints',
    mental: 'Mind & sleep', womens: "Women's health",
  };
  const EXAMPLES = ['bukhar aur sar dard 2 din se', 'sneezing, runny nose and itchy eyes', 'burning while passing urine', 'loose motions and vomiting since morning'];
  const LEVELS = ['self_care', 'doctor_soon', 'urgent', 'emergency'];
  const ai = { symptoms: null, thread: [], picked: new Set(), severity: 'moderate' };

  async function assistant(view) {
    Shell.title('AI Health Assistant');
    if (!ai.symptoms) ai.symptoms = await API.get('/ai/symptoms');
    view.innerHTML = `
      <div class="ai-layout">
        <section class="chat" aria-label="Conversation with the AI Health Assistant">
          <div class="thread" id="thread" aria-live="polite"></div>
          <form class="composer" id="composer">
            <label class="sr-only" for="ai-text">Describe your symptoms</label>
            <textarea id="ai-text" placeholder="Describe how you feel, e.g. fever and headache since yesterday" maxlength="1000"></textarea>
            <div class="chips picked" id="picked"></div>
            <div class="opts">
              <div class="field"><label for="ai-age">Age</label><input id="ai-age" type="number" min="0" max="120" inputmode="numeric" value="${esc(myAge() ?? '')}"></div>
              <div class="field"><label for="ai-days">Days unwell</label><input id="ai-days" type="number" min="0" max="365" inputmode="numeric" placeholder="e.g. 2"></div>
              <div class="field" style="width:auto"><span class="label">How bad is it?</span>
                <div class="seg" id="sev">${['mild', 'moderate', 'severe'].map((s) => `<button type="button" data-v="${s}" aria-pressed="${s === ai.severity}">${UI.cap(s)}</button>`).join('')}</div>
              </div>
              <button type="button" class="btn ghost" id="pick-toggle" aria-expanded="false">${icon('plus', 'sm')} Pick symptoms</button>
              <button class="btn send" type="submit">${icon('send', 'sm')} Ask the assistant</button>
            </div>
            <div class="picker" id="picker" hidden>
              <div class="search"><span>${icon('search')}</span><input class="input" id="sym-search" placeholder="Search symptoms" aria-label="Search symptoms"></div>
              <div id="sym-groups"></div>
            </div>
          </form>
        </section>
        <aside class="panel">
          <div class="panel-head"><h2>Past consultations</h2></div>
          <div id="history">${UI.loading()}</div>
        </aside>
      </div>`;

    const thread = view.querySelector('#thread');
    const form = view.querySelector('#composer');
    const text = view.querySelector('#ai-text');
    const picker = view.querySelector('#picker');

    // Thread: greeting + everything from this session
    const greeting = `<div class="msg"><span class="who-ic">${icon('ai')}</span><div class="bubble">
      <p>Hi ${esc(firstName())}, what's bothering you today? Type in English or Hinglish, or pick symptoms from the list. Adding how many days and how bad it is makes the advice better.</p>
      <div class="chips examples">${EXAMPLES.map((e) => `<button type="button" class="chip" data-example="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      </div></div>`;
    thread.innerHTML = greeting + ai.thread.join('');

    UI.bindPressed(view.querySelector('#sev'), (v) => (ai.severity = v));
    thread.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-example]');
      if (ex) {
        text.value = ex.dataset.example;
        form.requestSubmit();
      }
    });

    // Symptom picker
    const renderGroups = (q = '') => {
      const query = q.trim().toLowerCase();
      const bySystem = {};
      for (const s of ai.symptoms) {
        if (s.code === 'self_harm_thoughts') continue; // typed only, never a tick-box
        if (query && !s.name.toLowerCase().includes(query)) continue;
        (bySystem[s.system] = bySystem[s.system] || []).push(s);
      }
      const html = Object.entries(bySystem)
        .map(
          ([sys, list]) => `<h4>${esc(SYSTEMS[sys] || sys)}</h4><div class="chips">${list
            .map((s) => `<button type="button" class="chip" data-v="${s.code}" aria-pressed="${ai.picked.has(s.code)}">${esc(s.name)}</button>`)
            .join('')}</div>`
        )
        .join('');
      view.querySelector('#sym-groups').innerHTML = html || '<p class="muted small" style="margin-top:10px">No symptom matches that. Describe it in the text box instead.</p>';
    };
    const renderPicked = () => {
      const names = Object.fromEntries(ai.symptoms.map((s) => [s.code, s.name]));
      view.querySelector('#picked').innerHTML = [...ai.picked]
        .map((c) => `<button type="button" class="chip" aria-pressed="true" data-unpick="${c}" aria-label="Remove ${esc(names[c])}">${esc(names[c])} ${icon('x', 'sm')}</button>`)
        .join('');
    };
    renderGroups();
    renderPicked();
    view.querySelector('#sym-search').addEventListener('input', (e) => renderGroups(e.target.value));
    view.querySelector('#sym-groups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      if (ai.picked.has(b.dataset.v)) ai.picked.delete(b.dataset.v);
      else ai.picked.add(b.dataset.v);
      b.setAttribute('aria-pressed', String(ai.picked.has(b.dataset.v)));
      renderPicked();
    });
    view.querySelector('#picked').addEventListener('click', (e) => {
      const b = e.target.closest('[data-unpick]');
      if (!b) return;
      ai.picked.delete(b.dataset.unpick);
      renderPicked();
      renderGroups(view.querySelector('#sym-search').value);
    });
    view.querySelector('#pick-toggle').addEventListener('click', (e) => {
      picker.hidden = !picker.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!picker.hidden));
      if (!picker.hidden) view.querySelector('#sym-search').focus();
    });
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        text: text.value.trim(),
        symptoms: [...ai.picked],
        age: view.querySelector('#ai-age').value,
        duration_days: view.querySelector('#ai-days').value,
        severity: ai.severity,
      };
      if (!body.text && !body.symptoms.length) {
        UI.toast('Describe how you feel or pick at least one symptom.', 'error');
        text.focus();
        return;
      }
      const names = Object.fromEntries(ai.symptoms.map((s) => [s.code, s.name]));
      const meta = [body.age ? `Age ${body.age}` : '', body.duration_days ? `${body.duration_days} day${body.duration_days === '1' ? '' : 's'}` : '', UI.cap(body.severity)].filter(Boolean).join(', ');
      const mine = `<div class="msg me"><div class="bubble">${esc(body.text || body.symptoms.map((c) => names[c]).join(', '))}
        ${body.text && body.symptoms.length ? `<div class="meta">+ ${esc(body.symptoms.map((c) => names[c]).join(', '))}</div>` : ''}<div class="meta">${esc(meta)}</div></div></div>`;
      ai.thread.push(mine);
      thread.insertAdjacentHTML('beforeend', mine + `<div class="msg" id="typing"><span class="who-ic">${icon('ai')}</span><div class="bubble"><div class="spinner" style="width:20px;height:20px"></div><span class="sr-only">Thinking</span></div></div>`);
      view.querySelector('#typing').scrollIntoView({ behavior: 'smooth', block: 'center' });
      const btn = form.querySelector('[type=submit]');
      try {
        const r = await UI.busy(btn, () => API.post('/ai/consult', body));
        const answer = `<div class="msg"><span class="who-ic">${icon('ai')}</span>${triageCard(r)}</div>`;
        ai.thread.push(answer);
        view.querySelector('#typing').outerHTML = answer;
        text.value = '';
        ai.picked.clear();
        renderPicked();
        renderGroups();
        picker.hidden = true;
        const cards = thread.querySelectorAll('.msg:last-child');
        cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (r.recognised) loadHistory(view);
      } catch (err) {
        view.querySelector('#typing').outerHTML = `<div class="msg"><span class="who-ic">${icon('ai')}</span><div class="bubble">${esc(err.message)}</div></div>`;
      }
    });

    loadHistory(view);
  }

  function triageCard(r) {
    if (!r.recognised) {
      return `<div class="bubble"><p>${esc(r.message)}</p>${r.negated && r.negated.length ? `<p class="small muted" style="margin-top:6px">Noted that you don't have: ${esc(r.negated.join(', '))}.</p>` : ''}</div>`;
    }
    const lvl = r.urgency.level;
    const at = LEVELS.indexOf(lvl);
    const emergency = lvl === 'emergency';
    const consultQ = r.consultId ? `?consult=${r.consultId}` : '';
    return `<article class="triage u-${lvl}">
      <div class="triage-top">
        <div class="level">${esc(r.urgency.label)}</div>
        <p>${esc(r.urgency.message)}</p>
        <div class="meter" aria-hidden="true">${LEVELS.map((_, i) => `<span class="${i <= at ? 'on' : ''}"></span>`).join('')}</div>
        <div class="meter-labels" aria-hidden="true"><span>Self-care</span><span>1–2 days</span><span>Today</span><span>Emergency</span></div>
        ${emergency ? `<div class="row" style="margin-top:14px"><a class="btn mint" href="tel:112">${icon('phone', 'sm')} Call 112</a><a class="btn ghost" href="tel:108">${icon('phone', 'sm')} Ambulance 108</a>${r.crisis ? `<a class="btn ghost" href="tel:14416">${icon('phone', 'sm')} Tele-MANAS 14416</a>` : ''}</div>` : ''}
      </div>
      <div class="triage-body">
        ${(r.redFlags || []).map((f) => `<div class="redflag">${icon('alert')}<div>${esc(f)}</div></div>`).join('')}
        <div><h4>What I understood</h4><div class="chips">
          ${r.matched.map((m) => `<span class="chip static">${esc(m.name)}</span>`).join('')}
          ${(r.negated || []).map((n) => `<span class="chip static" style="text-decoration:line-through" title="You said you don't have this">${esc(n)}</span>`).join('')}
        </div></div>
        ${
          r.conditions && r.conditions.length
            ? `<div><h4>Possible causes</h4>${r.conditions
                .map((c) => `<div class="cond"><span>${esc(c.name)}</span><div class="bar" role="img" aria-label="${c.match}% match"><i style="width:${c.match}%"></i></div><span class="small muted">${c.match}%</span></div>`)
                .join('')}</div>`
            : ''
        }
        <div><h4>What you can do now</h4><ul class="advice">${r.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
        ${
          r.medicine
            ? `<div><h4>Medicine category</h4><div class="medcard"><span class="ic">${icon('pill')}</span><div>
                <b>${esc(r.medicine.category)}</b>${r.medicine.otc ? '' : ' <span class="badge amber plain">Doctor only</span>'}
                ${r.medicine.examples ? `<p>Examples: ${esc(r.medicine.examples)}</p>` : ''}<p>${esc(r.medicine.caution)}</p></div></div></div>`
            : ''
        }
        ${
          r.doctors && r.doctors.length
            ? `<div><h4>${emergency ? 'After emergency care, follow up with' : 'Book a specialist'}: ${esc(r.department.name)}</h4>
              ${r.doctors
                .map(
                  (d) => `<div class="suggest"><span class="avatar">${esc(UI.initials(d.name))}</span><div class="grow"><b>${esc(d.name)}</b>
                  <span>${esc(d.specialization)}, ${d.experience_years} yrs, ${UI.money(d.fee)}</span></div>
                  <a class="btn sm ${emergency ? 'ghost' : ''}" href="#/book/${d.id}${consultQ}">Book</a></div>`
                )
                .join('')}</div>`
            : ''
        }
        ${
          r.tests && r.tests.length
            ? `<div><h4>Tests that can help</h4>${r.tests
                .map(
                  (t) => `<div class="suggest"><span class="avatar">${icon('flask', 'sm')}</span><div class="grow"><b>${esc(t.name)}</b>
                  <span>${UI.money(t.price)}${t.home_collection ? ', home collection available' : ', lab visit only'}</span></div>
                  <a class="btn ghost sm" href="#/lab?test=${t.id}">Book test</a></div>`
                )
                .join('')}</div>`
            : ''
        }
        ${r.reasons && r.reasons.length ? `<details class="why"><summary>Why this result?</summary><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
        <p class="disclaimer">${esc(r.disclaimer || '')}</p>
      </div>
    </article>`;
  }

  async function loadHistory(view) {
    const box = view.querySelector('#history');
    if (!box) return;
    try {
      const rows = await API.get('/ai/history');
      if (!box.isConnected) return;
      box.innerHTML = rows.length
        ? rows
            .map(
              (h) => `<div class="history-item"><div class="row between"><span class="muted small">${esc(UI.ago(h.created_at))}</span>${UI.badge('triage', h.urgency)}</div>
              <div style="margin-top:4px">${esc(h.matched.join(', '))}</div>
              ${h.conditions[0] ? `<div class="small muted">Likely: ${esc(h.conditions[0].name)}${h.department ? `, ${esc(h.department)}` : ''}</div>` : h.department ? `<div class="small muted">${esc(h.department)}</div>` : ''}
              </div>`
            )
            .join('')
        : UI.empty('No consultations yet', 'Your past checks will be listed here.', '', 'ai');
    } catch (err) {
      box.innerHTML = UI.errorBox(err);
    }
  }

  // =====================================================================
  // Find a doctor
  // =====================================================================
  async function doctors(view, { query }) {
    Shell.title('Find a doctor');
    const deps = await API.get('/doctors/departments');
    let dept = query.dept || '';
    view.innerHTML = `
      <div class="page-intro"><div><h1>Find a doctor</h1><p>Search by name or health problem, or pick a department. Tap Book to choose a time.</p></div></div>
      ${query.consult ? `<div class="notice">${icon('ai')}<div>Your AI consult will be shared with the doctor you book.</div></div>` : ''}
      <div class="row">
        <div class="search"><span>${icon('search')}</span><input class="input" id="q" type="search" placeholder="Search doctors, e.g. skin, heart, Dr. Rao" aria-label="Search doctors" value="${esc(query.q || '')}"></div>
      </div>
      <div class="chips" id="deps" role="group" aria-label="Department">
        <button class="chip" data-v="" aria-pressed="${!dept}">All</button>
        ${deps.filter((d) => d.doctor_count > 0).map((d) => `<button class="chip" data-v="${d.id}" aria-pressed="${String(d.id) === dept}">${esc(d.name)}</button>`).join('')}
      </div>
      <div class="grid cards" id="list">${UI.loading()}</div>`;

    const list = view.querySelector('#list');
    const q = view.querySelector('#q');
    let timer;
    const load = async () => {
      list.innerHTML = UI.loading();
      const rows = await API.get('/doctors', { department_id: dept, q: q.value.trim() });
      if (!list.isConnected) return;
      const consultQ = query.consult ? `?consult=${query.consult}` : '';
      list.innerHTML = rows.length
        ? rows
            .map(
              (d) => `<article class="doc-card">
              <div class="top"><span class="avatar">${esc(UI.initials(d.name))}</span><div>
                <h3>${esc(d.name)}</h3><div class="small muted">${esc(d.specialization)}, ${esc(d.department)}</div></div></div>
              <div class="facts">
                <span>${icon('shield', 'sm')} ${d.experience_years} yrs experience</span>
                <span>${icon('calendar', 'sm')} ${esc(Views.workDays(d.work_days))}</span>
                <span>${icon('clock', 'sm')} ${esc(Views.hours(d.start_time, d.end_time))}</span>
              </div>
              <div class="foot"><div><span class="fee">${UI.money(d.fee)}</span> ${UI.stars(d.rating, d.reviews)}</div>
                <a class="btn sm" href="#/book/${d.id}${consultQ}">Book</a></div>
            </article>`
            )
            .join('')
        : `<div style="grid-column:1/-1">${UI.empty('No doctors found', 'Try a different word or pick "All".', '', 'search')}</div>`;
    };
    UI.bindPressed(view.querySelector('#deps'), (v) => {
      dept = v;
      load();
    });
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    });
    await load();
  }

  // =====================================================================
  // Book an appointment
  // =====================================================================
  async function book(view, { params, query }) {
    const d = await API.get(`/doctors/${params[0]}`);
    Shell.title('Book an appointment');
    let consult = null;
    if (query.consult) {
      const hist = await API.get('/ai/history').catch(() => []);
      consult = hist.find((h) => String(h.id) === String(query.consult)) || null;
    }
    view.innerHTML = `
      <a class="small" href="#/doctors">${'← All doctors'}</a>
      <div class="split">
        <section class="panel">
          <div class="panel-head"><div><h2>Choose a date and time</h2><p>Grey dates are days ${esc(d.name)} doesn't see patients.</p></div></div>
          <div id="picker"></div>
          <div class="field" style="margin-top:20px"><label for="reason">Reason for visit <span class="muted">(optional)</span></label>
            <textarea id="reason" maxlength="500" placeholder="e.g. Fever for 3 days">${esc(consult ? `${consult.matched.join(', ')} (from AI consult)` : '')}</textarea></div>
          ${consult ? `<div class="notice" style="margin-top:12px">${icon('ai')}<div>The doctor will see your AI consult summary: ${esc(consult.matched.join(', '))}.</div></div>` : ''}
        </section>
        <aside class="stack">
          <section class="panel">
            <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="avatar lg">${esc(UI.initials(d.name))}</span>
              <div><h2>${esc(d.name)}</h2><div class="muted small">${esc(d.specialization)}, ${esc(d.department)}</div><div style="margin-top:4px">${UI.stars(d.rating, d.reviews)}</div></div></div>
            <div class="kv" style="margin-top:16px">
              <div><span>Qualification</span>${esc(d.qualification || '–')}</div>
              <div><span>Experience</span>${d.experience_years} years</div>
              <div><span>Room</span>${esc(d.room || '–')}</div>
              <div><span>Timings</span>${esc(Views.workDays(d.work_days))}, ${esc(Views.hours(d.start_time, d.end_time))}</div>
            </div>
            ${d.bio ? `<p class="small" style="margin-top:14px">${esc(d.bio)}</p>` : ''}
            ${
              d.recent_feedback.length
                ? `<div class="divider"></div><h3 style="margin-bottom:8px">What patients say</h3>${d.recent_feedback
                    .slice(0, 2)
                    .map((f) => `<p class="small" style="margin-bottom:8px"><span class="stars">${icon('star', 'sm')} ${f.rating}</span> ${esc(f.comments || 'No comment')} <span class="muted">– ${esc(f.patient_name.split(' ')[0])}</span></p>`)
                    .join('')}`
                : ''
            }
          </section>
          <section class="panel">
            <h3 style="margin-bottom:12px">Your booking</h3>
            <div class="summary-box"><dl>
              <dt>Date</dt><dd id="sum-date">Pick a date</dd>
              <dt>Time</dt><dd id="sum-time">Pick a time</dd>
              <dt>Fee</dt><dd>${UI.money(d.fee)} <span class="muted small">(pay at the hospital)</span></dd>
            </dl></div>
            <button class="btn block" id="confirm" style="margin-top:14px" disabled>Confirm booking</button>
          </section>
        </aside>
      </div>`;

    const confirmBtn = view.querySelector('#confirm');
    const picker = Views.slotPicker(view.querySelector('#picker'), d, {
      initialDate: query.date,
      onChange: ({ date, time }) => {
        view.querySelector('#sum-date').textContent = date ? UI.fmtDate(date) : 'Pick a date';
        view.querySelector('#sum-time').textContent = time ? UI.time12(time) : 'Pick a time';
        confirmBtn.disabled = !(date && time);
      },
    });
    confirmBtn.addEventListener('click', async () => {
      const { date, time } = picker.get();
      try {
        await UI.busy(confirmBtn, () =>
          API.post('/appointments', { doctor_id: d.id, appt_date: date, slot_time: time, reason: view.querySelector('#reason').value, consult_id: query.consult })
        );
        UI.toast(`Booked with ${d.name} on ${UI.fmtDate(date)} at ${UI.time12(time)}.`);
        Shell.go('#/appointments');
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }

  // =====================================================================
  // My appointments
  // =====================================================================
  async function appointments(view, { query }) {
    Shell.title('My appointments');
    const all = await API.get('/appointments');
    const t = UI.today();
    const groups = {
      upcoming: all.filter((a) => a.status === 'booked' && a.appt_date >= t).sort((a, b) => (a.appt_date + a.slot_time).localeCompare(b.appt_date + b.slot_time)),
      past: all.filter((a) => a.status === 'completed' || a.status === 'no_show' || (a.status === 'booked' && a.appt_date < t)),
      cancelled: all.filter((a) => a.status === 'cancelled'),
    };
    let tab = query.tab && groups[query.tab] ? query.tab : 'upcoming';
    view.innerHTML = `
      <div class="page-intro"><div><h1>My appointments</h1><p>Reschedule or cancel upcoming visits. After a visit, your prescription appears here.</p></div>
        <a class="btn" href="#/doctors">${icon('plus', 'sm')} Book a doctor</a></div>
      <section class="panel flush">
        <div class="tabs" role="tablist" style="padding:0 16px">
          ${[['upcoming', 'Upcoming'], ['past', 'Past visits'], ['cancelled', 'Cancelled']]
            .map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}<span class="n">${groups[k].length}</span></button>`)
            .join('')}
        </div>
        <div id="rows"></div>
      </section>`;
    const rows = view.querySelector('#rows');
    const draw = () => {
      const list = groups[tab];
      rows.innerHTML = list.length
        ? list
            .map(
              (a) => `<div class="item">${dateBox(a.appt_date)}
              <div class="grow"><div class="row"><b>${esc(a.doctor_name)}</b>${a.status === 'booked' && a.appt_date < t ? '<span class="badge amber">Awaiting doctor</span>' : UI.badge('appt', a.status)}</div>
                <div class="sub">${esc(a.specialization)}, ${esc(a.department)}${a.room ? `, ${esc(a.room)}` : ''}</div>
                <div class="sub">${esc(UI.fmtDate(a.appt_date))} at ${esc(UI.time12(a.slot_time))}${a.reason ? `, “${esc(a.reason)}”` : ''}</div></div>
              <div class="acts">${actionsFor(a)}</div></div>`
            )
            .join('')
        : UI.empty(
            { upcoming: 'No upcoming appointments', past: 'No past visits yet', cancelled: 'No cancelled appointments' }[tab],
            tab === 'upcoming' ? 'Find a doctor and pick a time that suits you.' : '',
            tab === 'upcoming' ? '<a class="btn sm" href="#/doctors">Find a doctor</a>' : '',
            'calendar'
          );
    };
    const actionsFor = (a) => {
      if (a.status === 'booked' && a.appt_date >= t)
        return `<button class="btn ghost sm" data-resched="${a.id}">Reschedule</button><button class="btn danger sm" data-cancel="${a.id}">Cancel</button>`;
      if (a.status === 'completed')
        return `${a.prescription_id ? `<button class="btn ghost sm" data-rx="${a.id}">${icon('file', 'sm')} Prescription</button>` : ''}
          ${a.feedback_rating ? `<span class="stars" title="Your rating">${icon('star', 'sm')} ${a.feedback_rating}</span>` : `<button class="btn sm" data-rate="${a.id}">Rate visit</button>`}`;
      return '';
    };
    draw();
    UI.bindTabs(view.querySelector('.tabs'), (k) => {
      tab = k;
      draw();
    });
    rows.addEventListener('click', async (e) => {
      const byId = (attr) => all.find((a) => String(a.id) === e.target.closest(`[${attr}]`).getAttribute(attr));
      if (e.target.closest('[data-rx]')) Views.prescriptionModal(e.target.closest('[data-rx]').dataset.rx);
      if (e.target.closest('[data-cancel]')) {
        const a = byId('data-cancel');
        const ok = await UI.confirm({ title: 'Cancel this appointment?', message: `${a.doctor_name}, ${UI.fmtDate(a.appt_date)} at ${UI.time12(a.slot_time)}. The slot will be freed for other patients.`, confirmLabel: 'Cancel appointment', cancelLabel: 'Keep it', danger: true });
        if (!ok) return;
        try {
          await API.patch(`/appointments/${a.id}/cancel`);
          UI.toast('Appointment cancelled.');
          Shell.go('#/appointments?tab=cancelled');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      }
      if (e.target.closest('[data-resched]')) reschedule(byId('data-resched'));
      if (e.target.closest('[data-rate]')) rate(byId('data-rate'));
    });
  }

  async function reschedule(a) {
    const d = await API.get(`/doctors/${a.doctor_id}`);
    const body = document.createElement('div');
    body.innerHTML = `<p class="muted small" style="margin-bottom:14px">Currently ${esc(UI.fmtDate(a.appt_date))} at ${esc(UI.time12(a.slot_time))}.</p><div class="picker-host"></div>
      <div class="form-actions"><button class="btn ghost" data-close>Keep current time</button><button class="btn" data-save disabled>Move appointment</button></div>`;
    const m = UI.modal({ title: `Reschedule with ${d.name}`, body, wide: true });
    const save = body.querySelector('[data-save]');
    const picker = Views.slotPicker(body.querySelector('.picker-host'), d, { exclude: a.id, initialDate: a.appt_date, onChange: (s) => (save.disabled = !(s.date && s.time)) });
    save.addEventListener('click', async () => {
      const { date, time } = picker.get();
      try {
        await UI.busy(save, () => API.patch(`/appointments/${a.id}/reschedule`, { appt_date: date, slot_time: time }));
        m.close();
        UI.toast(`Moved to ${UI.fmtDate(date)} at ${UI.time12(time)}.`);
        Shell.go('#/appointments');
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }

  function rate(a) {
    let rating = 0;
    UI.formModal({
      title: 'Rate your visit',
      subtitle: `${a.doctor_name}, ${UI.fmtDate(a.appt_date)}`,
      submitLabel: 'Submit rating',
      fields: [
        { type: 'html', span: 2, html: `<span class="label">Your rating</span><div class="seg" id="stars" role="group" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-v="${n}" aria-pressed="false" aria-label="${n} star${n > 1 ? 's' : ''}">${'★'.repeat(n)}</button>`).join('')}</div>` },
        { name: 'comments', label: 'Comments', type: 'textarea', span: 2, optional: true, placeholder: 'How was the consultation?', maxlength: 1000 },
      ],
      extra: (_x, form) => UI.bindPressed(form.querySelector('#stars'), (v) => (rating = Number(v))),
      onSubmit: async (v) => {
        if (!rating) throw new Error('Choose 1 to 5 stars.');
        await API.post(`/appointments/${a.id}/feedback`, { rating, comments: v.comments });
        UI.toast('Thanks for your feedback.');
        Shell.go('#/appointments?tab=past');
      },
    });
  }

  // =====================================================================
  // Lab tests
  // =====================================================================
  async function lab(view, { query }) {
    Shell.title('Lab tests');
    const [tests, slots, bookings] = await Promise.all([API.get('/lab/tests'), API.get('/lab/slots'), API.get('/lab/bookings')]);
    let tab = query.tab === 'mine' ? 'mine' : 'book';
    let cat = '';
    const cats = [...new Set(tests.map((t) => t.category))];
    view.innerHTML = `
      <div class="page-intro"><div><h1>Lab tests</h1><p>Book a test with home sample collection or a lab visit. Reports come to your health records.</p></div></div>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="book" aria-selected="${tab === 'book'}">Book a test</button>
        <button role="tab" data-tab="mine" aria-selected="${tab === 'mine'}">My tests<span class="n">${bookings.length}</span></button>
      </div>
      <div id="pane"></div>`;
    const pane = view.querySelector('#pane');

    const drawCatalog = () => {
      const list = tests.filter((t) => !cat || t.category === cat);
      pane.innerHTML = `
        <div class="chips" id="cats" style="margin-bottom:16px">${['', ...cats].map((c) => `<button class="chip" data-v="${esc(c)}" aria-pressed="${c === cat}">${esc(c || 'All tests')}</button>`).join('')}</div>
        <div class="grid cards">${list
          .map(
            (t) => `<article class="test-card"><div class="row between"><h3>${esc(t.name)}</h3></div>
            <p>${esc(t.description || '')}</p>
            <div class="facts small muted row" style="gap:6px 14px">
              <span class="row" style="gap:5px">${icon('clock', 'sm')} Report in ${t.turnaround_hours} h</span>
              <span class="row" style="gap:5px">${icon(t.home_collection ? 'home' : 'building', 'sm')} ${t.home_collection ? 'Home collection' : 'Lab visit only'}</span>
            </div>
            ${t.preparation ? `<p class="small"><b style="font-weight:500">Before the test:</b> ${esc(t.preparation)}</p>` : ''}
            <div class="foot"><span class="price">${UI.money(t.price)}</span><button class="btn sm" data-book="${t.id}">Book</button></div></article>`
          )
          .join('')}</div>`;
      UI.bindPressed(pane.querySelector('#cats'), (v) => {
        cat = v;
        drawCatalog();
      });
    };
    const drawMine = () => {
      pane.innerHTML = `<section class="panel flush">${
        bookings.length
          ? bookings
              .map(
                (b) => `<div class="item">${dateBox(b.booking_date)}<div class="grow"><div class="row"><b>${esc(b.test_name)}</b>${UI.badge('lab', b.status)}</div>
                <div class="sub">${b.collection_type === 'home' ? 'Home collection' : 'Lab visit'}, ${esc(UI.time12(b.time_slot))}, ${UI.money(b.price)}</div>${Views.stepper(b.status)}</div>
                <div class="acts">${b.status === 'report_ready' ? `<button class="btn sm" data-report="${b.id}">${icon('file', 'sm')} View report</button>` : ''}
                ${b.status === 'booked' ? `<button class="btn danger sm" data-cancel="${b.id}">Cancel</button>` : ''}</div></div>`
              )
              .join('')
          : UI.empty('No tests booked', 'Book a test and track it from sample collection to report.', '<button class="btn sm" data-tab-go="book">Browse tests</button>', 'flask')
      }</section>`;
    };
    const draw = () => (tab === 'book' ? drawCatalog() : drawMine());
    draw();
    UI.bindTabs(view.querySelector('.tabs'), (k) => {
      tab = k;
      draw();
    });

    pane.addEventListener('click', async (e) => {
      const bk = e.target.closest('[data-book]');
      if (bk) bookTest(tests.find((t) => String(t.id) === bk.dataset.book), slots);
      const rep = e.target.closest('[data-report]');
      if (rep) Views.reportModal(rep.dataset.report);
      if (e.target.closest('[data-tab-go]')) view.querySelector('[data-tab="book"]').click();
      const c = e.target.closest('[data-cancel]');
      if (c) {
        const b = bookings.find((x) => String(x.id) === c.dataset.cancel);
        const ok = await UI.confirm({ title: 'Cancel this test?', message: `${b.test_name} on ${UI.fmtDate(b.booking_date)}, ${UI.time12(b.time_slot)}.`, confirmLabel: 'Cancel test', cancelLabel: 'Keep it', danger: true });
        if (!ok) return;
        try {
          await API.patch(`/lab/bookings/${b.id}/cancel`);
          UI.toast('Test booking cancelled.');
          Shell.go('#/lab?tab=mine');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      }
    });

    if (query.test) {
      const t = tests.find((x) => String(x.id) === query.test);
      if (t) bookTest(t, slots);
      history.replaceState(null, '', '#/lab');
    }
  }

  function bookTest(test, slots) {
    const t = UI.today();
    const dates = Array.from({ length: 14 }, (_, i) => UI.addDays(t, i));
    const state = { type: test.home_collection ? 'home' : 'lab', date: t, slot: null };
    const nowHM = () => {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="field"><span class="label">Sample collection</span>
        <div class="seg" id="type">
          <button type="button" data-v="home" aria-pressed="${state.type === 'home'}" ${test.home_collection ? '' : 'disabled'}>Home collection</button>
          <button type="button" data-v="lab" aria-pressed="${state.type === 'lab'}">Lab visit</button>
        </div>
        ${test.home_collection ? '' : '<span class="hint">This test needs a lab visit.</span>'}
      </div>
      <div class="field" id="addr-field" style="margin-top:14px" ${state.type === 'home' ? '' : 'hidden'}><label for="addr">Address for sample collection</label>
        <textarea id="addr" maxlength="255" style="min-height:70px" placeholder="House no., street, sector, city">${esc(Shell.user.address || '')}</textarea></div>
      <div class="field" style="margin-top:14px"><span class="label">Date</span>
        <div class="date-strip" id="dates">${dates
          .map((d) => {
            const p = UI.dayParts(d);
            return `<button type="button" data-date="${d}" aria-pressed="${d === state.date}"><small>${d === t ? 'Today' : p.dow}</small><b>${p.day}</b><small>${p.mon}</small></button>`;
          })
          .join('')}</div></div>
      <div class="field" style="margin-top:6px"><span class="label">Time window</span><div class="slot-grid" id="slots" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></div></div>
      ${test.preparation ? `<div class="notice warn" style="margin-top:16px">${icon('info')}<div><b style="font-weight:500">Before the test:</b> ${esc(test.preparation)}</div></div>` : ''}
      <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
      <div class="form-actions"><span class="price" style="margin-right:auto;align-self:center">${UI.money(test.price)}</span><button class="btn ghost" data-close>Cancel</button><button class="btn" data-save disabled>Confirm booking</button></div>`;
    const m = UI.modal({ title: `Book ${test.name}`, subtitle: `${test.sample_type} sample, report in ${test.turnaround_hours} hours`, body, wide: true });
    const save = body.querySelector('[data-save]');
    const drawSlots = () => {
      body.querySelector('#slots').innerHTML = slots
        .map((s) => {
          const past = state.date === t && s.slice(6) <= nowHM();
          return `<button type="button" data-slot="${esc(s)}" aria-pressed="${state.slot === s}" ${past ? 'disabled' : ''}>${esc(UI.time12(s))}</button>`;
        })
        .join('');
      save.disabled = !state.slot;
    };
    drawSlots();
    UI.bindPressed(body.querySelector('#type'), (v) => {
      state.type = v;
      body.querySelector('#addr-field').hidden = v !== 'home';
    });
    body.querySelector('#dates').addEventListener('click', (e) => {
      const b = e.target.closest('[data-date]');
      if (!b) return;
      state.date = b.dataset.date;
      state.slot = null;
      for (const x of body.querySelectorAll('#dates button')) x.setAttribute('aria-pressed', String(x === b));
      drawSlots();
    });
    body.querySelector('#slots').addEventListener('click', (e) => {
      const b = e.target.closest('[data-slot]');
      if (!b || b.disabled) return;
      state.slot = b.dataset.slot;
      drawSlots();
    });
    save.addEventListener('click', async () => {
      const err = body.querySelector('.form-error');
      err.hidden = true;
      try {
        await UI.busy(save, () =>
          API.post('/lab/bookings', { test_id: test.id, collection_type: state.type, address: body.querySelector('#addr').value, booking_date: state.date, time_slot: state.slot })
        );
        m.close();
        UI.toast(`${test.name} booked for ${UI.fmtDate(state.date)}, ${UI.time12(state.slot)}.`);
        Shell.go('#/lab?tab=mine');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
  }

  // =====================================================================
  // Health records
  // =====================================================================
  async function records(view) {
    Shell.title('Health records');
    const { prescriptions, reports } = await API.get('/records');
    const items = [
      ...prescriptions.map((p) => ({ kind: 'rx', date: p.appt_date, p })),
      ...reports.map((r) => ({ kind: 'report', date: r.created_at.slice(0, 10), r })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    let filter = 'all';
    view.innerHTML = `
      <div class="page-intro"><div><h1>Health records</h1><p>Every prescription and lab report in one place. Open one to read it or download a PDF to share.</p></div>
        <div class="seg" id="filter"><button data-v="all" aria-pressed="true">All</button><button data-v="rx" aria-pressed="false">Prescriptions</button><button data-v="report" aria-pressed="false">Lab reports</button></div></div>
      <section class="panel flush" id="list"></section>`;
    const list = view.querySelector('#list');
    const draw = () => {
      const rows = items.filter((i) => filter === 'all' || i.kind === filter);
      list.innerHTML = rows.length
        ? rows
            .map((i) =>
              i.kind === 'rx'
                ? `<div class="item"><span class="avatar">${icon('pill')}</span><div class="grow"><b>${esc(i.p.diagnosis)}</b>
                    <div class="sub">Prescription by ${esc(i.p.doctor_name)}, ${esc(i.p.department)}, ${esc(UI.fmtDate(i.date))}</div>
                    <div class="sub">${i.p.medicines.length} medicine${i.p.medicines.length === 1 ? '' : 's'}${i.p.follow_up_date ? `, follow-up ${esc(UI.fmtDate(i.p.follow_up_date))}` : ''}</div></div>
                    <div class="acts"><button class="btn ghost sm" data-rx="${i.p.appointment_id}">View</button><button class="btn ghost sm" data-rx-pdf="${i.p.appointment_id}">${icon('download', 'sm')} PDF</button></div></div>`
                : `<div class="item"><span class="avatar">${icon('flask')}</span><div class="grow"><div class="row"><b>${esc(i.r.test_name)}</b>${abnormalBadge(i.r.results)}</div>
                    <div class="sub">Lab report, ${esc(UI.fmtDate(i.date))}${i.r.technician_name ? `, by ${esc(i.r.technician_name)}` : ''}</div>
                    <div class="sub">${esc(i.r.summary)}</div></div>
                    <div class="acts"><button class="btn ghost sm" data-report="${i.r.booking_id}">View</button><button class="btn ghost sm" data-report-pdf="${i.r.booking_id}">${icon('download', 'sm')} PDF</button></div></div>`
            )
            .join('')
        : UI.empty('Nothing here yet', 'Prescriptions from your visits and your lab reports are saved automatically.', '', 'file');
    };
    draw();
    UI.bindPressed(view.querySelector('#filter'), (v) => {
      filter = v;
      draw();
    });
    bindRecordButtons(list);
    list.addEventListener('click', async (e) => {
      const rp = e.target.closest('[data-rx-pdf]');
      const lp = e.target.closest('[data-report-pdf]');
      try {
        if (rp) {
          const a = await UI.busy(rp, () => API.get(`/appointments/${rp.dataset.rxPdf}`));
          PDF.prescription({ ...a, ...a.prescription, appointment_id: a.id });
        }
        if (lp) {
          const b = await UI.busy(lp, () => API.get(`/lab/bookings/${lp.dataset.reportPdf}`));
          PDF.report({ ...b, ...b.report, booking_id: b.id });
        }
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }

  // =====================================================================
  // Blood bank
  // =====================================================================
  async function blood(view, { query }) {
    Shell.title('Blood bank');
    const [stockData, requests, me] = await Promise.all([API.get('/blood/stock'), API.get('/blood/requests'), API.get('/blood/me/donor')]);
    const mine = Shell.user.blood_group;
    const compat = mine ? stockData.compatibility[mine] : null;
    const total = stockData.stock.reduce((s, x) => s + x.units, 0);
    let tab = ['donors', 'request', 'donate'].includes(query.tab) ? query.tab : 'donors';
    let showCompat = false;

    view.innerHTML = `
      <section class="bank">
        <div class="bank-head">
          <div><h2>Blood available right now</h2><p>Units in the hospital blood bank, updated by the blood bank team. Tap a group to find donors.</p></div>
          <div class="bank-total"><b>${total}</b><span>units in stock</span></div>
        </div>
        <div id="tubes">${Views.tubes(stockData.stock, { mine, clickable: true })}</div>
        <div class="bank-legend">
          ${mine ? `<span><i style="background:var(--mint)"></i>Your group: ${esc(mine)}</span>` : ''}
          <span><i style="background:#ffa58c"></i>Low stock (under ${stockData.low_threshold} units)</span>
          ${mine ? `<button class="chip" id="compat" aria-pressed="false" style="background:transparent;color:#cfe3e1;border-color:rgba(207,237,234,.3)">Show groups I can receive</button>` : ''}
        </div>
      </section>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="donors" aria-selected="${tab === 'donors'}">Find donors</button>
        <button role="tab" data-tab="request" aria-selected="${tab === 'request'}">Request blood${requests.length ? `<span class="n">${requests.length}</span>` : ''}</button>
        <button role="tab" data-tab="donate" aria-selected="${tab === 'donate'}">Donate blood</button>
      </div>
      <div id="pane"></div>`;
    Views.fillTubes(view);
    const pane = view.querySelector('#pane');
    const compatBtn = view.querySelector('#compat');
    if (compatBtn)
      compatBtn.addEventListener('click', () => {
        showCompat = !showCompat;
        compatBtn.setAttribute('aria-pressed', String(showCompat));
        compatBtn.textContent = showCompat ? 'Show all groups' : 'Show groups I can receive';
        for (const tb of view.querySelectorAll('#tubes .tube')) tb.classList.toggle('dim', showCompat && !compat.includes(tb.dataset.group));
      });

    const draw = () => ({ donors: drawDonors, request: drawRequest, donate: drawDonate })[tab]();
    UI.bindTabs(view.querySelector('.tabs'), (k) => {
      tab = k;
      draw();
    });
    view.querySelector('#tubes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-group]');
      if (!b) return;
      tab = 'donors';
      for (const x of view.querySelectorAll('.tabs [data-tab]')) x.setAttribute('aria-selected', String(x.dataset.tab === 'donors'));
      drawDonors(b.dataset.group);
      pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    function drawDonors(group = mine || '') {
      pane.innerHTML = `
        <section class="panel">
          <form class="row" id="dsearch" style="align-items:flex-end">
            <div class="field" style="width:150px"><label for="dg">Blood group needed</label><select id="dg"><option value="">Any group</option>${UI.BLOOD_GROUPS.map((g) => `<option ${g === group ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
            <div class="field" style="flex:1;min-width:160px"><label for="dc">City</label><input id="dc" placeholder="e.g. Noida" value="${esc(Shell.user.city || '')}"></div>
            <label class="check" style="min-height:44px"><input type="checkbox" id="dcompat" checked> Include compatible groups</label>
            <button class="btn" type="submit">${icon('search', 'sm')} Search</button>
          </form>
          <div id="dres" style="margin-top:12px"></div>
        </section>`;
      const res = pane.querySelector('#dres');
      const run = async () => {
        res.innerHTML = UI.loading();
        const g = pane.querySelector('#dg').value;
        const rows = await API.get('/blood/donors', { blood_group: g, city: pane.querySelector('#dc').value.trim(), compatible: g && pane.querySelector('#dcompat').checked ? 1 : '' });
        res.innerHTML = rows.length
          ? `<p class="small muted" style="margin-bottom:4px">${rows.length} verified donor${rows.length === 1 ? '' : 's'}. Numbers are hidden until you tap Show number.</p>` +
            rows
              .map(
                (d) => `<div class="donor-row"><span class="bg-pill">${esc(d.blood_group)}</span><div class="grow"><b style="font-weight:500">${esc(d.name)}</b>
                <div class="small muted">${esc(d.city)}</div>
                ${d.eligible ? '<span class="badge green">Can donate now</span>' : `<span class="badge grey">Can donate from ${esc(UI.fmtDate(d.next_date, { weekday: false }))}</span>`}</div>
                <span data-contact-box="${d.id}"><button class="btn ghost sm" data-contact="${d.id}">${icon('phone', 'sm')} Show number</button></span></div>`
              )
              .join('')
          : UI.empty('No donors found', 'Try another city, include compatible groups, or send an emergency request to the blood bank.', '<button class="btn sm" data-go-request>Send emergency request</button>', 'drop');
      };
      pane.querySelector('#dsearch').addEventListener('submit', (e) => {
        e.preventDefault();
        run().catch((err) => (res.innerHTML = UI.errorBox(err)));
      });
      res.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-contact]');
        if (c) {
          try {
            const d = await UI.busy(c, () => API.get(`/blood/donors/${c.dataset.contact}/contact`));
            res.querySelector(`[data-contact-box="${d.id}"]`).innerHTML = `<a class="btn sm" href="tel:${esc(d.phone)}">${icon('phone', 'sm')} ${esc(d.phone)}</a>`;
          } catch (err) {
            UI.toast(err.message, 'error');
          }
        }
        if (e.target.closest('[data-go-request]')) view.querySelector('[data-tab="request"]').click();
      });
      run().catch((err) => (res.innerHTML = UI.errorBox(err)));
    }

    function drawRequest() {
      let urgency = 'urgent';
      pane.innerHTML = `
        <div class="split">
          <section class="panel">
            <div class="panel-head"><div><h2>Request blood</h2><p>The blood bank team sees this immediately and calls the contact number.</p></div></div>
            <form id="req" novalidate>
              <div class="form-grid">
                ${UI.fieldHtml({ name: 'patient_name', label: 'Patient name', required: true, value: Shell.user.name })}
                ${UI.fieldHtml({ name: 'blood_group', label: 'Blood group', type: 'select', required: true, placeholder: 'Select', options: UI.BLOOD_GROUPS, value: mine || '' })}
                ${UI.fieldHtml({ name: 'units', label: 'Units needed', type: 'number', min: 1, max: 20, value: 1, required: true })}
                ${UI.fieldHtml({ name: 'contact_phone', label: 'Contact number', type: 'tel', required: true, value: Shell.user.phone || '' })}
                ${UI.fieldHtml({ name: 'hospital', label: 'Hospital', required: true, span: 2, placeholder: 'Where is the patient admitted?' })}
                ${UI.fieldHtml({ name: 'city', label: 'City', required: true, value: Shell.user.city || '' })}
                ${UI.fieldHtml({ type: 'html', html: `<span class="label">Urgency</span><div class="seg" id="urg">${['normal', 'urgent', 'critical'].map((u) => `<button type="button" data-v="${u}" aria-pressed="${u === urgency}">${UI.cap(u)}</button>`).join('')}</div>` })}
                ${UI.fieldHtml({ name: 'notes', label: 'Notes', type: 'textarea', optional: true, span: 2, placeholder: 'e.g. surgery at 4 pm, platelets needed', maxlength: 500 })}
              </div>
              <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
              <div class="form-actions"><button class="btn solid-danger" type="submit">${icon('drop', 'sm')} Send request</button></div>
            </form>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>My requests</h2></div>
            ${
              requests.length
                ? requests
                    .map(
                      (r) => `<div class="donor-row"><span class="bg-pill">${esc(r.blood_group)}</span><div class="grow">
                      <div class="row"><b style="font-weight:500">${esc(r.patient_name)}</b>${UI.badge('request', r.status)}</div>
                      <div class="small muted">${r.units} unit${r.units > 1 ? 's' : ''}, ${esc(r.hospital)}, ${esc(UI.ago(r.created_at))}</div>
                      ${r.admin_note ? `<div class="small">Blood bank: ${esc(r.admin_note)}</div>` : ''}${UI.badge('urgency', r.urgency)}</div></div>`
                    )
                    .join('')
                : UI.empty('No requests yet', 'Requests you send appear here with their status.', '', 'drop')
            }
          </section>
        </div>`;
      UI.bindPressed(pane.querySelector('#urg'), (v) => (urgency = v));
      const form = pane.querySelector('#req');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = form.querySelector('.form-error');
        err.hidden = true;
        try {
          const v = UI.readForm(form);
          const r = await UI.busy(form.querySelector('[type=submit]'), () => API.post('/blood/requests', { ...v, urgency }));
          UI.toast(`Request sent. ${r.in_stock} unit${r.in_stock === 1 ? '' : 's'} of ${v.blood_group} in stock right now.`);
          Shell.go('#/blood?tab=request');
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
      });
    }

    function drawDonate() {
      if (me) {
        const e = me.eligibility;
        pane.innerHTML = `
          <div class="split">
            <section class="panel">
              <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="bg-pill" style="width:60px;height:60px;font-size:1.2rem">${esc(me.blood_group)}</span>
                <div><h2>You're a registered donor</h2>
                <div class="row" style="margin-top:6px">${me.verified ? '<span class="badge green">Verified</span>' : '<span class="badge amber">Waiting for verification</span>'}
                ${e.eligible ? '<span class="badge teal">Can donate now</span>' : `<span class="badge grey">Next donation from ${esc(UI.fmtDate(e.next_date, { weekday: false }))}</span>`}</div></div></div>
              ${me.verified ? '' : `<p class="small muted" style="margin-top:14px">The blood bank team checks every new donor. Once verified, patients can find you in donor search.</p>`}
              ${!e.eligible && e.reasons.length ? `<ul class="advice small" style="margin-top:14px">${e.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
              <div class="divider"></div>
              <label class="check"><input type="checkbox" id="avail" ${me.available ? 'checked' : ''}> Show me in donor search</label>
              <p class="small muted" style="margin-top:6px">Turn this off when you're travelling or unwell.</p>
            </section>
            <section class="panel">
              <div class="panel-head"><h2>My donations</h2></div>
              ${
                me.donations.length
                  ? me.donations.map((d) => `<div class="donor-row">${dateBox(d.donation_date)}<div class="grow">${d.units} unit${d.units > 1 ? 's' : ''} donated</div>${icon('heart')}</div>`).join('')
                  : UI.empty('No donations recorded yet', 'When you donate at our blood bank, it is recorded here.', '', 'heart')
              }
            </section>
          </div>`;
        pane.querySelector('#avail').addEventListener('change', async (ev) => {
          try {
            await API.patch('/blood/me/donor', { available: ev.target.checked });
            me.available = ev.target.checked;
            UI.toast(ev.target.checked ? 'You will appear in donor search.' : 'You are hidden from donor search.');
          } catch (err) {
            ev.target.checked = !ev.target.checked;
            UI.toast(err.message, 'error');
          }
        });
        return;
      }
      const u = Shell.user;
      pane.innerHTML = `
        <div class="split">
          <section class="panel">
            <div class="panel-head"><div><h2>Become a blood donor</h2><p>One donation can help up to three patients. We only share your number when someone needs your blood group.</p></div></div>
            <form id="donor" novalidate>
              <div class="form-grid">
                ${UI.fieldHtml({ name: 'blood_group', label: 'Blood group', type: 'select', required: true, placeholder: 'Select', options: UI.BLOOD_GROUPS, value: u.blood_group || '' })}
                ${UI.fieldHtml({ name: 'gender', label: 'Gender', type: 'select', required: true, placeholder: 'Select', options: [['female', 'Female'], ['male', 'Male'], ['other', 'Other']], value: u.gender || '' })}
                ${UI.fieldHtml({ name: 'dob', label: 'Date of birth', type: 'date', required: true, value: u.dob || '', max: UI.today() })}
                ${UI.fieldHtml({ name: 'weight_kg', label: 'Weight (kg)', type: 'number', required: true, min: 20, max: 250 })}
                ${UI.fieldHtml({ name: 'phone', label: 'Mobile number', type: 'tel', required: true, value: u.phone || '' })}
                ${UI.fieldHtml({ name: 'city', label: 'City', required: true, value: u.city || '' })}
                ${UI.fieldHtml({ name: 'last_donation_date', label: 'Last donated on', type: 'date', optional: true, max: UI.today(), span: 2, hint: 'Leave empty if you have never donated.' })}
              </div>
              <div class="form-error" hidden role="alert" style="margin-top:14px"></div>
              <div class="form-actions"><button class="btn" type="submit">Register as donor</button></div>
            </form>
          </section>
          <section class="panel">
            <h3 style="margin-bottom:10px">Who can donate</h3>
            <ul class="advice">
              <li>Age 18 to 65 years</li><li>Weight 45 kg or more</li>
              <li>At least 90 days since your last donation (120 days for women)</li>
              <li>Feeling healthy today, with no fever or cold</li>
            </ul>
            <p class="small muted" style="margin-top:12px">Based on the National Blood Transfusion Council guidelines. The blood bank does a short health check before every donation.</p>
          </section>
        </div>`;
      const form = pane.querySelector('#donor');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = form.querySelector('.form-error');
        err.hidden = true;
        try {
          await UI.busy(form.querySelector('[type=submit]'), () => API.post('/blood/me/donor', UI.readForm(form)));
          UI.toast('Thank you! You are registered. The blood bank will verify you soon.');
          Shell.go('#/blood?tab=donate');
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
      });
    }

    draw();
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
          <div class="panel-head"><div><h2>Your details</h2><p>Used for bookings, the AI assistant (your age) and blood bank requests.</p></div></div>
          <form id="me" novalidate>
            <div class="form-grid">
              ${UI.fieldHtml({ name: 'name', label: 'Full name', required: true, value: u.name })}
              ${UI.fieldHtml({ name: 'phone', label: 'Mobile number', type: 'tel', value: u.phone || '' })}
              ${UI.fieldHtml({ name: 'dob', label: 'Date of birth', type: 'date', value: u.dob || '', max: UI.today() })}
              ${UI.fieldHtml({ name: 'gender', label: 'Gender', type: 'select', placeholder: 'Select', options: [['female', 'Female'], ['male', 'Male'], ['other', 'Other']], value: u.gender || '' })}
              ${UI.fieldHtml({ name: 'blood_group', label: 'Blood group', type: 'select', placeholder: "Don't know", options: UI.BLOOD_GROUPS, value: u.blood_group || '' })}
              ${UI.fieldHtml({ name: 'city', label: 'City', value: u.city || '' })}
              ${UI.fieldHtml({ name: 'address', label: 'Address', type: 'textarea', span: 2, value: u.address || '', hint: 'Used for home sample collection.' })}
            </div>
            <p class="small muted" style="margin-top:12px">Email: ${esc(u.email)}</p>
            <div class="form-error" hidden role="alert" style="margin-top:12px"></div>
            <div class="form-actions"><button class="btn" type="submit">Save changes</button></div>
          </form>
        </section>
        ${Views.passwordPanel()}
      </div>`;
    const form = view.querySelector('#me');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      err.hidden = true;
      try {
        const updated = await UI.busy(form.querySelector('[type=submit]'), () => API.patch('/auth/me', UI.readForm(form)));
        Shell.user = updated;
        UI.toast('Changes saved.');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      }
    });
    Views.bindPassword(view);
  }


  Shell.start({
    role: 'patient',
    portal: 'Patient',
    defaultRoute: 'home',
    nav: [
      { route: 'home', label: 'Home', icon: 'home' },
      { route: 'ai', label: 'AI Health Assistant', icon: 'ai' },
      { route: 'doctors', label: 'Find a doctor', icon: 'doctor' },
      { route: 'appointments', label: 'My appointments', icon: 'calendar' },
      { route: 'lab', label: 'Lab tests', icon: 'flask' },
      { route: 'records', label: 'Health records', icon: 'file' },
      { route: 'blood', label: 'Blood bank', icon: 'drop' },
      { route: 'profile', label: 'Profile', icon: 'user' },
    ],
    activeFor: (r) => (r === 'book' ? 'doctors' : r),
    routes: { home, ai: assistant, doctors, book, appointments, lab, records, blood, profile },
  });
})();
