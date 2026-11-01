// Per-device preferences (not clinical data).
const KEY = 'onco.v2.settings';

const DEFAULTS = {
  apiUrl: '',
  userName: '',
  hospital: '',
  department: 'قسم الأورام',
  logo: '',
  committeeDay: 2,      // Tuesday
  followupDays: 3,      // default due date offset for new follow-ups
  theme: 'auto',
};

let cache = null;

function load() {
  if (cache) return cache;
  try { cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { cache = { ...DEFAULTS }; }
  return cache;
}

export const settings = {
  get(k) { return load()[k]; },
  all() { return { ...load() }; },
  set(patch) {
    cache = { ...load(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
    applyTheme();
  },
};

export function applyTheme() {
  const t = settings.get('theme');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
