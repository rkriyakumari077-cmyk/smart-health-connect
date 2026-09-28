// Shared UI helpers used by every page.
(function () {
  // ---------- Escaping ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- Icons (24×24 stroke icons) ----------
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
    ai: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>',
    doctor: '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v2.5a5 5 0 0 0 10 0V12"/><circle cx="20" cy="10" r="2"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    flask: '<path d="M9 3h6M10 3v6.5L4.8 18.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9.5V3"/><path d="M7.5 14.5h9"/>',
    drop: '<path d="M12 2.8s-6.5 7.2-6.5 11.7a6.5 6.5 0 0 0 13 0C18.5 10 12 2.8 12 2.8z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="8.5" y="2.5" width="7" height="3.5" rx="1"/><path d="M9 11h6M9 15h4"/>',
    pill: '<path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/>',
    cross: '<path d="M12 5v14M5 12h14"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 1 1 12 6.4a4.8 4.8 0 1 1 7.5 6.2z"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

  // ---------- Dates, money, names ----------
  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toDateStr(new Date());
  const addDays = (s, n) => {
    const d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  };
  const parse = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00');
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(s, { year = false, weekday = true } = {}) {
    if (!s) return '';
    const d = parse(s);
    const base = `${d.getDate()} ${MON[d.getMonth()]}${year || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
    return weekday ? `${DOW[d.getDay()]}, ${base}` : base;
  }
  const dayParts = (s) => {
    const d = parse(s);
    return { dow: DOW[d.getDay()], day: d.getDate(), mon: MON[d.getMonth()] };
  };
  function relDay(s) {
    const t = today();
    if (s === t) return 'Today';
    if (s === addDays(t, 1)) return 'Tomorrow';
    if (s === addDays(t, -1)) return 'Yesterday';
    return fmtDate(s);
  }
  function time12(t) {
    if (!t) return '';
    return String(t).replace(/(\d{2}):(\d{2})/g, (_m, h, m) => {
      const H = Number(h);
      return `${H % 12 || 12}:${m} ${H < 12 ? 'AM' : 'PM'}`;
    });
  }
  function ago(iso) {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
    return fmtDate(iso.slice(0, 10), { weekday: false });
  }
  function age(dob) {
    if (!dob) return null;
    const b = parse(dob);
    const n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  }
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const initials = (name) =>
    String(name || '?')
      .replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  const cap = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const genderAge = (gender, dob) => [gender ? cap(gender) : null, dob ? `${age(dob)} yrs` : null].filter(Boolean).join(', ');

  // ---------- Status badges ----------
  const STATUS = {
    appt: { booked: ['teal', 'Booked'], completed: ['green', 'Completed'], cancelled: ['grey', 'Cancelled'], no_show: ['amber', 'No-show'] },
    lab: { booked: ['teal', 'Booked'], sample_collected: ['amber', 'Sample collected'], processing: ['amber', 'Processing'], report_ready: ['green', 'Report ready'], cancelled: ['grey', 'Cancelled'] },
    request: { pending: ['amber', 'Pending'], approved: ['teal', 'Approved'], fulfilled: ['green', 'Fulfilled'], rejected: ['grey', 'Rejected'] },
    urgency: { normal: ['grey', 'Normal'], urgent: ['amber', 'Urgent'], critical: ['red', 'Critical'] },
    triage: { self_care: ['green', 'Self-care'], doctor_soon: ['amber', 'Doctor in 1–2 days'], urgent: ['red', 'See a doctor today'], emergency: ['dark', 'Emergency'] },
  };
  function badge(kind, status) {
    const [cls, label] = (STATUS[kind] || {})[status] || ['grey', cap(status)];
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }

  // ---------- Small render helpers ----------
  const loading = () => '<div class="loading" role="status"><div class="spinner"></div><span class="sr-only">Loading</span></div>';
  const empty = (title, text = '', action = '', ic = 'clipboard') =>
    `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
  const stars = (rating, reviews) =>
    rating ? `<span class="stars">${icon('star', 'sm')} ${Number(rating).toFixed(1)}${reviews !== undefined ? `<span class="muted">(${reviews})</span>` : ''}</span>` : '<span class="muted small">New</span>';
  const errorBox = (err) => `<div class="notice danger">${icon('alert')}<div>${esc(err.message || err)}</div></div>`;

  // ---------- Toasts ----------
  function toast(message, type = 'ok') {
    let box = document.querySelector('.toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<div>${esc(message)}</div>`;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'error' ? 6000 : 3500);
  }

  // ---------- Modal (native <dialog>) ----------
  function modal({ title, subtitle = '', body = '', wide = false, onClose } = {}) {
    const d = document.createElement('dialog');
    d.className = `modal${wide ? ' wide' : ''}`;
    d.innerHTML = `
      <div class="modal-head">
        <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="modal-body"></div>`;
    const bodyEl = d.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
    document.body.appendChild(d);
    const close = () => d.close();
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) close();
      if (e.target === d) close(); // click on the backdrop
    });
    d.addEventListener('close', () => {
      d.remove();
      if (onClose) onClose();
    });
    d.showModal();
    return { el: d, body: bodyEl, close };
  }

  function confirmBox({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Go back', danger = false }) {
    return new Promise((resolve) => {
      let answer = false;
      const m = modal({
        title,
        body: `<p>${esc(message)}</p>
          <div class="form-actions">
            <button class="btn ghost" data-close>${esc(cancelLabel)}</button>
            <button class="btn ${danger ? 'solid-danger' : ''}" data-ok>${esc(confirmLabel)}</button>
          </div>`,
        onClose: () => resolve(answer),
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => {
        answer = true;
        m.close();
      });
    });
  }

  // ---------- Forms ----------
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fieldHtml(f) {
    const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
    const v = f.value ?? '';
    const req = f.required ? 'required' : '';
    const attrs = [req, f.min !== undefined ? `min="${f.min}"` : '', f.max !== undefined ? `max="${f.max}"` : '', f.step ? `step="${f.step}"` : '',
      f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '', f.maxlength ? `maxlength="${f.maxlength}"` : '', f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''].join(' ');
    const span = f.span === 2 ? ' span-2' : '';
    const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
    if (f.type === 'html') return `<div class="field${span}">${f.html}</div>`;
    if (f.type === 'checkbox') {
      return `<div class="field${span}"><label class="check"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>${hint}</div>`;
    }
    if (f.type === 'days') {
      const on = String(v).split(',');
      return `<div class="field${span}"><span class="label">${esc(f.label)}</span><div class="day-picks" data-days="${f.name}">
        ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" value="${d}" ${on.includes(String(d)) ? 'checked' : ''}><span>${DAY_NAMES[d]}</span></label>`).join('')}
        </div>${hint}</div>`;
    }
    let control;
    if (f.type === 'select') {
      control = `<select id="${id}" name="${f.name}" ${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${(f.options || [])
        .map((o) => {
          const [val, label] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
        })
        .join('')}</select>`;
    } else if (f.type === 'textarea') {
      control = `<textarea id="${id}" name="${f.name}" ${attrs}>${esc(v)}</textarea>`;
    } else {
      control = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${attrs}>`;
    }
    return `<div class="field${span}"><label for="${id}">${esc(f.label)}${f.optional ? ' <span class="muted">(optional)</span>' : ''}</label>${control}${hint}</div>`;
  }

  function readForm(form) {
    const out = {};
    for (const el of form.querySelectorAll('input[name], select[name], textarea[name]')) {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) out[el.name] = el.value;
      } else out[el.name] = el.value.trim();
    }
    for (const box of form.querySelectorAll('[data-days]')) {
      out[box.dataset.days] = [...box.querySelectorAll('input:checked')].map((i) => i.value).join(',');
    }
    return out;
  }

  // Button busy state around an async action. Returns the action's result.
  async function busy(btn, fn) {
    if (!btn) return fn();
    const html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${esc(btn.textContent.trim())}`;
    try {
      return await fn();
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.innerHTML = html;
      }
    }
  }

  // A modal with a generated form. onSubmit(values, form) may throw to show an error.
  function formModal({ title, subtitle, fields, submitLabel = 'Save', wide = false, onSubmit, extra, intro = '' }) {
    const form = document.createElement('form');
    form.noValidate = false;
    form.innerHTML = `${intro}<div class="form-grid">${fields.map(fieldHtml).join('')}</div>
      <div class="extra"></div>
      <div class="form-error" hidden role="alert"></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">${esc(submitLabel)}</button></div>`;
    const m = modal({ title, subtitle, body: form, wide });
    if (extra) extra(form.querySelector('.extra'), form);
    const errBox = form.querySelector('.form-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      try {
        await busy(form.querySelector('[type=submit]'), () => onSubmit(readForm(form), form));
        m.close();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    });
    const first = form.querySelector('input:not([type=checkbox]), select, textarea');
    if (first) first.focus();
    return m;
  }

  // Segmented control / chip groups: <div class="seg" data-seg="name"><button data-v="x">…
  function bindPressed(container, onChange, { multi = false } = {}) {
    container.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b || !container.contains(b)) return;
      if (multi) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      else for (const x of container.querySelectorAll('button[data-v]')) x.setAttribute('aria-pressed', String(x === b));
      onChange(b.dataset.v, b);
    });
  }

  // Tabs: <div class="tabs" role="tablist"><button role="tab" data-tab="x">…
  function bindTabs(container, onChange) {
    container.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      for (const x of container.querySelectorAll('[data-tab]')) x.setAttribute('aria-selected', String(x === b));
      onChange(b.dataset.tab);
    });
  }

  window.UI = {
    esc, icon, today, addDays, toDateStr, fmtDate, dayParts, relDay, time12, ago, age, money, initials, cap, genderAge,
    badge, loading, empty, stars, errorBox, toast, modal, confirm: confirmBox, fieldHtml, readForm, formModal, busy,
    bindPressed, bindTabs, DAY_NAMES, BLOOD_GROUPS: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  };
})();
