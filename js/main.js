// App shell: routing, rendering, event delegation, global search, sync status.
import { $, $$, debounce, normMrn, matchesQuery, esc } from './util.js';
import { settings, applyTheme } from './settings.js';
import { api } from './api.js';
import { store, subscribe, loadCache, sync, flush, idx } from './store.js';
import { issues, overdueCount } from './rules.js';
import { actions, changes, hooks, ui } from './registry.js';
import { closeMenus, toggleMenu, toast } from './ui.js';
import { renderDrawer, openPatient, drawerState, closeDrawer } from './patient.js';
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

function renderChrome() {
  $('#page-title').textContent = ROUTES[current].title;
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === current));
  const od = overdueCount();
  const high = issues().filter((i) => i.sev === 'high').length;
  $('[data-count=followups]').textContent = od || '';
  $('[data-count=quality]').textContent = high || '';
  const nextDate = committee.nextSession();
  const n = idx().lists.committee.filter((c) => c.sessionDate === nextDate).length;
  $('[data-count=committee]').textContent = n || '';
  $('#brand-sub').textContent = settings.get('department') || 'قسم الأورام';
  renderBanner();
}

function renderBanner() {
  const banner = $('#mode-banner');
  if (api.mode() === 'local') {
    banner.innerHTML = 'وضع تجريبي: البيانات محفوظة على هذا الجهاز فقط ولا تصل للفريق. <a href="#/settings">إيقافه من الإعدادات</a>.';
    banner.hidden = false;
  } else if (store.status.oldBackend) {
    banner.innerHTML = 'التطبيق متصل بملف Google Sheets، لكن خادم Apps Script ما زال على النسخة القديمة، فلا تُحفظ التعديلات بعد. انشر ملف <b>backend/Code.gs</b> الجديد (الخطوات في README)، وإلى ذلك الحين استخدم <a href="backup/">النسخة القديمة</a>.';
    banner.hidden = false;
  } else banner.hidden = true;
}

function renderStatus() {
  const pill = $('#sync-pill');
  const s = store.status;
  const labels = {
    idle: 'جاهز', syncing: 'جاري المزامنة…', saving: `جاري الحفظ (${s.pending})`, saved: 'كل التعديلات محفوظة',
    error: `لم يُحفظ ${s.pending} تعديل — إعادة المحاولة`, offline: `بدون اتصال — ${s.pending} بالانتظار`,
  };
  pill.dataset.state = s.state;
  pill.querySelector('.label').textContent = api.mode() === 'local' && s.state === 'saved' ? 'محفوظ على هذا الجهاز' : labels[s.state] || '';
  pill.title = s.error || 'مزامنة الآن';
  renderBanner();
}

const scheduleRender = debounce(render, 30);
hooks.rerender = scheduleRender;
subscribe((evt) => { renderStatus(); if (evt?.statusOnly) return; if (!STABLE.has(current)) scheduleRender(); else renderChrome(); });

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
  const fn = actions[name];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  closeMenus();
  try {
    await fn(el, e);
  } catch (err) {
    console.error(err);
    toast('حدث خطأ: ' + err.message, { type: 'error' });
  }
  if (!STABLE.has(current)) scheduleRender();
});

function onChange(e) {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = changes[el.dataset.change];
  if (!fn) return;
  el.defaultValue = el.value;   // committed: no longer "dirty"
  try { fn(el, e); } catch (err) { console.error(err); toast('حدث خطأ: ' + err.message, { type: 'error' }); }
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
    : '<div class="empty" style="padding:14px">لا يوجد مريض بهذا الاسم أو الرقم.</div>';
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
  try { await sync(); toast('البيانات محدّثة'); }
  catch (e) { toast('تعذّرت المزامنة: ' + e.message, { type: 'error' }); }
}
window.addEventListener('online', () => { flush(); sync().catch(() => {}); });
setInterval(() => { if (document.visibilityState === 'visible') sync().catch(() => {}); }, 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync().catch(() => {}); });
document.addEventListener('settings-changed', () => (current === 'settings' ? render() : renderChrome()));
window.addEventListener('beforeunload', (e) => { if (store.status.pending) { e.preventDefault(); e.returnValue = ''; } });

// ---------- boot ----------
applyTheme();
const hadCache = loadCache();
route();
renderStatus();
sync().catch((e) => {
  if (!hadCache) toast('تعذّر تحميل البيانات: ' + e.message, { type: 'error' });
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
