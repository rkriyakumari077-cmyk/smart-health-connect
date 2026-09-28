// App shell shared by the patient, doctor, lab and admin pages:
// role check, sidebar navigation, hash router (#/page/param?x=y) and notifications.
(function () {
  const { esc, icon } = UI;
  const state = { config: null, user: null, view: null, notifTimer: null };

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const [route, ...params] = path.split('/').filter(Boolean);
    return { route: route || state.config.defaultRoute, params, query: Object.fromEntries(new URLSearchParams(query)) };
  }

  function layout() {
    const { nav } = state.config;
    const u = state.user;
    const roleLabel = { patient: 'Patient', doctor: u.specialization || 'Doctor', lab: 'Lab technician', admin: 'Administrator' }[u.role];
    document.body.innerHTML = `
      <div class="app">
        <aside class="sidebar" aria-label="Main navigation">
          <a class="brand" href="#/${state.config.defaultRoute}">
            <span class="brand-mark">${icon('cross')}</span>
            <span class="brand-name">Smart Health Connect<small>${esc(state.config.portal)}</small></span>
          </a>
          <nav class="nav">
            ${nav
              .map((n) =>
                n.group
                  ? `<div class="nav-group">${esc(n.group)}</div>`
                  : `<a href="#/${n.route}" data-route="${n.route}">${icon(n.icon)}<span>${esc(n.label)}</span><span class="count" data-count="${n.route}" hidden></span></a>`
              )
              .join('')}
          </nav>
          <div class="side-foot">
            <div class="avatar dark">${esc(UI.initials(u.name))}</div>
            <div class="who"><b>${esc(u.name)}</b><span>${esc(roleLabel)}</span></div>
            <button class="icon-btn" id="logout" title="Log out" aria-label="Log out">${icon('logout')}</button>
          </div>
        </aside>
        <div class="backdrop" id="backdrop"></div>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" id="menu" aria-label="Open menu">${icon('menu')}</button>
            <h1 id="page-title">&nbsp;</h1>
            <button class="icon-btn" id="bell" aria-label="Notifications" aria-expanded="false">${icon('bell')}<span class="dot" id="bell-dot" hidden></span></button>
          </header>
          <main id="view-host"></main>
        </div>
      </div>`;
    document.getElementById('logout').addEventListener('click', API.logout);
    document.getElementById('menu').addEventListener('click', () => document.body.classList.add('nav-open'));
    document.getElementById('backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
    document.getElementById('bell').addEventListener('click', toggleNotifications);
    document.addEventListener('click', (e) => {
      const panel = document.querySelector('.notif-panel');
      if (panel && !panel.contains(e.target) && !e.target.closest('#bell')) closeNotifications();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNotifications();
        document.body.classList.remove('nav-open');
      }
    });
  }

  async function render() {
    const { route, params, query } = parseHash();
    const fn = state.config.routes[route];
    if (!fn) return go(`#/${state.config.defaultRoute}`);
    document.body.classList.remove('nav-open');
    closeNotifications();
    const active = state.config.activeFor ? state.config.activeFor(route) : route;
    for (const a of document.querySelectorAll('.nav a')) {
      const on = a.dataset.route === active;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    // A fresh element per navigation: slow renders from an old page can't overwrite the new one.
    const host = document.getElementById('view-host');
    const view = document.createElement('div');
    view.className = 'view';
    view.innerHTML = UI.loading();
    host.replaceChildren(view);
    state.view = view;
    window.scrollTo(0, 0);
    try {
      await fn(view, { params, query });
    } catch (err) {
      console.error(err);
      if (view.isConnected) view.innerHTML = UI.errorBox(err);
    }
  }

  function title(text) {
    document.getElementById('page-title').textContent = text;
    document.title = `${text} — Smart Health Connect`;
  }
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  // ---------- Notifications ----------
  async function loadNotifications() {
    try {
      const data = await API.get('/auth/notifications');
      const dot = document.getElementById('bell-dot');
      dot.hidden = !data.unread;
      dot.textContent = data.unread > 9 ? '9+' : data.unread;
      state.notifications = data.items;
      return data;
    } catch {
      return null;
    }
  }
  function closeNotifications() {
    const p = document.querySelector('.notif-panel');
    if (p) p.remove();
    const bell = document.getElementById('bell');
    if (bell) bell.setAttribute('aria-expanded', 'false');
  }
  async function toggleNotifications() {
    if (document.querySelector('.notif-panel')) return closeNotifications();
    const bell = document.getElementById('bell');
    bell.setAttribute('aria-expanded', 'true');
    const panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notifications');
    panel.innerHTML = `<header><b>Notifications</b></header>${UI.loading()}`;
    document.querySelector('.main').appendChild(panel);
    const data = await loadNotifications();
    const items = (data && data.items) || [];
    panel.innerHTML = `<header><b>Notifications</b><span class="muted small">${items.length ? '' : ''}</span></header>
      ${
        items.length
          ? items
              .map(
                (n) => `<a class="notif-item ${n.is_read ? '' : 'unread'}" href="${esc(n.link || '#')}">
                  <b>${esc(n.title)}</b><span>${esc(n.body || '')}</span><br><span class="small">${esc(UI.ago(n.created_at))}</span></a>`
              )
              .join('')
          : UI.empty("You're all caught up", 'Reminders and updates about your bookings appear here.', '', 'bell')
      }`;
    if (data && data.unread) {
      await API.post('/auth/notifications/read').catch(() => {});
      document.getElementById('bell-dot').hidden = true;
    }
  }

  // ---------- Nav badges (e.g. pending requests) ----------
  async function refreshCounts() {
    if (!state.config.counts) return;
    try {
      const counts = await state.config.counts();
      for (const el of document.querySelectorAll('[data-count]')) {
        const n = counts[el.dataset.count];
        el.hidden = !n;
        el.textContent = n || '';
      }
    } catch {
      /* counts are optional */
    }
  }

  async function start(config) {
    state.config = config;
    const cached = API.session.user;
    if (!API.session.token || !cached) return location.replace('/');
    if (cached.role !== config.role) return location.replace(API.homeFor(cached.role));
    try {
      state.user = await API.get('/auth/me');
      API.session.save(null, state.user);
    } catch {
      return; // API wrapper redirects to login on 401
    }
    layout();
    window.addEventListener('hashchange', render);
    await render();
    loadNotifications();
    refreshCounts();
    state.notifTimer = setInterval(() => {
      loadNotifications();
      refreshCounts();
    }, 60000);
  }

  window.Shell = {
    start,
    title,
    go,
    refreshCounts,
    get user() {
      return state.user;
    },
    set user(u) {
      state.user = u;
      API.session.save(null, u);
    },
  };
})();
