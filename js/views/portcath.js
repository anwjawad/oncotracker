// Port Cath: session calendar, day list, waiting list, outcomes, register, history,
// printing and the CVAD checklist. The same list as MedSched (jk): data is read from and
// saved to MedSched's sheet through js/pc/. New bookings can start from a patient
// already in OncoTracker, so name, file number, phone and diagnosis are filled in.
import { html, esc, $, $$, todayISO, addDays, fmtDate, fmtDateEn, fmtMonth, fmtMonthEn, monthKey, addMonths, parseISO, toISO, relDay, matches, byText, fmtTime, cleanText, downloadFile, nPatients, nDays } from '../pc/util.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { get, remove, restore, upsert, batch, store as pcStore, sync as pcSync } from '../pc/store.js';
import { lists, pc, pcStatus, isBooked, hasAppt, patientsOn, isSessionDay, sessionDaysInMonth, upcomingSessions, setSessionDay, historyOf, HISTORY_LABEL, samePatient } from '../pc/model.js';
import { icon, prevIcon, nextIcon, chip, empty, telLinks, datalist } from '../pc/ui.js';
import { printDialog } from '../pc/print.js';
import { printChecklists } from '../pc/checklist.js';
import { api as pcApi } from '../pc/api.js';
import { modal, confirmBox, toast, menu, patientPickerHTML, mountPatientPicker } from '../ui.js';
import { idx } from '../store.js';
import { normMrn } from '../util.js';
import { tr } from '../i18n.js';

export const title = () => 'Port Cath';

Object.assign(ui, { pcTab: ui.pcTab || 'schedule', pcMonth: ui.pcMonth || '', pcDay: ui.pcDay || '', pcQuery: '', pcStatus: 'all' });

let focusId = '';
export function onRoute(params) {
  if (!ui.pcMonth) ui.pcMonth = monthKey(todayISO());
  if (!ui.pcDay) ui.pcDay = upcomingSessions(todayISO(), 1)[0] || todayISO();
  if (params.get('tab')) ui.pcTab = params.get('tab');
  if (params.get('day')) { ui.pcDay = params.get('day'); ui.pcMonth = monthKey(ui.pcDay); ui.pcTab = 'schedule'; }
  const id = params.get('focus');
  if (id) {
    const p = get('portcath', id);
    if (p) {
      focusId = id;
      if (lists().waiting.includes(p)) ui.pcTab = 'waiting';
      else if (p.date) { ui.pcTab = 'schedule'; ui.pcDay = p.date; ui.pcMonth = monthKey(p.date); }
    }
  }
  const book = params.get('book');
  if (book) setTimeout(() => editPatient(null, '', book), 0);
}

export function mount(root) {
  if (!focusId) return;
  const row = root.querySelector(`[data-row="${CSS.escape(focusId)}"]`);
  focusId = '';
  if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('flash'); }
}

// Shown in the nav: bookings whose outcome is missing.
export const navCount = () => (pcStore.loaded ? lists().awaiting.length : 0);

// ---------- render ----------
export function render() {
  if (!pcStore.loaded) {
    const err = pcStore.status.error;
    return html`<div class="pcv"><section class="panel">${empty(err ? tr('تعذّر الوصول إلى قائمة Port Cath', 'Could not reach the Port Cath list') : tr('جاري تحميل قائمة Port Cath…', 'Loading the Port Cath list…'),
      err ? html`${err} <br>${tr('القائمة محفوظة في ملف MedSched، وسيُعاد المحاولة تلقائياً.', 'The list lives in MedSched’s sheet; the app will try again.')}` : tr('نفس القائمة الموجودة في تطبيق MedSched.', 'The same list as in MedSched.'),
      err ? html`<button type="button" class="btn btn-sm" data-action="pc-retry">${tr('أعد المحاولة', 'Try again')}</button>` : '')}</section></div>`;
  }
  const L = lists();
  const tabs = [
    ['schedule', tr('الجدول', 'Schedule'), ''],
    ['awaiting', tr('بانتظار النتيجة', 'Awaiting outcome'), L.awaiting.length, 'warn'],
    ['waiting', tr('قائمة الانتظار', 'Waiting list'), L.waiting.length],
    ['register', tr('السجل', 'Register'), ''],
  ];
  const body = { schedule: renderSchedule, awaiting: renderAwaiting, waiting: renderWaiting, register: renderRegister }[ui.pcTab] || renderSchedule;
  const st = pcStore.status;
  return html`
    <div class="pcv">
      <p class="pc-source muted small">${icon('port', 14)} ${tr('مشتركة مع تطبيق MedSched: أي تعديل هنا يظهر هناك والعكس.', 'Shared with MedSched: changes here show there, and the other way round.')}
        ${st.state === 'error' || st.state === 'offline' ? html`<span class="warn-text">${tr(`لم يُحفظ ${st.pending} تعديل بعد — إعادة المحاولة تلقائياً`, `${st.pending} not saved yet — retrying`)}</span>` : st.pending ? html`<span>${tr(`جاري الحفظ (${st.pending})`, `Saving (${st.pending})`)}</span>` : ''}</p>
      ${kpis()}
      <div class="toolbar">
        <div class="tabs" role="tablist">
          ${tabs.map(([k, label, n, tone]) => html`<button type="button" class="tab ${ui.pcTab === k ? 'active' : ''}" role="tab" aria-selected="${String(ui.pcTab === k)}" data-action="pc-tab" data-tab="${k}">${label}${n !== '' && n !== undefined ? html`<span class="n ${n && tone ? tone : ''}">${n}</span>` : ''}</button>`)}
        </div>
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="pc-sessions">${icon('calCheck', 17)} ${tr('أيام الجلسات', 'Session days')}</button>
        <button type="button" class="btn" data-action="pc-print">${icon('print', 17)} ${tr('طباعة / تصدير', 'Print / Export')}</button>
        <button type="button" class="btn btn-primary" data-action="pc-add">${icon('plus', 17)} ${tr('إضافة مريض', 'Add patient')}</button>
      </div>
      ${body()}
    </div>`;
}

function kpis() {
  const L = lists();
  const key = ui.pcMonth;
  const inMonth = L.portcath.filter((p) => p.date && monthKey(p.date) === key);
  const booked = inMonth.filter(isBooked).length;
  const cancelled = inMonth.filter((p) => p.status === 'cancelled').length;
  const from = addDays(L.today, -30);
  const recent = L.portcath.filter((p) => p.date && p.date >= from && p.date <= L.today);
  const done = recent.filter((p) => p.status === 'done').length;
  const pastOpen = recent.filter((p) => isBooked(p) && p.date < L.today).length;
  const rate = done + pastOpen ? Math.round((done / (done + pastOpen)) * 100) : null;
  const days = sessionDaysInMonth(key).length;
  return html`
    <div class="kpis">
      <div class="kpi"><span class="k-label">${icon('calendar', 15)} ${tr('أيام الجلسات', 'Session days')} · ${fmtMonth(key)}</span><b>${days}</b><small>${nPatients(inMonth.length - cancelled)} ${tr('مجدولون', 'scheduled')}</small></div>
      <div class="kpi"><span class="k-label">${icon('clock', 15)} ${tr('محجوز ولم يُركّب بعد', 'Booked, not yet done')}</span><b>${booked}</b><small>${tr('هذا الشهر', 'this month')}</small></div>
      <div class="kpi good"><span class="k-label">${icon('checkCircle', 15)} ${tr('تم التركيب · آخر 30 يوم', 'Port done · last 30 days')}</span><b>${done}</b>
        <small>${rate === null ? tr('لا جلسات في آخر 30 يوم', 'no sessions in the last 30 days') : tr(`${rate}% من الحجوزات تم تأكيدها`, `${rate}% of bookings confirmed done`)}</small>
        ${rate !== null ? html`<div class="meter" aria-hidden="true"><span style="width:${rate}%;background:var(--green)"></span></div>` : ''}</div>
      <button type="button" class="kpi ${L.awaiting.length ? 'alert' : ''}" data-action="pc-tab" data-tab="awaiting"><span class="k-label">${icon('alert', 15)} ${tr('بانتظار النتيجة', 'Awaiting outcome')}</span><b>${L.awaiting.length}</b><small>${L.awaiting.length ? tr('أكّد: تم التركيب أم لا', 'confirm port done or not') : tr('لا شيء معلّق', 'nothing pending')}</small></button>
      <button type="button" class="kpi" data-action="pc-tab" data-tab="waiting"><span class="k-label">${icon('users', 15)} ${tr('قائمة الانتظار', 'Waiting list')}</span><b>${L.waiting.length}</b><small>${L.waiting.length ? `${tr('الأقدم', 'oldest')} ${relDay(String(L.waiting[0].createdAt || '').slice(0, 10)) || '—'}` : tr('فارغة', 'empty')}</small></button>
    </div>`;
}

// ----- schedule: calendar + day -----
function renderSchedule() {
  return html`
    <div class="split">
      <section class="panel sticky" aria-label="${tr('التقويم', 'Month calendar')}">${monthCalendar(ui.pcMonth, ui.pcDay)}</section>
      <section class="panel" aria-label="${tr('اليوم المختار', 'Selected day')}">${dayPanel(ui.pcDay)}</section>
    </div>`;
}

const DOW = () => tr('ح ن ث ر خ ج س', 'Sun Mon Tue Wed Thu Fri Sat').split(' ');

function monthCalendar(key, selected) {
  const L = lists();
  const first = parseISO(key + '-01');
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(html`<span class="day out" aria-hidden="true"></span>`);
  for (let d = 1; d <= daysIn; d++) {
    const date = `${key}-${String(d).padStart(2, '0')}`;
    const pts = (L.pcByDate.get(date) || []).filter((p) => p.status !== 'cancelled');
    const cfg = L.sessionsByDate.get(date);
    const session = isSessionDay(date);
    const off = cfg && !cfg.isActive;
    const open = pts.some((p) => isBooked(p) && date < L.today);
    const done = pts.filter((p) => p.status === 'done').length;
    const cls = [date === L.today && 'today', date < L.today && 'past', session && 'session', off && 'off', date === selected && 'selected'].filter(Boolean).join(' ');
    cells.push(html`<button type="button" class="day ${cls}" data-action="pc-day" data-date="${date}" aria-label="${fmtDate(date, 'long')}, ${nPatients(pts.length)}" aria-pressed="${String(date === selected)}">
      <span class="dn">${d}</span>
      ${pts.length ? html`<span class="cnt">${pts.length}</span>` : ''}
      ${done ? html`<span class="dots"><i style="background:var(--green)"></i></span>` : ''}
      ${open ? html`<span class="flag" title="${tr('النتيجة غير مسجلة', 'Outcome missing')}"></span>` : ''}
    </button>`);
  }
  return html`
    <div class="cal-head">
      <button type="button" class="icon-btn" data-action="pc-month" data-to="${addMonths(key, -1)}" aria-label="${tr('الشهر السابق', 'Previous month')}">${prevIcon()}</button>
      <h3>${fmtMonth(key)}</h3>
      <button type="button" class="icon-btn" data-action="pc-month" data-to="${addMonths(key, 1)}" aria-label="${tr('الشهر التالي', 'Next month')}">${nextIcon()}</button>
    </div>
    <div class="cal">${DOW().map((d) => html`<span class="dow">${d}</span>`)}${cells}</div>
    <div class="cal-legend">
      <span><i style="background:var(--accent-soft);border:1px solid var(--accent)"></i>${tr('يوم جلسة', 'Session day')}</span>
      <span><i style="background:var(--green)"></i>${tr('فيه تركيب', 'Has port done')}</span>
      <span><i style="background:var(--amber);border-radius:50%"></i>${tr('نتيجة ناقصة', 'Outcome missing')}</span>
    </div>`;
}

function dayPanel(date) {
  const L = lists();
  const pts = patientsOn(date);
  const active = pts.filter((p) => p.status !== 'cancelled');
  const withAppt = pts.filter(hasAppt);
  const done = pts.filter((p) => p.status === 'done').length;
  const open = pts.filter(isBooked);
  const session = isSessionDay(date);
  const cfg = L.sessionsByDate.get(date);
  const canConfirm = date <= L.today && open.length > 0;
  return html`
    <div class="panel-head">
      <div>
        <h2>${fmtDate(date, 'long')} <span class="muted small">${relDay(date)}</span></h2>
        <div class="row" style="margin-top:6px">
          ${session ? chip(tr('يوم جلسة', 'Session day'), 'brand') : cfg && !cfg.isActive ? chip(tr('الجلسة ملغاة', 'Session cancelled'), 'red') : chip(tr('ليس يوم جلسة', 'Not a session day'), 'outline')}
          ${chip(tr(`${active.length} مجدول`, `${active.length} scheduled`), 'blue')}
          ${done ? chip(tr(`${done} تم التركيب`, `${done} port done`), 'green') : ''}
          ${open.length && date < L.today ? chip(tr(`${open.length} بانتظار النتيجة`, `${open.length} awaiting outcome`), 'amber') : ''}
        </div>
      </div>
      <div class="row">
        ${canConfirm && open.length > 1 ? html`<button type="button" class="btn btn-sm btn-done" data-action="pc-all-done" data-date="${date}">${icon('check', 15)} ${tr(`الكل تم (${open.length})`, `All ${open.length} done`)}</button>` : ''}
        <button type="button" class="btn btn-sm" data-action="pc-print-day" data-date="${date}">${icon('print', 15)} ${tr('طباعة', 'Print')}</button>
        ${withAppt.length ? html`<button type="button" class="btn btn-sm" data-action="pc-checklist-day" data-date="${date}">${icon('print', 15)} Print checklist (${withAppt.length})</button>` : ''}
        <button type="button" class="btn btn-sm btn-primary" data-action="pc-add" data-date="${date}">${icon('plus', 15)} ${tr('إضافة', 'Add')}</button>
        ${menu(html`
          <button type="button" data-action="pc-toggle-session" data-date="${date}">${icon('calCheck', 16)} ${session ? tr('إلغاء يوم الجلسة هذا', 'Cancel this session day') : tr('اجعله يوم جلسة', 'Make this a session day')}</button>
          <button type="button" data-action="pc-print-day" data-date="${date}">${icon('word', 16)} ${tr('تصدير اليوم إلى Word', 'Export day to Word')}</button>`)}
      </div>
    </div>
    ${pts.length
      ? html`<ul class="pt-list">${pts.map((p) => ptRow(p))}</ul>`
      : empty(tr('لا يوجد مرضى في هذا اليوم', 'No patients on this day'), session ? tr('أضف مريضاً أو احجز لأحد من قائمة الانتظار.', 'Add a patient or assign someone from the waiting list.') : tr('اختر يوم جلسة من التقويم، أو أضف مريضاً هنا.', 'Pick a highlighted session day on the calendar, or add a patient here.'), html`<button type="button" class="btn btn-sm" data-action="pc-tab" data-tab="waiting">${tr('فتح قائمة الانتظار', 'Open waiting list')}</button>`)}
    ${historyFor(date)}`;
}

function historyFor(date) {
  const items = lists().history.filter((h) => h.fromDate === date || h.toDate === date).slice(0, 10);
  if (!items.length) return '';
  return html`
    <details class="panel-foot" style="display:block">
      <summary class="small muted" style="cursor:pointer;font-weight:650">${tr('حركة هذا اليوم', 'Activity on this day')} (${items.length})</summary>
      <ul class="timeline" style="margin-top:8px">${items.map(historyItem)}</ul>
    </details>`;
}

function historyItem(h) {
  const label = HISTORY_LABEL[h.action] ? tr(...HISTORY_LABEL[h.action]) : h.action;
  const dates = h.action === 'move' ? `${h.fromDate ? fmtDate(h.fromDate, 'short') : tr('قائمة الانتظار', 'waiting list')} → ${h.toDate ? fmtDate(h.toDate, 'short') : tr('قائمة الانتظار', 'waiting list')}` : '';
  return html`<li><span class="when">${fmtTime(h.timestamp)}</span><span><b>${label}</b> · ${h.patientName}${dates ? html` <span class="muted">${dates}</span>` : ''}${h.reason ? html`<br><span class="muted">${h.reason}</span>` : ''}${h.preparedBy ? html` <span class="muted small">— ${h.preparedBy}</span>` : ''}</span></li>`;
}

const initials = (name) => cleanText(name).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

// The OncoTracker patient with this file number, to open their record.
const oncoPatient = (p) => { const m = normMrn(p.fileNumber); return m ? idx().byMrn.get(m)?.[0] : null; };

function ptRow(p, { showDate = false } = {}) {
  const L = lists();
  const st = pcStatus(p);
  const past = p.date && p.date <= L.today;
  const actions = [];
  if (isBooked(p) && past) {
    actions.push(html`<button type="button" class="btn btn-sm btn-done" data-action="pc-done" data-id="${p.id}">${icon('check', 15)} ${tr('تم التركيب', 'Port done')}</button>`);
    actions.push(html`<button type="button" class="btn btn-sm btn-notdone" data-action="pc-notdone" data-id="${p.id}">${icon('x', 15)} ${tr('لم يتم', 'Not done')}</button>`);
  } else if (p.status === 'waiting' || !p.date) {
    actions.push(html`<button type="button" class="btn btn-sm btn-primary" data-action="pc-assign" data-id="${p.id}">${icon('calendar', 15)} ${tr('حدّد موعداً', 'Assign date')}</button>`);
  } else if (p.status === 'done') {
    actions.push(html`<span class="outcome ok">${icon('checkCircle', 16)} ${tr('تم التركيب', 'Port done')}${p.doneAt && p.doneAt !== p.date ? ` · ${fmtDate(p.doneAt)}` : ''}</span>`);
  } else if (p.status === 'cancelled') {
    actions.push(chip(tr('ملغى', 'Cancelled'), ''));
  } else if (isBooked(p)) {
    actions.push(html`<button type="button" class="btn btn-sm btn-ghost" data-action="pc-move" data-id="${p.id}">${icon('forward', 15)} ${tr('نقل', 'Move')}</button>`);
  }
  if (hasAppt(p)) actions.push(html`<button type="button" class="btn btn-sm btn-ghost" data-action="pc-checklist" data-id="${p.id}" title="${tr('طباعة CVAD checklist', 'Print the CVAD checklist')}">${icon('print', 15)} Print checklist</button>`);
  const onco = oncoPatient(p);
  const more = [];
  more.push(html`<button type="button" data-action="pc-edit" data-id="${p.id}">${icon('edit', 16)} ${tr('تعديل البيانات', 'Edit details')}</button>`);
  if (onco) more.push(html`<button type="button" data-action="pc-open-patient" data-pid="${onco.id}">${icon('user', 16)} ${tr('ملف المريض', 'Patient record')}</button>`);
  if (isBooked(p)) {
    more.push(html`<button type="button" data-action="pc-move" data-id="${p.id}">${icon('forward', 16)} ${tr('نقل ليوم آخر', 'Move to another day')}</button>`);
    more.push(html`<button type="button" data-action="pc-to-waiting" data-id="${p.id}">${icon('users', 16)} ${tr('إرجاع لقائمة الانتظار', 'Back to waiting list')}</button>`);
    if (!past) more.push(html`<button type="button" data-action="pc-done" data-id="${p.id}">${icon('check', 16)} ${tr('تم التركيب', 'Mark port done')}</button>`);
  }
  if (p.status === 'done') more.push(html`<button type="button" data-action="pc-undo-done" data-id="${p.id}">${icon('undo', 16)} ${tr('إزالة «تم التركيب»', 'Remove “port done”')}</button>`);
  if (p.status !== 'cancelled' && p.status !== 'done') more.push(html`<button type="button" data-action="pc-cancel" data-id="${p.id}">${icon('xCircle', 16)} ${tr('إلغاء الحجز', 'Cancel')}</button>`);
  if (p.status === 'cancelled') more.push(html`<button type="button" data-action="pc-restore" data-id="${p.id}">${icon('undo', 16)} ${tr('استعادة', 'Restore')}</button>`);
  more.push(html`<button type="button" data-action="pc-history" data-id="${p.id}">${icon('history', 16)} ${tr('السجل', 'History')}</button>`);
  more.push(html`<button type="button" class="danger" data-action="pc-delete" data-id="${p.id}">${icon('trash', 16)} ${tr('حذف السجل', 'Delete record')}</button>`);
  return html`
    <li class="pt" data-row="${p.id}" data-status="${p.status === 'scheduled' ? 'confirmed' : p.status}">
      <span class="av" aria-hidden="true">${p.status === 'done' ? icon('check', 17) : initials(p.name)}</span>
      <div style="min-width:0">
        <div class="nm"><button type="button" data-action="pc-edit" data-id="${p.id}">${p.name || tr('بدون اسم', 'Unnamed')}</button>${st.tone !== 'blue' || showDate ? chip(st.label, st.tone) : ''}${showDate && p.date ? html`<span class="muted small">${fmtDate(p.date, 'med')}</span>` : ''}</div>
        <div class="facts">
          <span>${tr('ملف', 'File')} <b class="ltr">${p.fileNumber || '—'}</b></span>
          ${p.weight ? html`<span><b>${p.weight}</b> kg</span>` : html`<span class="warn-text">${tr('بدون وزن', 'No weight')}</span>`}
          ${p.phone ? telLinks(p.phone) : ''}
          ${p.nextChemoAppt ? html`<span>${tr('الكيماوي القادم', 'Next chemo')} <b>${fmtDate(p.nextChemoAppt, 'med')}</b></span>` : ''}
          ${p.diagnosis ? html`<span>Dx <b>${p.diagnosis}</b></span>` : ''}
          ${p.source ? html`<span>${tr('المصدر', 'Source')} <b>${p.source}</b></span>` : ''}
        </div>
        ${p.notes ? html`<div class="note" dir="auto">${p.notes}</div>` : ''}
        ${p.outcomeNote ? html`<div class="note" dir="auto">${p.outcomeNote}</div>` : ''}
      </div>
      <div class="acts">${actions}${menu(more)}</div>
    </li>`;
}

// ----- awaiting outcome -----
function renderAwaiting() {
  const L = lists();
  if (!L.awaiting.length) return html`<section class="panel">${empty(tr('كل الحجوزات السابقة لها نتيجة', 'Every past booking has an outcome'), tr('بعد كل جلسة يظهر المرضى هنا إلى أن تحدد «تم التركيب» أو «لم يتم».', 'After each session, patients appear here until you mark them “Port done” or “Not done”.'))}</section>`;
  const byDate = new Map();
  for (const p of L.awaiting) { if (!byDate.has(p.date)) byDate.set(p.date, []); byDate.get(p.date).push(p); }
  return html`
    <section class="panel">
      <div class="panel-head"><div><h2>${icon('alert', 18)} ${tr('بانتظار النتيجة', 'Awaiting outcome')}</h2><p>${tr('ليس كل محجوز يُركّب له البورت. أكّد كل مريض حتى تبقى القوائم والإحصاءات صحيحة.', 'Not every booked patient ends up getting the port. Confirm each one so the lists and statistics stay true.')}</p></div></div>
      ${[...byDate].map(([date, pts]) => html`
        <div class="group-h"><span>${fmtDate(date, 'long')} · ${relDay(date)} · ${nPatients(pts.length)}</span>
          ${pts.length > 1 ? html`<button type="button" class="btn btn-sm btn-done" data-action="pc-all-done" data-date="${date}">${icon('check', 15)} ${tr('الكل تم', 'All done')}</button>` : ''}</div>
        <ul class="pt-list">${pts.map((p) => ptRow(p))}</ul>`)}
    </section>`;
}

// ----- waiting list -----
function renderWaiting() {
  const L = lists();
  const q = ui.pcQuery;
  const rows = L.waiting.filter((p) => matches(q, p.name, p.fileNumber, p.phone, p.diagnosis, p.notes));
  const next = upcomingSessions(todayISO(), 1)[0];
  return html`
    <section class="panel">
      <div class="panel-head">
        <div><h2>${icon('users', 18)} ${tr('قائمة الانتظار', 'Waiting list')}</h2><p>${tr('مرضى يحتاجون البورت وليس لهم موعد بعد، الأقدم أولاً.', 'Patients who need a port but have no date yet, oldest first.')}${next ? ` ${tr('الجلسة القادمة', 'Next session')}: ${fmtDate(next, 'med')}.` : ''}</p></div>
        <div class="row">
          <label class="search-box"><span class="sr-only">${tr('بحث', 'Search')}</span>${icon('search', 16)}<input class="input" type="search" value="${q}" data-input="pc-query" data-key="pc-q" placeholder="${tr('بحث…', 'Search…')}" autocomplete="off"></label>
          <button type="button" class="btn btn-sm" data-action="pc-print-waiting">${icon('print', 15)} ${tr('طباعة', 'Print')}</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="pc-add" data-date="waiting">${icon('plus', 15)} ${tr('إضافة لقائمة الانتظار', 'Add to waiting list')}</button>
        </div>
      </div>
      ${rows.length ? html`<ul class="pt-list">${rows.map((p) => ptRow(p))}</ul>` : empty(q ? tr('لا نتائج', 'No match') : tr('لا أحد في الانتظار', 'Nobody is waiting'), q ? tr('جرّب اسماً أو رقم ملف آخر.', 'Try another name or file number.') : tr('المرضى الذين تضيفهم بدون موعد يظهرون هنا.', 'Patients you add without a date appear here.'))}
    </section>`;
}

// ----- register -----
const REG_FILTERS = () => [['all', tr('الكل', 'All')], ['booked', tr('محجوز', 'Booked')], ['done', tr('تم التركيب', 'Port done')], ['waiting', tr('انتظار', 'Waiting')], ['cancelled', tr('ملغى', 'Cancelled')]];
function regRows() {
  const L = lists();
  const f = ui.pcStatus;
  return L.portcath
    .filter((p) => f === 'all' || (f === 'booked' ? isBooked(p) : f === 'waiting' ? L.waiting.includes(p) : p.status === f))
    .filter((p) => matches(ui.pcQuery, p.name, p.fileNumber, p.phone, p.diagnosis, p.notes))
    .sort((a, b) => String(b.date || '9999').localeCompare(String(a.date || '9999')) || byText(a.name, b.name));
}
function renderRegister() {
  const rows = regRows();
  const shown = rows.slice(0, 300);
  return html`
    <section class="panel">
      <div class="panel-head">
        <div class="pills" role="group">${REG_FILTERS().map(([k, l]) => html`<button type="button" class="pill ${ui.pcStatus === k ? 'active' : ''}" aria-pressed="${String(ui.pcStatus === k)}" data-action="pc-filter" data-f="${k}">${l}</button>`)}</div>
        <div class="row">
          <label class="search-box"><span class="sr-only">${tr('بحث', 'Search')}</span>${icon('search', 16)}<input class="input" type="search" value="${ui.pcQuery}" data-input="pc-query" data-key="pc-q2" placeholder="${tr('اسم، ملف، هاتف، تشخيص…', 'Name, file, phone, diagnosis…')}" autocomplete="off"></label>
          <button type="button" class="btn btn-sm" data-action="pc-csv">${icon('download', 15)} CSV</button>
        </div>
      </div>
      ${rows.length ? html`
        <div class="table-wrap"><table class="data">
          <thead><tr><th>${tr('المريض', 'Patient')}</th><th>${tr('الحالة', 'Status')}</th><th>${tr('الموعد', 'Date')}</th><th>${tr('الوزن', 'Weight')}</th><th>${tr('الهاتف', 'Phone')}</th><th>${tr('الكيماوي القادم', 'Next chemo')}</th><th>${tr('التشخيص', 'Diagnosis')}</th><th>${tr('المصدر', 'Source')}</th><th>${tr('ملاحظات', 'Notes')}</th><th><span class="sr-only">${tr('إجراءات', 'Actions')}</span></th></tr></thead>
          <tbody>${shown.map((p) => { const st = pcStatus(p); return html`<tr data-row="${p.id}">
            <td><button type="button" class="name-btn" data-action="pc-edit" data-id="${p.id}">${p.name}</button><div class="file ltr">${p.fileNumber}</div></td>
            <td>${chip(st.label, st.tone)}</td>
            <td class="nowrap">${p.date ? fmtDate(p.date, 'med') : '—'}</td>
            <td>${p.weight || '—'}</td>
            <td class="nowrap">${p.phone ? telLinks(p.phone) : '—'}</td>
            <td class="nowrap">${p.nextChemoAppt ? fmtDate(p.nextChemoAppt) : '—'}</td>
            <td>${p.diagnosis || '—'}</td>
            <td>${p.source || '—'}</td>
            <td dir="auto" style="max-width:260px">${p.notes}</td>
            <td><button type="button" class="icon-btn" data-action="pc-history" data-id="${p.id}" aria-label="${tr('السجل', 'History')}">${icon('history', 16)}</button></td>
          </tr>`; })}</tbody>
        </table></div>
        ${rows.length > shown.length ? html`<div class="panel-foot muted small">${tr(`يظهر 300 من ${rows.length}. ضيّق البحث لرؤية الباقي.`, `Showing 300 of ${rows.length}. Narrow the search to see the rest.`)}</div>` : ''}`
      : empty(tr('لا سجلات مطابقة', 'No records match'), tr('غيّر التصفية أو البحث.', 'Change the filter or the search.'))}
    </section>`;
}

// ---------- dialogs ----------
const sub = (text) => (text ? html`<p class="muted small" style="margin:-4px 0 0">${text}</p>` : '');

function dateChooser({ value = '', allowWaiting = false, from = todayISO(), exclude = '' } = {}) {
  const days = upcomingSessions(from, 10).filter((d) => d !== exclude);
  const isCustom = value && value !== 'waiting' && !days.includes(value);
  return html`
    <div class="field" data-date-chooser>
      <span>${tr('الموعد', 'Date')}${allowWaiting ? html` <span class="muted">— ${tr('اتركه فارغاً لقائمة الانتظار', 'leave empty for the waiting list')}</span>` : ' *'}</span>
      <input type="hidden" name="date" value="${value}">
      <div class="date-chips" role="group">
        ${allowWaiting ? html`<button type="button" class="date-chip ${value === 'waiting' ? 'on' : ''}" data-pick="waiting"><b>${tr('قائمة الانتظار', 'Waiting list')}</b><small>${tr('بدون موعد بعد', 'no date yet')}</small></button>` : ''}
        ${days.map((d) => { const n = patientsOn(d).filter((p) => p.status !== 'cancelled').length; return html`<button type="button" class="date-chip ${value === d ? 'on' : ''}" data-pick="${d}"><b>${fmtDate(d, 'med')}</b><small>${relDay(d)} · ${tr(`${n} محجوز`, `${n} booked`)}</small></button>`; })}
      </div>
      ${days.length ? '' : html`<small class="hint">${tr('لا أيام جلسات قادمة. اختر تاريخاً بالأسفل، أو حدّدها من «أيام الجلسات».', 'No upcoming session days are set. Pick a date below, or set them in “Session days”.')}</small>`}
      <label class="row small" style="margin-top:6px"><span class="muted">${tr('تاريخ آخر', 'Other date')}</span><input type="date" class="input" style="max-width:190px" data-custom value="${isCustom ? value : ''}"></label>
    </div>`;
}
function mountDateChooser(root) {
  const box = $('[data-date-chooser]', root);
  if (!box) return;
  const hidden = $('input[name=date]', box);
  const custom = $('[data-custom]', box);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    hidden.value = b.dataset.pick;
    custom.value = '';
    $$('.date-chip', box).forEach((c) => c.classList.toggle('on', c === b));
  });
  custom.addEventListener('change', () => {
    hidden.value = custom.value;
    $$('.date-chip', box).forEach((c) => c.classList.remove('on'));
  });
}

// Earlier sources / diagnoses, most used first, to pick from while typing.
function usedValues(field) {
  const n = new Map();
  for (const p of lists().portcath) if (p[field]) n.set(p[field], (n.get(p[field]) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([s]) => s).slice(0, 60);
}

// Rows read from MedSched's sheet carry every column it has: a row without the key
// means the PortCath sheet has no "diagnosis" header yet.
const diagnosisColumnMissing = () => pcApi.mode() === 'remote' && lists().portcath.some((p) => !('diagnosis' in p));

// The patient's diagnosis in OncoTracker, else the "Diagnosis" column of their CDB File row.
function diagnosisOf(op) {
  if (op.diagnosis) return cleanText(op.diagnosis);
  try {
    const pair = (JSON.parse(op.cdbData || '[]') || []).find(([k]) => /diagnos/i.test(String(k ?? '')));
    return pair ? cleanText(pair[1]) : '';
  } catch { return ''; }
}

// `oncoId`: start from this OncoTracker patient (e.g. "Book port cath" in their record).
async function editPatient(p, preset = '', oncoId = '') {
  const isNew = !p;
  p ||= {};
  const value = isNew ? (preset || '') : (p.status === 'waiting' || !p.date ? 'waiting' : p.date);
  const r = await modal({
    title: isNew ? tr('إضافة مريض Port Cath', 'Add port cath patient') : tr('تعديل بيانات المريض', 'Edit patient'),
    size: 'l',
    body: html`
      ${sub(isNew ? tr('ابحث عن المريض في سجل المرضى لتعبئة بياناته، ثم احجز له يوم جلسة أو ضعه في قائمة الانتظار.', 'Find the patient in OncoTracker to fill in their details, then book a session day or put them on the waiting list.') : `${pcStatus(p).label}${p.date ? ' · ' + fmtDate(p.date, 'long') : ''}`)}
      ${isNew ? html`<div class="pc-pick">${patientPickerHTML({ label: tr('من سجل المرضى', 'From OncoTracker patients'), patientId: oncoId })}</div>` : ''}
      <div class="grid-2">
        <label class="field span-2"><span>${tr('اسم المريض', 'Patient name')} *</span><input name="name" value="${p.name || ''}" autocomplete="off" required></label>
        <label class="field"><span>${tr('رقم الملف', 'File number')}</span><input name="fileNumber" class="ltr" value="${p.fileNumber || ''}" autocomplete="off" inputmode="numeric" spellcheck="false"></label>
        <label class="field"><span>${tr('الوزن (كغ)', 'Weight (kg)')}</span><input name="weight" type="number" step="0.1" min="1" max="300" value="${p.weight || ''}" inputmode="decimal"></label>
        <label class="field"><span>${tr('الهاتف', 'Phone')}</span><input name="phone" type="tel" class="ltr" value="${p.phone || ''}" autocomplete="off" placeholder="059…"></label>
        <label class="field"><span>${tr('موعد الكيماوي القادم', 'Next chemo appointment')}</span><input name="nextChemoAppt" type="date" value="${p.nextChemoAppt || ''}"></label>
        <label class="field span-2"><span>Diagnosis <span class="muted">— ${tr('يُطبع على الـ CVAD checklist', 'printed on the CVAD checklist')}</span></span><input name="diagnosis" list="pc-diagnoses" value="${p.diagnosis || ''}" autocomplete="off" placeholder="e.g. Ca breast, metastatic">
          ${diagnosisColumnMissing() ? html`<small class="warn-text">${icon('alert', 14)} ${tr('ملف MedSched ليس فيه عمود «diagnosis» بعد، فالتشخيص يبقى على هذا الجهاز فقط. أضف كلمة diagnosis في أول خانة فارغة من الصف الأول في ورقة PortCath.', 'MedSched’s sheet has no “diagnosis” column yet, so this is kept on this device only. Add “diagnosis” as a header in the first empty cell of row 1 on the PortCath sheet.')}</small>` : ''}</label>
        ${datalist('pc-diagnoses', usedValues('diagnosis'))}
        <label class="field span-2"><span>${tr('المصدر', 'Source')} <span class="muted">— ${tr('من طلب الحجز', 'who asked to book this patient')}</span></span><input name="source" list="pc-sources" value="${isNew ? '' : p.source || ''}" autocomplete="off" placeholder="${tr('مثلاً: د. حنا، ممرضة العيادة…', 'e.g. Dr. Hanna, clinic nurse, patient called…')}"></label>
        ${datalist('pc-sources', usedValues('source'))}
        <div class="span-2" data-dup></div>
        ${isNew || isBooked(p) || p.status === 'waiting' ? html`<div class="span-2">${dateChooser({ value, allowWaiting: true })}</div>` : ''}
        <label class="field span-2"><span>${tr('ملاحظات', 'Notes')}</span><textarea name="notes" rows="2" dir="auto">${p.notes || ''}</textarea></label>
      </div>`,
    primary: isNew ? tr('إضافة', 'Add patient') : tr('حفظ التعديلات', 'Save changes'),
    onMount: (dlg) => {
      mountDateChooser(dlg);
      const f = (n) => dlg.querySelector(`[name=${n}]`);
      const file = f('fileNumber');
      const dup = dlg.querySelector('[data-dup]');
      const check = () => {
        const others = samePatient(file.value, p.id).filter((o) => o.status !== 'cancelled');
        dup.innerHTML = others.length ? `<p class="warn-text">${icon('alert', 15)} ${esc(tr('موجود في القائمة:', 'Already on the list:'))} ${others.map((o) => `${esc(o.name)} — ${o.status === 'done' ? esc(tr('تم التركيب', 'port done')) + ' ' + esc(fmtDate(o.doneAt || o.date)) : o.date ? esc(fmtDate(o.date, 'med')) : esc(tr('قائمة الانتظار', 'waiting list'))}`).join('; ')}</p>` : '';
      };
      file.addEventListener('input', check); check();
      if (!isNew) return;
      // Picking an OncoTracker patient fills the fields (they stay editable).
      const fill = (op) => {
        if (!op) return;
        f('name').value = op.name || '';
        f('fileNumber').value = op.mrn || '';
        if (op.phone) f('phone').value = op.phone;
        const dx = diagnosisOf(op);
        if (dx) f('diagnosis').value = dx;
        check();
      };
      mountPatientPicker(dlg);
      dlg.querySelector('[data-picker]')?.addEventListener('picked', (e) => fill(e.detail));
      // "Add new patient" in the picker: mirror what is typed into the port cath fields.
      for (const [from, to] of [['newName', 'name'], ['newMrn', 'fileNumber'], ['newPhone', 'phone']]) {
        f(from)?.addEventListener('input', () => { f(to).value = f(from).value; if (to === 'fileNumber') check(); });
      }
      if (oncoId) fill(idx().lists.patients.find((x) => x.id === oncoId));
    },
    validate: (d) => {
      if (!cleanText(d.name)) return tr('اكتب اسم المريض، أو اختره من سجل المرضى.', 'Enter the patient’s name, or pick them from OncoTracker.');
      if (d.weight && !(Number(d.weight) > 0)) return tr('الوزن رقم بالكيلوغرام، أو اتركه فارغاً.', 'The weight should be a number in kg, or left empty.');
      return null;
    },
  });
  if (!r) return;
  if ('date' in r && !r.date) r.date = isNew ? 'waiting' : value;
  const fields = { name: cleanText(r.name), fileNumber: cleanText(r.fileNumber), weight: r.weight, phone: cleanText(r.phone), nextChemoAppt: r.nextChemoAppt, source: cleanText(r.source), diagnosis: cleanText(r.diagnosis), notes: r.notes };
  const date = r.date === 'waiting' ? '' : r.date;
  if (isNew) {
    const row = pc.add({ ...fields, date: date || '' });
    toast(date ? tr(`تم حجز ${row.name} في ${fmtDate(date, 'med')}`, `${row.name} booked for ${fmtDate(date, 'med')}`) : tr(`أُضيف ${row.name} إلى قائمة الانتظار`, `${row.name} added to the waiting list`));
    if (date) { ui.pcDay = date; ui.pcMonth = monthKey(date); ui.pcTab = 'schedule'; } else ui.pcTab = 'waiting';
    focusId = row.id;
    return;
  }
  batch(() => {
    upsert('portcath', { id: p.id, ...fields });
    if ('date' in r) {
      if (!date && p.date) pc.toWaiting(p, 'Moved to waiting list (edit)');
      else if (date && date !== p.date) pc.move(p, date, p.date ? 'Date changed' : 'Assigned from waiting list');
    }
  });
  toast(tr('تم الحفظ', 'Saved'));
}

async function chooseDate(p, { title, primary, reasonLabel, reasonRequired = false }) {
  return modal({
    title,
    body: html`${sub(`${p.name} · ${tr('ملف', 'File')} ${p.fileNumber}${p.date ? ' · ' + tr('حالياً', 'now') + ' ' + fmtDate(p.date, 'med') : ''}`)}
      ${dateChooser({ value: '', exclude: p.date })}
      <label class="field"><span>${reasonLabel || tr('السبب', 'Reason')}${reasonRequired ? ' *' : ''}</span><input name="reason" autocomplete="off"></label>`,
    primary,
    onMount: mountDateChooser,
    validate: (d) => (!d.date ? tr('اختر يوماً.', 'Choose a day.') : reasonRequired && !d.reason ? tr('اكتب سبباً قصيراً.', 'Write a short reason.') : null),
  });
}

const QUICK_REASONS = ['Did not come', 'Not fit today (labs / condition)', 'Postponed by the doctor', 'Patient apologised', 'No permit / referral'];
const addDay = (d) => toISO(new Date(parseISO(d).getTime() + 86400000));

async function notDone(p) {
  const next = upcomingSessions(addDay(todayISO()), 10);
  const r = await modal({
    title: tr('لم يتم تركيب البورت', 'Port not done'),
    size: 'l',
    body: html`
      ${sub(`${p.name} · ${tr('ملف', 'File')} ${p.fileNumber} · ${tr('محجوز', 'booked')} ${fmtDate(p.date, 'long')}`)}
      <div class="field"><span>${tr('لماذا لم يتم؟', 'Why was it not done?')}</span>
        <div class="pills" data-quick>${QUICK_REASONS.map((q) => html`<button type="button" class="pill" data-q="${q}">${q}</button>`)}</div>
        <input name="reason" class="input" placeholder="${tr('السبب…', 'Reason…')}" autocomplete="off">
      </div>
      <div class="field"><span>${tr('ماذا بعد؟', 'What happens next?')}</span>
        <div class="choice-list">
          <label class="choice"><input type="radio" name="next" value="move" checked><strong>${tr('ترحيل لجلسة أخرى', 'Carry over to another session (ترحيل)')}</strong><small>${tr('يبقى محجوزاً في يوم جديد.', 'Keeps the patient booked on a new day.')}</small>
            <div class="sub-field">${dateChooser({ value: next[0] || '', exclude: p.date, from: addDay(todayISO()) })}</div></label>
          <label class="choice"><input type="radio" name="next" value="waiting"><strong>${tr('إرجاع لقائمة الانتظار', 'Back to the waiting list')}</strong><small>${tr('بدون موعد حالياً.', 'No date for now.')}</small></label>
          <label class="choice"><input type="radio" name="next" value="cancel"><strong>${tr('إلغاء', 'Cancel')}</strong><small>${tr('لم يعد يحتاج البورت هنا.', 'The patient no longer needs the port here.')}</small></label>
        </div>
      </div>`,
    primary: tr('حفظ النتيجة', 'Save outcome'),
    onMount: (dlg) => {
      mountDateChooser(dlg);
      const reason = dlg.querySelector('[name=reason]');
      dlg.querySelector('[data-quick]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-q]');
        if (!b) return;
        reason.value = b.dataset.q;
        $$('[data-q]', dlg).forEach((x) => x.classList.toggle('active', x === b));
      });
    },
    validate: (d) => {
      if (d.next === 'move' && !d.date) return tr('اختر اليوم الجديد، أو خياراً آخر.', 'Choose the new day, or pick another option.');
      if (d.next === 'cancel' && !d.reason) return tr('اكتب سبب الإلغاء.', 'Write why the booking is cancelled.');
      return null;
    },
  });
  if (!r) return;
  const reason = `Not done${r.reason ? ': ' + r.reason : ''}`;
  if (r.next === 'move') { pc.move(p, r.date, reason); toast(tr(`رُحّل ${p.name} إلى ${fmtDate(r.date, 'med')}`, `${p.name} carried over to ${fmtDate(r.date, 'med')}`)); }
  else if (r.next === 'waiting') { pc.toWaiting(p, reason); toast(tr(`${p.name} عاد لقائمة الانتظار`, `${p.name} is back on the waiting list`)); }
  else { pc.cancel(p, reason); toast(tr(`أُلغي حجز ${p.name}`, `${p.name} cancelled`)); }
}

async function sessionsDialog() {
  let key = ui.pcMonth;
  const pending = new Map();
  const state = (date) => (pending.has(date) ? pending.get(date) : isSessionDay(date));
  const draw = (dlg) => {
    const first = parseISO(key + '-01');
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push('<span class="day out" aria-hidden="true"></span>');
    let count = 0;
    for (let d = 1; d <= daysIn; d++) {
      const date = `${key}-${String(d).padStart(2, '0')}`;
      const on = state(date);
      if (on) count++;
      const n = patientsOn(date).filter((p) => p.status !== 'cancelled').length;
      cells.push(`<button type="button" class="day ${on ? 'session' : ''} ${date === todayISO() ? 'today' : ''}" data-toggle="${date}" aria-pressed="${on}"><span class="dn">${d}</span>${n ? `<span class="cnt">${n}</span>` : ''}</button>`);
    }
    $('[data-cal]', dlg).innerHTML = `
      <div class="cal-head"><button type="button" class="icon-btn" data-m="-1">${prevIcon()}</button><h3>${esc(fmtMonth(key))} · ${count} ${esc(tr('يوم جلسة', 'session days'))}</h3><button type="button" class="icon-btn" data-m="1">${nextIcon()}</button></div>
      <div class="cal">${DOW().map((d) => `<span class="dow">${esc(d)}</span>`).join('')}${cells.join('')}</div>`;
  };
  const r = await modal({
    title: tr('أيام الجلسات', 'Session days'),
    body: html`${sub(tr('اضغط على الأيام لتفعيلها أو إلغائها. تُحفظ عند الضغط على حفظ.', 'Click days to switch them on or off. Changes are saved when you press Save.'))}
      <div class="panel pcv" data-cal></div>
      <p class="hint">${icon('alert', 14)} ${tr('إلغاء يوم فيه حجوزات لا ينقل المرضى. انقلهم أولاً.', 'Switching off a day that has bookings does not move the patients. Move them first.')}</p>`,
    primary: tr('حفظ أيام الجلسات', 'Save session days'),
    onMount: (dlg) => {
      draw(dlg);
      dlg.addEventListener('click', (e) => {
        const m = e.target.closest('[data-m]');
        if (m) { key = addMonths(key, Number(m.dataset.m)); draw(dlg); return; }
        const t = e.target.closest('[data-toggle]');
        if (!t) return;
        const date = t.dataset.toggle;
        const next = !state(date);
        if (next === isSessionDay(date)) pending.delete(date); else pending.set(date, next);
        draw(dlg);
      });
    },
  });
  if (!r || !pending.size) return;
  batch(() => { for (const [date, on] of pending) setSessionDay(date, on); });
  toast(tr(`تم تحديث ${nDays(pending.size)}`, `Updated ${nDays(pending.size)}`));
}

function historyDialog(p) {
  const items = [...historyOf(p.id), ...samePatient(p.fileNumber, p.id).flatMap((o) => historyOf(o.id))].sort((a, b) => b.timestamp - a.timestamp);
  return modal({
    title: `${tr('السجل', 'History')} — ${p.name}`,
    body: html`${sub(`${tr('ملف', 'File')} ${p.fileNumber} · ${pcStatus(p).label}`)}
      ${items.length ? html`<ul class="timeline">${items.map(historyItem)}</ul>` : empty(tr('لا يوجد سجل بعد', 'No history yet'), tr('النقل والإلغاء والنتائج تُسجّل هنا.', 'Moves, cancellations and outcomes are recorded here.'))}`,
    primary: '',
    secondary: tr('إغلاق', 'Close'),
  });
}

// ---------- printing (English, as MedSched prints) ----------
const COLS = [{ label: 'Patient name', width: '22%' }, { label: 'File #', width: '9%' }, { label: 'Weight', width: '7%', align: 'c' }, { label: 'Phone', width: '12%' }, { label: 'Next chemo', width: '10%' }, { label: 'Diagnosis', width: '14%' }, { label: 'Source', width: '10%' }, { label: 'Notes' }];
const pcRow = (p) => [p.name, p.fileNumber, p.weight ? `${p.weight} kg` : '', p.phone, p.nextChemoAppt ? fmtDateEn(p.nextChemoAppt, 'full') : '', p.diagnosis, p.source, p.notes];
const plainEn = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const daySection = (date) => {
  const pts = patientsOn(date).filter((p) => p.status !== 'cancelled');
  return { heading: fmtDateEn(date, 'long'), badge: plainEn(pts.length, 'patient'), columns: COLS, rows: pts.map(pcRow), empty: 'No patients booked.' };
};
const dayDoc = (date) => ({
  title: 'Port Cath Insertion List', when: fmtDateEn(date, 'full'), whenSub: fmtDateEn(date, 'dayName'), fileDate: date,
  summary: [{ label: 'patients', value: patientsOn(date).filter((p) => p.status !== 'cancelled').length }],
  sections: [{ ...daySection(date), heading: '' }],
});
const printDay = (date) => printDialog(() => dayDoc(date), { title: `${tr('طباعة', 'Print')} — ${fmtDate(date, 'long')}` });

function waitingDoc() {
  return {
    title: 'Port Cath — Waiting List',
    summary: [{ label: 'patients waiting', value: lists().waiting.length }],
    sections: [{ heading: '', columns: [{ label: 'Patient name', width: '26%' }, { label: 'File #' }, { label: 'Weight', align: 'c' }, { label: 'Phone' }, { label: 'Waiting since' }, { label: 'Diagnosis' }, { label: 'Notes' }], rows: lists().waiting.map((p) => [p.name, p.fileNumber, p.weight ? `${p.weight} kg` : '', p.phone, fmtDateEn(String(p.createdAt || '').slice(0, 10), 'full'), p.diagnosis, p.notes]), empty: 'Nobody is waiting.' }],
  };
}

async function printMenu() {
  const days = sessionDaysInMonth(ui.pcMonth);
  await printDialog((r) => {
    const scope = r.scope;
    if (scope === 'day') return dayDoc(ui.pcDay);
    if (scope === 'month' || scope === 'pick') {
      const chosen = scope === 'pick' ? (r.days || []) : days.filter((d) => patientsOn(d).some((p) => p.status !== 'cancelled'));
      if (!chosen.length) { toast(scope === 'pick' ? tr('اختر يوماً واحداً على الأقل.', 'Choose at least one day.') : tr('لا حجوزات هذا الشهر.', 'No patients are booked this month.'), { type: 'error' }); return null; }
      return { title: 'Port Cath Schedule', subtitle: fmtMonthEn(ui.pcMonth), when: fmtMonthEn(ui.pcMonth), fileDate: ui.pcMonth, sections: chosen.map(daySection), pageBreaks: true };
    }
    if (scope === 'waiting') return waitingDoc();
    if (scope === 'awaiting') return { title: 'Port Cath — Awaiting Outcome', sections: [{ heading: '', columns: [{ label: 'Patient name', width: '30%' }, { label: 'File #' }, { label: 'Booked on' }, { label: 'Phone' }, { label: 'Notes' }], rows: lists().awaiting.map((p) => [p.name, p.fileNumber, fmtDateEn(p.date, 'full'), p.phone, p.notes]) }] };
    return null;
  }, {
    title: tr('طباعة أو تصدير', 'Print or export'),
    extra: html`
      <div class="choice-list">
        <label class="choice"><input type="radio" name="scope" value="day" checked><strong>${tr('اليوم المختار', 'Selected day')}</strong><small>${fmtDate(ui.pcDay, 'long')}</small></label>
        <label class="choice"><input type="radio" name="scope" value="month"><strong>${tr('الشهر كاملاً', 'Whole month')}</strong><small>${fmtMonth(ui.pcMonth)} · ${tr('كل يوم جلسة فيه مرضى، صفحة لكل يوم', 'every session day with patients, one page each')}</small></label>
        <label class="choice"><input type="radio" name="scope" value="pick"><strong>${tr('أيام محددة', 'Chosen days')}</strong><small>${days.length ? days.map((d) => html`<label class="check" style="margin-inline-end:10px"><input type="checkbox" name="days" data-multi value="${d}">${fmtDate(d, 'med')}</label>`) : tr('لا أيام جلسات هذا الشهر.', 'No session days this month.')}</small></label>
        <label class="choice"><input type="radio" name="scope" value="waiting"><strong>${tr('قائمة الانتظار', 'Waiting list')}</strong><small>${nPatients(lists().waiting.length)}</small></label>
        <label class="choice"><input type="radio" name="scope" value="awaiting"><strong>${tr('بانتظار النتيجة', 'Awaiting outcome')}</strong><small>${nPatients(lists().awaiting.length)}</small></label>
      </div>`,
  });
}

function csv() {
  const rows = regRows();
  const head = ['Name', 'File number', 'Status', 'Date', 'Weight', 'Phone', 'Next chemo', 'Diagnosis', 'Source', 'Done on', 'Notes'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((p) => [p.name, p.fileNumber, p.status, p.date, p.weight, p.phone, p.nextChemoAppt, p.diagnosis, p.source, p.doneAt, p.notes].map(q).join(','));
  downloadFile(`port-cath-${todayISO()}.csv`, '﻿' + [head.join(','), ...body].join('\r\n'), 'text/csv');
}

// ---------- OncoTracker patient record ----------
// Port cath bookings of an OncoTracker patient (matched by file number).
export function bookingsFor(patient) {
  const m = normMrn(patient?.mrn);
  if (!m || !pcStore.loaded) return [];
  return lists().portcath.filter((p) => normMrn(p.fileNumber) === m).sort((a, b) => String(b.date || '9999').localeCompare(String(a.date || '9999')));
}

// ---------- handlers ----------
const P = (el) => get('portcath', el.dataset.id);

registerActions({
  'pc-retry': () => pcSync().catch(() => {}),
  'pc-tab': (el) => { ui.pcTab = el.dataset.tab; ui.pcQuery = ''; },
  'pc-month': (el) => { ui.pcMonth = el.dataset.to; },
  'pc-day': (el) => { ui.pcDay = el.dataset.date; },
  'pc-filter': (el) => { ui.pcStatus = el.dataset.f; },
  'pc-add': (el) => editPatient(null, el.dataset.date === 'waiting' ? 'waiting' : el.dataset.date || ''),
  'pc-edit': (el) => editPatient(P(el)),
  'pc-open-patient': async (el) => { const { openPatient } = await import('../patient.js'); openPatient(el.dataset.pid); },
  'pc-done': (el) => {
    const p = P(el);
    pc.done(p);
    toast(tr(`${p.name}: تم التركيب`, `${p.name}: port done`), { undo: () => pc.undoDone(get('portcath', p.id)) });
  },
  'pc-undo-done': (el) => { pc.undoDone(P(el)); toast(tr('أُزيلت علامة «تم التركيب»', '“Port done” removed')); },
  'pc-notdone': (el) => notDone(P(el)),
  'pc-all-done': async (el) => {
    const pts = patientsOn(el.dataset.date).filter(isBooked);
    if (!(await confirmBox(tr(`تأكيد تركيب البورت لـ ${nPatients(pts.length)} في ${fmtDate(el.dataset.date, 'long')}؟`, `Mark ${nPatients(pts.length)} on ${fmtDate(el.dataset.date, 'long')} as port done?`), { title: tr('الكل تم؟', 'All done?'), confirm: tr('تأكيد الكل', 'Mark all done') }))) return;
    batch(() => pts.forEach((p) => pc.done(p)));
    toast(tr(`تم تأكيد ${nPatients(pts.length)}`, `${nPatients(pts.length)} marked port done`));
  },
  'pc-assign': async (el) => {
    const p = P(el);
    const r = await chooseDate(p, { title: tr('تحديد موعد', 'Assign a date'), primary: tr('حجز', 'Book'), reasonLabel: tr('ملاحظة (اختياري)', 'Note (optional)') });
    if (!r) return;
    pc.move(p, r.date, r.reason || 'Assigned from waiting list');
    toast(tr(`تم حجز ${p.name} في ${fmtDate(r.date, 'med')}`, `${p.name} booked for ${fmtDate(r.date, 'med')}`));
  },
  'pc-move': async (el) => {
    const p = P(el);
    const r = await chooseDate(p, { title: tr('نقل ليوم آخر', 'Move to another day'), primary: tr('نقل', 'Move'), reasonRequired: true });
    if (!r) return;
    pc.move(p, r.date, r.reason);
    toast(tr(`نُقل ${p.name} إلى ${fmtDate(r.date, 'med')}`, `${p.name} moved to ${fmtDate(r.date, 'med')}`));
  },
  'pc-to-waiting': async (el) => {
    const p = P(el);
    if (!(await confirmBox(tr(`سيُزال ${p.name} من ${fmtDate(p.date, 'long')} ويعود لقائمة الانتظار.`, `${p.name} will be taken off ${fmtDate(p.date, 'long')} and put back on the waiting list.`), { title: tr('إرجاع لقائمة الانتظار؟', 'Back to waiting list?'), confirm: tr('إرجاع', 'Move to waiting list') }))) return;
    pc.toWaiting(p);
    toast(tr(`${p.name} عاد لقائمة الانتظار`, `${p.name} is back on the waiting list`));
  },
  'pc-cancel': async (el) => {
    const p = P(el);
    const r = await modal({ title: tr('إلغاء الحجز', 'Cancel booking'), body: html`${sub(`${p.name} · ${tr('ملف', 'File')} ${p.fileNumber}`)}<label class="field"><span>${tr('السبب', 'Reason')} *</span><input name="reason" autocomplete="off"></label>`, primary: tr('إلغاء الحجز', 'Cancel booking'), secondary: tr('إبقاء', 'Keep'), danger: true, validate: (d) => (!d.reason ? tr('اكتب سبباً قصيراً.', 'Write a short reason.') : null) });
    if (!r) return;
    pc.cancel(p, r.reason);
    toast(tr(`أُلغي حجز ${p.name}`, `${p.name} cancelled`), { undo: () => pc.restore(get('portcath', p.id), 'Undo cancel') });
  },
  'pc-restore': (el) => { const p = P(el); pc.restore(p, 'Restored'); toast(tr(`استُعيد ${p.name}`, `${p.name} restored`)); },
  'pc-history': (el) => historyDialog(P(el)),
  'pc-delete': async (el) => {
    const p = P(el);
    if (!(await confirmBox(tr(`حذف ${p.name} (ملف ${p.fileNumber}) من Port Cath؟ استخدم «إلغاء الحجز» إذا كان الحجز لن يتم فقط.`, `Delete ${p.name} (file ${p.fileNumber}) from port cath? Use “Cancel” instead if the booking just won’t happen.`), { title: tr('حذف السجل؟', 'Delete record?'), confirm: tr('حذف', 'Delete'), danger: true }))) return;
    const row = remove('portcath', p.id);
    toast(tr(`حُذف ${p.name}`, `${p.name} deleted`), { undo: () => restore('portcath', row) });
  },
  'pc-toggle-session': (el) => {
    const d = el.dataset.date;
    const on = !isSessionDay(d);
    setSessionDay(d, on);
    toast(on ? tr(`${fmtDate(d, 'med')} صار يوم جلسة`, `${fmtDate(d, 'med')} is now a session day`) : tr(`${fmtDate(d, 'med')} لم يعد يوم جلسة`, `${fmtDate(d, 'med')} is no longer a session day`));
  },
  'pc-sessions': () => sessionsDialog(),
  'pc-print': () => printMenu(),
  'pc-print-day': (el) => printDay(el.dataset.date),
  'pc-print-waiting': () => printDialog(() => waitingDoc(), { title: tr('طباعة قائمة الانتظار', 'Print waiting list') }),
  'pc-csv': () => csv(),
  'pc-checklist': (el) => { const p = P(el); printChecklists([p], { subtitle: `${p.name} · ${fmtDate(p.date, 'long')}` }); },
  'pc-checklist-day': (el) => { const pts = patientsOn(el.dataset.date).filter(hasAppt); printChecklists(pts, { subtitle: `${fmtDate(el.dataset.date, 'long')} · ${nPatients(pts.length)}` }); },
  'pc-book-patient': (el) => editPatient(null, '', el.dataset.pid),
});

registerChanges({
  'pc-query': (el) => { ui.pcQuery = el.value; },
});
