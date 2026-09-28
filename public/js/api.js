// Tiny wrapper around fetch() for the Smart Health Connect REST API.
// The login token is kept in localStorage and sent as "Authorization: Bearer <token>".
(function () {
  const TOKEN_KEY = 'shc.token';
  const USER_KEY = 'shc.user';

  const session = {
    get token() {
      return localStorage.getItem(TOKEN_KEY);
    },
    get user() {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY));
      } catch {
        return null;
      }
    },
    save(token, user) {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  };

  async function request(method, url, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    let res;
    try {
      res = await fetch('/api' + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error("Can't reach the server. Check that it is running (npm start) and try again.");
    }
    const data = await res.json().catch(() => null);
    if (res.status === 401 && !url.startsWith('/auth/login')) {
      session.clear();
      location.href = '/?expired=1';
      throw new Error('Please log in again');
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const qs = (params = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
    const s = p.toString();
    return s ? '?' + s : '';
  };

  window.API = {
    session,
    qs,
    get: (url, params) => request('GET', url + qs(params)),
    post: (url, body = {}) => request('POST', url, body),
    patch: (url, body = {}) => request('PATCH', url, body),
    logout() {
      session.clear();
      location.href = '/';
    },
    homeFor: (role) => ({ patient: '/patient', doctor: '/doctor', lab: '/lab', admin: '/admin' })[role] || '/',
  };
})();
