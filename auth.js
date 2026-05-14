// OutbreakOS — Browser Auth Service
// bcryptjs (rounds=8) + localStorage. No server required.
// Demo credentials: demo@outbreakos.dev / demo1234

(function () {
  const bc      = (window.dcodeIO && window.dcodeIO.bcrypt) || window.bcrypt;
  const ROUNDS  = 8;
  const USERS   = 'obs_users_v1';
  const SESSION = 'obs_session_v1';
  const SKEY    = 'obs_settings_v1';

  /* ---------- storage helpers ---------- */
  function getUsers()      { try { return JSON.parse(localStorage.getItem(USERS) || '[]'); } catch { return []; } }
  function setUsers(u)     { localStorage.setItem(USERS, JSON.stringify(u)); }
  function genId()         { return 'usr_' + Math.random().toString(36).slice(2, 11); }
  function genToken(uid)   { return btoa(JSON.stringify({ uid, exp: Date.now() + 7 * 864e5 })); }
  function parseToken(tok) { try { return JSON.parse(atob(tok)); } catch { return null; } }

  /* ---------- init — seed demo account ---------- */
  function init() {
    const users = getUsers();
    if (!users.find(u => u.email === 'demo@outbreakos.dev')) {
      const hash = bc.hashSync('demo1234', ROUNDS);
      users.push({
        id: 'usr_demo',
        name: 'Demo Analyst',
        email: 'demo@outbreakos.dev',
        org: 'OutbreakOS Demo',
        role: 'Watch officer',
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      });
      setUsers(users);
    }
  }

  /* ---------- signup ---------- */
  async function signup(name, email, password) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const hash = await new Promise((res, rej) => {
      try { res(bc.hashSync(password, ROUNDS)); } catch (e) { rej(e); }
    });
    const user = {
      id: genId(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      org: '',
      role: 'Analyst',
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    setUsers(users);
    const token = genToken(user.id);
    localStorage.setItem(SESSION, JSON.stringify({ token, uid: user.id }));
    return publicUser(user);
  }

  /* ---------- login ---------- */
  async function login(email, password, remember) {
    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) throw new Error('No account found with this email.');
    const valid = await new Promise((res, rej) => {
      try { res(bc.compareSync(password, user.passwordHash)); } catch (e) { rej(e); }
    });
    if (!valid) throw new Error('Incorrect password. Try again.');
    const token = genToken(user.id);
    localStorage.setItem(SESSION, JSON.stringify({ token, uid: user.id, remember }));
    return publicUser(user);
  }

  /* ---------- logout ---------- */
  function logout() {
    localStorage.removeItem(SESSION);
  }

  /* ---------- session ---------- */
  function getSession() {
    try {
      const raw  = localStorage.getItem(SESSION);
      if (!raw) return null;
      const { token } = JSON.parse(raw);
      const parsed = parseToken(token);
      if (!parsed || parsed.exp < Date.now()) { localStorage.removeItem(SESSION); return null; }
      return parsed;
    } catch { return null; }
  }

  /* ---------- current user ---------- */
  function getUser() {
    const s = getSession();
    if (!s) return null;
    const u = getUsers().find(u => u.id === s.uid);
    return u ? publicUser(u) : null;
  }

  /* ---------- update profile ---------- */
  function updateUser(fields) {
    const s = getSession();
    if (!s) return;
    const users = getUsers();
    const i = users.findIndex(u => u.id === s.uid);
    if (i === -1) return;
    users[i] = { ...users[i], ...fields };
    setUsers(users);
    return publicUser(users[i]);
  }

  /* ---------- settings ---------- */
  function defaultSettings() {
    return {
      themeMode:        'dark',
      compactMode:      false,
      mapStyle:         'carto_dark',
      mapProvider:      'carto_dark',
      refreshInterval:  30,
      notifications:    { alerts: true, digest: false, pheic: true },
      sourcePriority:   ['WHO', 'CDC', 'ECDC', 'PAHO', 'ProMED'],
    };
  }
  function getSettings() {
    const s = getSession();
    const key = s ? `${SKEY}_${s.uid}` : SKEY;
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...defaultSettings(), ...JSON.parse(raw) } : defaultSettings();
    } catch { return defaultSettings(); }
  }
  function saveSettings(settings) {
    const s = getSession();
    const key = s ? `${SKEY}_${s.uid}` : SKEY;
    localStorage.setItem(key, JSON.stringify(settings));
  }

  /* ---------- helpers ---------- */
  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, org: u.org, role: u.role };
  }

  /* ---------- health mock ---------- */
  function health() {
    const authed = !!getSession();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      auth: authed ? 'authenticated' : 'unauthenticated',
      dataPipeline: 'operational',
      vectorStore: 'mock',
    };
  }

  window.ObsAuth = { init, signup, login, logout, getSession, getUser, updateUser, getSettings, saveSettings, health };
})();
