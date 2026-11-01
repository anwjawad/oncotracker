// Per-device preferences (not clinical data).
const KEY = 'onco.v2.settings';

// The department's Apps Script deployment. Redeploying with
// "Manage deployments → Edit → New version" keeps this URL unchanged.
export const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbwSNo0whdJGYjDDcIKsq-MVVIKeG6w47E1sDnIJkE6iQmHFIq-afFuVlikwqSG6OTWxJA/exec';

export const DEFAULT_PHYSICIANS = ['Wasim', 'Bashir', 'Farah', 'Hanna', 'Amer'];

const DEFAULTS = {
  apiUrl: '',           // empty = DEFAULT_API_URL
  localMode: false,     // true = demo data on this device only, no server
  lang: 'ar',
  userName: '',
  hospital: '',
  department: 'قسم الأورام',
  logo: '',
  committeeDay: 2,      // Tuesday
  followupDays: 3,      // default due date offset for new follow-ups
  physicians: DEFAULT_PHYSICIANS,
  lastPhysician: '',    // pre-filled when adding the next patient
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
