// Small shared helpers: safe HTML templating, Arabic-aware normalisation, dates.
import { lang, tr } from './i18n.js';

// ---------- HTML ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s ?? ''));

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

// Every interpolated value is escaped unless it is already Raw (i.e. built by html``).
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

// Multi-line user text → escaped HTML with <br>.
export const multiline = (s) => raw(esc(s).replace(/\n/g, '<br>'));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- normalisation ----------
const AR = '٠١٢٣٤٥٦٧٨٩';
const FA = '۰۱۲۳۴۵۶۷۸۹';
export function latinDigits(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d));
}

// File numbers: Arabic digits → Latin, no spaces, no "PAT" prefix, upper case.
export function normMrn(v) {
  return latinDigits(v).toUpperCase().replace(/\s+/g, '').replace(/^PAT[-_]?/, '').replace(/[^0-9A-Z\-\/]/g, '');
}

export function phoneDigits(v) {
  return latinDigits(v).replace(/[^\d+]/g, '');
}

// Name as stored: Latin digits, single spaces, trimmed.
export function cleanName(v) {
  return latinDigits(v).replace(/[‏‎]/g, '').replace(/\s+/g, ' ').trim();
}

// Name as compared: also folds hamza/taa marbuta/alef maqsura and strips diacritics.
export function normName(v) {
  return cleanName(v)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

export const wordCount = (s) => cleanName(s).split(' ').filter(Boolean).length;

// Strips "د." / "Dr." / "دكتور" prefixes from physician names.
export function cleanPhysician(v) {
  return cleanName(v).replace(/^(dr\.?|د\.|د |دكتور|الدكتور)\s*/i, '').trim();
}

export function matchesQuery(q, ...fields) {
  const nq = normName(q);
  if (!nq) return true;
  return fields.some((f) => normName(f).includes(nq));
}

// ---------- dates (all ISO yyyy-mm-dd, local time) ----------
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export const todayISO = () => toISO(new Date());
export const nowISO = () => new Date().toISOString();
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const weekday = (s) => parseISO(s).getDay();
export const monthKey = (s) => String(s || '').slice(0, 7);

// Next date (>= from) that falls on the given weekday (0 = Sunday).
export function nextWeekday(day, from = todayISO()) {
  let d = from;
  for (let i = 0; i < 7; i++) { if (weekday(d) === Number(day)) return d; d = addDays(d, 1); }
  return from;
}

const FORMATS = {
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  med: { weekday: 'short', day: 'numeric', month: 'short' },
  short: { day: 'numeric', month: 'short' },
  month: { month: 'long', year: 'numeric' },
  time: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
};
const fmtCache = {};
function F(kind) {
  const key = lang() + kind;
  fmtCache[key] ||= new Intl.DateTimeFormat(lang() === 'en' ? 'en-GB' : 'ar-u-nu-latn', FORMATS[kind]);
  return fmtCache[key];
}

export function fmtDate(s, style = 'short') {
  if (!isISODate(s)) return s || '';
  return F(style === 'long' ? 'long' : style === 'med' ? 'med' : 'short').format(parseISO(s));
}
export const fmtMonth = (key) => (key ? F('month').format(parseISO(key + '-01')) : '');
export function fmtTime(isoTs) {
  if (!isoTs) return '';
  const d = new Date(isoTs);
  return isNaN(d) ? '' : F('time').format(d);
}

export function plural(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}
// count(5, ['حالة واحدة', 'حالتان', 'حالات', 'حالة'], ['case', 'cases'])
export function count(n, ar, en) {
  if (lang() === 'en') return `${n} ${n === 1 ? en[0] : en[1]}`;
  return plural(n, ...ar);
}
export const daysText = (n) => count(n, ['يوم واحد', 'يومين', 'أيام', 'يوماً'], ['day', 'days']);

export function relDay(s) {
  if (!isISODate(s)) return '';
  const n = diffDays(todayISO(), s);
  if (n === 0) return tr('اليوم', 'Today');
  if (n === 1) return tr('غداً', 'Tomorrow');
  if (n === -1) return tr('أمس', 'Yesterday');
  return n < 0 ? tr(`قبل ${daysText(-n)}`, `${daysText(-n)} ago`) : tr(`بعد ${daysText(n)}`, `in ${daysText(n)}`);
}

// ---------- misc ----------
export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const uniq = (arr) => [...new Set(arr)];
export const byText = (a, b) => String(a).localeCompare(String(b), 'ar');

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function readFileAs(file, as = 'arrayBuffer') {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    if (as === 'dataURL') r.readAsDataURL(file); else r.readAsArrayBuffer(file);
  });
}

let xlsxPromise;
export function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => { xlsxPromise = null; reject(new Error(tr('تعذّر تحميل مكتبة Excel. تحقّق من الاتصال بالإنترنت.', 'Could not load the Excel library. Check your internet connection.'))); };
    document.head.append(s);
  });
  return xlsxPromise;
}
