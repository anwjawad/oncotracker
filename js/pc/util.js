// Helpers for the Port Cath module. HTML templating comes from the app's util.js
// (one Raw class for the whole page); the rest mirrors MedSched (jk) so its
// port cath rules behave the same here.
import { tr, lang } from '../i18n.js';
export { esc, raw, html, $, $$, latinDigits, phoneDigits, isISODate, todayISO, nowISO, addDays, diffDays, weekday, monthKey, uniq, debounce } from '../util.js';
import { latinDigits, isISODate, todayISO, diffDays } from '../util.js';

export const cleanText = (v) => latinDigits(v).replace(/[‏‎]/g, '').replace(/\s+/g, ' ').trim();
export const normFile = (v) => latinDigits(v).toUpperCase().replace(/\s+/g, '');

export function fold(v) {
  return cleanText(v).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
}
export function matches(q, ...fields) {
  const nq = fold(q);
  if (!nq) return true;
  return fields.some((f) => fold(f).includes(nq));
}

export function fixMojibake(s) {
  const str = String(s ?? '');
  if (!/[ÃØÙÚÛ][\u0080-ÿ]/.test(str)) return str;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array([...str].map((c) => (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63)))); } catch { return str; }
}

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

export function normDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return isNaN(v) ? '' : toISO(v);
  const s = String(v).trim();
  if (isISODate(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : toISO(d); }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? 2000 + Number(m[3]) : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const d = new Date(s);
  return isNaN(d) ? '' : toISO(d);
}

// Screen dates follow the interface language; `full` (dd/mm/yyyy) and printed forms stay English.
const FORMATS = {
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  med: { weekday: 'short', day: 'numeric', month: 'short' },
  short: { day: 'numeric', month: 'short' },
  full: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dayName: { weekday: 'long' },
  month: { month: 'long', year: 'numeric' },
  time: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
};
const cache = {};
const F = (kind, en = false) => {
  const loc = en || lang() === 'en' || kind === 'full' ? 'en-GB' : 'ar-u-nu-latn';
  return (cache[loc + kind] ||= new Intl.DateTimeFormat(loc, FORMATS[kind]));
};
export const fmtDate = (s, style = 'short') => (isISODate(s) ? F(style).format(parseISO(s)) : s || '');
export const fmtDateEn = (s, style = 'short') => (isISODate(s) ? F(style, true).format(parseISO(s)) : s || '');
export const fmtMonth = (key) => (key ? F('month').format(parseISO(key + '-01')) : '');
export const fmtMonthEn = (key) => (key ? F('month', true).format(parseISO(key + '-01')) : '');
export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' || /^\d+$/.test(ts) ? Number(ts) : ts);
  return isNaN(d) ? '' : F('time').format(d);
}
// Stored in the sheet's "day" column: always English, as MedSched writes it.
export const dayName = (s) => (isISODate(s) ? F('dayName', true).format(parseISO(s)) : '');
export const dayNameUI = (s) => (isISODate(s) ? F('dayName').format(parseISO(s)) : '');

export function relDay(s) {
  if (!isISODate(s)) return '';
  const n = diffDays(todayISO(), s);
  if (n === 0) return tr('اليوم', 'Today');
  if (n === 1) return tr('غداً', 'Tomorrow');
  if (n === -1) return tr('أمس', 'Yesterday');
  return n < 0 ? tr(`قبل ${-n} يوم`, `${-n} days ago`) : tr(`بعد ${n} يوم`, `in ${n} days`);
}

// "3 patients" / "3 مرضى"
export const nPatients = (n) => tr(`${n} ${n === 1 ? 'مريض' : n === 2 ? 'مريضان' : n <= 10 ? 'مرضى' : 'مريضاً'}`, `${n} patient${n === 1 ? '' : 's'}`);
export const nDays = (n) => tr(`${n} ${n === 1 ? 'يوم' : n <= 10 ? 'أيام' : 'يوماً'}`, `${n} day${n === 1 ? '' : 's'}`);

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const byText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'en', { sensitivity: 'base' });

export function downloadFile(name, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
