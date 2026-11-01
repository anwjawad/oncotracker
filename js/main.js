// App shell: routing, rendering, event delegation, global search, sync status.
import { $, $$, debounce, normMrn, matchesQuery, esc } from './util.js';
import { settings, applyTheme } from './settings.js';
import { api } from './api.js';
import { store, subscribe, loadCache, sync, flush, idx } from './store.js';
import { issues, overdueCount } from './rules.js';
import { actions, changes, hooks } from './registry.js';
import { closeMenus, toggleMenu, toast } from './ui.js';
import { renderDrawer, openPatient, drawerState, closeDrawer } from './patient.js';
import { tr, lang, applyLang } from './i18n.js';
import * as today from './views/today.js';
import * as committee from './views/committee.js';
import * as clinic from './views/clinic.js';
import * as followups from './views/followups.js';
import * as patients from './views/patients.js';
import * as quality from './views/quality.js';
import * as reports from './views/reports.js';
import * as settingsView from './views/settings.js';

const ROUTES = { today, committee, clinic, followups, patients, quality, reports, settings: settingsView };
const STABLE = new Set(['settings']);   // forms that must not be re-rendered by background changes
let current = 'today';

// ---------- rendering ----------
function render() {
  const view = ROUTES[current];
  const root = $('#view');

  // Don't wipe a field the user is in the middle of typing in.
  const ae = document.activeElement;
  if (ae && root.contains(ae) && ae.matches('input, textarea') && ae.dataset.change && ae.value !== ae.defaultValue) {
    pendingRender = true;
    return;
  }
  const key = ae?.dataset?.key;
  const sel = key && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  const scroll = window.scrollY;

  root.innerHTML = String(view.render());
  view.mount?.(root);

  if (key) {
    const el = root.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch { /* date inputs */ } }
  }
  window.scrollTo(0, scroll);
  renderChrome();
  if (drawerState.id) renderDrawer();
}
let pendingRender = false;
document.addEventListener('focusout', () => { if (pendingRender) { pendingRender = false; setTimeout(render, 0); } });

const NAV = {
  today: ['اليوم', 'Today'],
  committee: ['لجنة الحالات الجديدة', 'New cases committee'],
  clinic: ['حجوزات ما بعد العيادة', 'Post-clinic bookings'],
  followups: ['المتابعات', 'Follow-ups'],
  patients: ['المرضى', 'Patients'],
  quality: ['تصحيح البيانات', 'Data fixes'],
  reports: ['التقارير', 'Reports'],
  settings: ['الإعدادات', 'Settings'],
};

function renderChrome() {
  const view = ROUTES[current];
  const pageTitle = typeof view.title === 'function' ? view.title() : view.title;
  $('#page-title').textContent = pageTitle;
  document.title = `${pageTitle} · ${tr('منسّق الأورام', 'Onco Tracker')}`;
  $$('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === current);
    const label = a.querySelector('.label');
    if (label) label.textContent = NAV[a.dataset.route][lang() === 'en' ? 1 : 0];
  });
  $('#brand-name').textContent = tr('منسّق الأورام', 'Onco Tracker');
  $('#brand-sub').textContent = lang() === 'en' ? 'Oncology department' : settings.get('department') || 'قسم الأورام';
  $('#global-search').placeholder = tr('ابحث عن مريض بالاسم أو رقم الملف (Ctrl+K)', 'Find a patient by name or file number (Ctrl+K)');
  $('#lang-btn').textContent = lang() === 'en' ? 'ع' : 'EN';
  $('#lang-btn').title = lang() === 'en' ? 'التبديل إلى العربية' : 'Switch to English';
  const od = overdueCount();
  const high = issues().filter((i) => i.sev === 'high').length;
  $('[data-count=followups]').textContent = od || '';
  $('[data-count=quality]').textContent = high || '';
  const nextDate = committee.nextSession();
  const n = idx().lists.committee.filter((c) => c.sessionDate === nextDate).length;
  $('[data-count=committee]').textContent = n || '';
  renderBanner();
}

function renderBanner() {
  const banner = $('#mode-banner');
  if (api.mode() === 'local') {
    banner.innerHTML = tr('وضع تجريبي: البيانات محفوظة على هذا الجهاز فقط ولا تصل للفريق. <a href="#/settings">إيقافه من الإعدادات</a>.', 'Demo mode: data stays on this device and is not shared with the team. <a href="#/settings">Turn it off in Settings</a>.');
    banner.hidden = false;
  } else if (store.status.oldBackend) {
    banner.innerHTML = tr('التطبيق متصل بملف Google Sheets، لكن خادم Apps Script ما زال على النسخة القديمة، فلا تُحفظ التعديلات بعد. انشر ملف <b>backend/Code.gs</b> الجديد (الخطوات في README)، وإلى ذلك الحين استخدم <a href="backup/">النسخة القديمة</a>.', 'The app reaches the Google Sheet, but Apps Script still runs the old code, so changes are not saved yet. Deploy the new <b>backend/Code.gs</b> (steps in the README); until then use the <a href="backup/">old version</a>.');
    banner.hidden = false;
  } else banner.hidden = true;
}

function renderStatus() {
  const pill = $('#sync-pill');
  const s = store.status;
  const labels = {
    idle: tr('جاهز', 'Ready'), syncing: tr('جاري المزامنة…', 'Syncing…'), saving: tr(`جاري الحفظ (${s.pending})`, `Saving (${s.pending})`), saved: tr('كل التعديلات محفوظة', 'All changes saved'),
    error: tr(`لم يُحفظ ${s.pending} تعديل — إعادة المحاولة`, `${s.pending} not saved — retrying`), offline: tr(`بدون اتصال — ${s.pending} بالانتظار`, `Offline — ${s.pending} waiting`),
  };
  pill.dataset.state = s.state;
  pill.querySelector('.label').textContent = api.mode() === 'local' && s.state === 'saved' ? tr('محفوظ على هذا الجهاز', 'Saved on this device') : labels[s.state] || '';
  pill.title = s.error || tr('مزامنة الآن', 'Sync now');
  renderBanner();
}

const scheduleRender = debounce(render, 30);
hooks.rerender = scheduleRender;
subscribe((evt) => { renderStatus(); if (evt?.statusOnly) return; if (!STABLE.has(current)) scheduleRender(); else renderChrome(); });

function switchLanguage(next) {
  settings.set({ lang: next });
  applyLang();
  render();
  renderStatus();
}

// ---------- routing ----------
function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const name = ROUTES[path] ? path : 'today';
  const params = new URLSearchParams(query || '');
  current = name;
  ROUTES[name].onRoute?.(params);
  document.body.classList.remove('rail-open');
  closeMenus();
  render();
  $('#view').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
hooks.navigate = (r, params) => { location.hash = `#/${r}${params ? '?' + new URLSearchParams(params) : ''}`; };
window.addEventListener('hashchange', route);

// ---------- event delegation ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!e.target.closest('.menu-wrap')) closeMenus();
  if (!e.target.closest('.global-search')) $('#global-results').hidden = true;
  if (!el) return;
  const name = el.dataset.action;
  if (name === 'menu') { e.preventDefault(); toggleMenu(el); return; }
  if (name === 'toggle-rail') { document.body.classList.toggle('rail-open'); return; }
  if (name === 'sync-now') { manualSync(); return; }
  if (name === 'toggle-lang') { switchLanguage(lang() === 'en' ? 'ar' : 'en'); return; }
  const fn = actions[name];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  closeMenus();
  try {
    await fn(el, e);
  } catch (err) {
    console.error(err);
    toast(`${tr('حدث خطأ', 'Something went wrong')}: ${err.message}`, { type: 'error' });
  }
  if (!STABLE.has(current)) scheduleRender();
});

function onChange(e) {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = changes[el.dataset.change];
  if (!fn) return;
  el.defaultValue = el.value;   // committed: no longer "dirty"
  try { fn(el, e); } catch (err) { console.error(err); toast(`${tr('حدث خطأ', 'Something went wrong')}: ${err.message}`, { type: 'error' }); }
  scheduleRender();
}
document.addEventListener('change', onChange);

const inputRender = debounce(render, 180);
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  changes[el.dataset.input]?.(el, e);
  inputRender();
});

// ---------- global patient search ----------
const gInput = $('#global-search');
const gResults = $('#global-results');
let gIndex = 0;
function renderGlobal() {
  const q = gInput.value.trim();
  if (!q) { gResults.hidden = true; return; }
  const nm = normMrn(q);
  const hits = idx().lists.patients.filter((p) => (nm.length >= 3 && normMrn(p.mrn).includes(nm)) || matchesQuery(q, p.name) || (p.phone && p.phone.includes(q))).slice(0, 10);
  gIndex = 0;
  gResults.innerHTML = hits.length
    ? hits.map((p, i) => `<button type="button" class="result ${i === 0 ? 'hi' : ''}" data-gid="${esc(p.id)}"><span>${esc(p.name)}</span><span class="meta ltr">${esc(p.mrn || '—')}${p.phone ? ' · ' + esc(p.phone) : ''}</span></button>`).join('')
    : `<div class="empty" style="padding:14px">${esc(tr('لا يوجد مريض بهذا الاسم أو الرقم.', 'No patient with this name or number.'))}</div>`;
  gResults.hidden = false;
}
gInput.addEventListener('input', debounce(renderGlobal, 120));
gInput.addEventListener('focus', renderGlobal);
gInput.addEventListener('keydown', (e) => {
  const items = $$('.result', gResults);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    gIndex = (gIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1);
    items.forEach((it, i) => it.classList.toggle('hi', i === gIndex));
  } else if (e.key === 'Enter') { e.preventDefault(); items[gIndex]?.click(); }
  else if (e.key === 'Escape') { gResults.hidden = true; gInput.blur(); }
});
gResults.addEventListener('click', (e) => {
  const b = e.target.closest('[data-gid]');
  if (!b) return;
  openPatient(b.dataset.gid);
  gResults.hidden = true;
  gInput.value = '';
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); gInput.focus(); gInput.select(); }
  if (e.key === 'Escape' && drawerState.id && !document.querySelector('dialog[open]')) closeDrawer();
});

// ---------- sync ----------
async function manualSync() {
  try { await sync(); toast(tr('البيانات محدّثة', 'Up to date')); }
  catch (e) { toast(`${tr('تعذّرت المزامنة', 'Sync failed')}: ${e.message}`, { type: 'error' }); }
}
window.addEventListener('online', () => { flush(); sync().catch(() => {}); });
setInterval(() => { if (document.visibilityState === 'visible') sync().catch(() => {}); }, 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync().catch(() => {}); });
document.addEventListener('settings-changed', () => { applyLang(); if (current === 'settings') render(); else renderChrome(); renderStatus(); });
window.addEventListener('beforeunload', (e) => { if (store.status.pending) { e.preventDefault(); e.returnValue = ''; } });

// ---------- boot ----------
applyTheme();
applyLang();
const hadCache = loadCache();
route();
renderStatus();
sync().catch((e) => {
  if (!hadCache) toast(`${tr('تعذّر تحميل البيانات', 'Could not load data')}: ${e.message}`, { type: 'error' });
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
