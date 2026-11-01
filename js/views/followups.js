// Follow-ups: one board of dated tasks (manual + automatic from clinic visits),
// grouped by urgency, with call attempts, snooze and a required outcome to close.
import { html, todayISO, addDays, diffDays, fmtDate, fmtTime, matchesQuery, uniq, byText } from '../util.js';
import { idx, patient, get, create, upsert, batch } from '../store.js';
import { FU_TYPES, fuLabel, ATTEMPT_RESULTS, attemptLabel, openTasks, autoTasks } from '../rules.js';
import { icon, modal, toast, dueChip, menu, telLink, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker } from '../ui.js';
import { settings } from '../settings.js';
import { printTable } from '../print.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('المتابعات', 'Follow-ups');

function enrich(t) {
  const p = patient(t.patientId) || {};
  let src = null;
  if (t.sourceType === 'visit') src = get('visits', t.sourceId);
  if (t.sourceType === 'committee') src = get('committee', t.sourceId);
  return { ...t, p, src, physician: t.physician || src?.physician || p.physician || '' };
}

function findTask(id) {
  if (id.startsWith('auto:')) return autoTasks().find((t) => t.id === id);
  return get('followups', id);
}

function sourceChip(t) {
  if (t.sourceType === 'visit' && t.src) return html`<span class="chip outline">${tr('عيادة', 'Clinic')} ${fmtDate(t.src.sessionDate)}</span>`;
  if (t.sourceType === 'committee' && t.src) return html`<span class="chip outline">${tr('لجنة', 'Committee')} ${fmtDate(t.src.sessionDate)}</span>`;
  return '';
}

export function taskRow(t, { compact = false } = {}) {
  const last = (t.attempts || []).at(-1);
  const auto = !!t.auto;
  return html`
  <div class="task ${auto ? 'auto' : ''}">
    <div>${dueChip(t.dueDate, t.status)}<div class="small muted">${t.dueDate ? fmtDate(t.dueDate, 'med') : ''}</div></div>
    <div>
      <div class="task-title"><span class="chip ${auto ? 'blue' : 'outline'}">${auto ? tr('تلقائية', 'Automatic') : fuLabel(t.type)}</span> ${t.title}</div>
      <div class="task-meta">
        <button class="patient-link" data-action="open-patient" data-id="${t.patientId}">${t.p.name || tr('مريض غير معروف', 'Unknown patient')}</button>
        <span class="mrn">${t.p.mrn || ''}</span>
        <span>${icon('phone', 13)} ${telLink(t.p.phone)}</span>
        ${t.physician ? html`<span>${dr(t.physician)}</span>` : ''}
        ${compact ? '' : sourceChip(t)}
        ${auto && t.visit?.opcDate ? html`<span>${tr('الموعد', 'Appointment')}: ${fmtDate(t.visit.opcDate, 'med')}</span>` : ''}
      </div>
      ${!compact && t.src?.plan && t.sourceType === 'visit' ? html`<div class="small muted" style="margin-top:4px; white-space:pre-wrap">${t.src.plan}</div>` : ''}
      ${!compact && t.src?.decision ? html`<div class="small muted" style="margin-top:4px">${tr('قرار اللجنة', 'Committee decision')}: ${t.src.decision}</div>` : ''}
      ${last ? html`<div class="attempts">${icon('phone', 13)} ${(t.attempts || []).length} ${tr('محاولة — آخرها', 'attempt(s) — last:')} ${attemptLabel(last.result)} ${fmtTime(last.at)}${last.note ? ` — ${last.note}` : ''}</div>` : ''}
    </div>
    <div class="task-actions">
      ${auto && t.auto === 'NOTIFY' ? html`<button class="btn btn-sm btn-primary" data-action="auto-notified" data-id="${t.id}">${icon('check', 16)} ${tr('تم التبليغ', 'Notified')}</button>` : ''}
      ${auto && t.auto === 'BOOK' ? html`<button class="btn btn-sm btn-primary" data-action="auto-book" data-id="${t.id}">${icon('calendar', 16)} ${tr('إضافة الموعد', 'Add appointment')}</button>` : ''}
      ${!auto ? html`<button class="btn btn-sm btn-primary" data-action="finish-task" data-id="${t.id}">${icon('check', 16)} ${tr('إنهاء', 'Complete')}</button>` : ''}
      <button class="btn btn-sm" data-action="attempt-task" data-id="${t.id}">${icon('phone', 16)} ${tr('محاولة', 'Call attempt')}</button>
      ${menu(html`
        <button data-action="snooze-task" data-id="${t.id}">${icon('clock', 16)} ${tr('تأجيل الاستحقاق', 'Snooze')}</button>
        ${!auto ? html`
          <button data-action="waiting-task" data-id="${t.id}">${icon('pause', 16)} ${t.status === 'waiting' ? tr('إلغاء «بانتظار رد»', 'No longer waiting') : tr('بانتظار رد من جهة أخرى', 'Waiting on someone else')}</button>
          <button data-action="edit-task" data-id="${t.id}">${icon('edit', 16)} ${tr('تعديل', 'Edit')}</button>
          <hr><button class="danger" data-action="cancel-task" data-id="${t.id}">${icon('x', 16)} ${tr('إلغاء المتابعة', 'Cancel follow-up')}</button>`
        : html`<hr><button class="danger" data-action="auto-close" data-id="${t.id}">${icon('x', 16)} ${tr('إغلاق بدون إجراء', 'Close without action')}</button>`}
      `)}
    </div>
  </div>`;
}

export function render() {
  const today = todayISO();
  let tasks = (ui.fuShow === 'done'
    ? idx().lists.followups.filter((f) => (f.status === 'done' || f.status === 'cancelled') && f.closedAt && diffDays(f.closedAt.slice(0, 10), today) <= 30)
    : openTasks()).map(enrich);

  const doctors = uniq(tasks.map((t) => t.physician).filter(Boolean)).sort(byText);
  const typeCounts = {};
  for (const t of tasks) typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;

  if (ui.fuType !== 'ALL') tasks = tasks.filter((t) => t.type === ui.fuType);
  if (ui.fuDoctor !== 'ALL') tasks = tasks.filter((t) => t.physician === ui.fuDoctor);
  if (ui.fuQuery) tasks = tasks.filter((t) => matchesQuery(ui.fuQuery, t.p.name, t.p.mrn, t.title, t.physician));

  const toolbar = html`
    <div class="toolbar">
      <div class="tabs" style="margin:0">
        <button class="tab ${ui.fuShow === 'open' ? 'active' : ''}" data-action="fu-show" data-v="open">${tr('المفتوحة', 'Open')}</button>
        <button class="tab ${ui.fuShow === 'done' ? 'active' : ''}" data-action="fu-show" data-v="done">${tr('المنجزة (30 يوماً)', 'Done (30 days)')}</button>
      </div>
      <label class="search-box"><input class="input" type="search" placeholder="${tr('بحث بالاسم أو رقم الملف أو المهمة', 'Search name, file number or task')}" value="${ui.fuQuery}" data-input="fu-q" data-key="fu-q">${icon('search', 16)}</label>
      <select class="input" style="width:auto" data-change="fu-doctor" aria-label="${tr('الطبيب', 'Doctor')}">
        <option value="ALL">${tr('كل الأطباء', 'All doctors')}</option>${doctors.map((d) => html`<option value="${d}" ${ui.fuDoctor === d ? 'selected' : ''}>${dr(d)}</option>`)}
      </select>
      <span class="spacer"></span>
      <button class="btn" data-action="print-fu">${icon('print')} ${tr('طباعة', 'Print')}</button>
      <button class="btn btn-primary" data-action="new-followup">${icon('plus')} ${tr('متابعة جديدة', 'New follow-up')}</button>
    </div>
    <div class="tabs">
      <button class="tab ${ui.fuType === 'ALL' ? 'active' : ''}" data-action="fu-type" data-v="ALL">${tr('الكل', 'All')} <span class="n">${Object.values(typeCounts).reduce((a, b) => a + b, 0)}</span></button>
      ${FU_TYPES.filter((t) => typeCounts[t.v]).map((t) => html`<button class="tab ${ui.fuType === t.v ? 'active' : ''}" data-action="fu-type" data-v="${t.v}">${t.l} <span class="n">${typeCounts[t.v]}</span></button>`)}
    </div>`;

  if (ui.fuShow === 'done') {
    tasks.sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
    return html`${toolbar}
      <div class="panel">${tasks.length ? html`<ul class="mini-list">${tasks.map((t) => html`
        <li><div>
          <div><span class="chip ${t.status === 'done' ? 'green' : ''}">${t.status === 'done' ? tr('أُنجزت', 'Done') : tr('أُلغيت', 'Cancelled')}</span> <span class="chip outline">${fuLabel(t.type)}</span> <strong>${t.title}</strong></div>
          <div class="task-meta"><button class="patient-link" data-action="open-patient" data-id="${t.patientId}">${t.p.name}</button><span class="mrn">${t.p.mrn}</span><span>${fmtTime(t.closedAt)}</span></div>
          <div class="small" style="margin-top:4px">${t.outcome}</div>
        </div>
        ${t.status === 'done' ? html`<button class="btn btn-sm btn-ghost" data-action="reopen-task" data-id="${t.id}">${icon('undo', 16)} ${tr('إعادة فتح', 'Reopen')}</button>` : ''}</li>`)}</ul>`
        : html`<div class="empty"><strong>${tr('لا يوجد شيء هنا', 'Nothing here')}</strong>${tr('المتابعات المنجزة خلال آخر 30 يوماً تظهر في هذه القائمة.', 'Follow-ups completed in the last 30 days appear here.')}</div>`}</div>`;
  }

  const groups = [
    { k: 'over', l: tr('متأخرة', 'Overdue'), test: (t) => t.dueDate && t.dueDate < today },
    { k: 'today', l: tr('مستحقة اليوم', 'Due today'), test: (t) => t.dueDate === today },
    { k: 'week', l: tr('خلال الأيام السبعة القادمة', 'Next 7 days'), test: (t) => t.dueDate > today && t.dueDate <= addDays(today, 7) },
    { k: 'later', l: tr('لاحقاً', 'Later'), test: (t) => t.dueDate > addDays(today, 7) },
    { k: 'none', l: tr('بدون تاريخ استحقاق', 'No due date'), test: (t) => !t.dueDate },
  ];
  tasks.sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')) || (a.status === 'waiting') - (b.status === 'waiting'));
  const body = groups.map((g) => {
    const rows = tasks.filter(g.test);
    if (!rows.length) return '';
    return html`<section class="fu-group"><h3>${g.k === 'over' ? icon('alert', 16) : ''}${g.l} <span class="chip ${g.k === 'over' ? 'red' : g.k === 'today' ? 'amber' : ''}">${rows.length}</span></h3>${rows.map((t) => taskRow(t))}</section>`;
  });
  return html`${toolbar}
    ${tasks.length ? body : html`<div class="panel empty"><strong>${tr('لا توجد متابعات مفتوحة', 'No open follow-ups')}</strong>${tr('أضف متابعة من ملف المريض، أو من قرار اللجنة، أو من زر «متابعة جديدة».', 'Add one from a patient record, a committee decision, or "New follow-up".')}</div>`}`;
}

// ---------- actions ----------
const typeOptions = (sel) => FU_TYPES.map((t) => html`<option value="${t.v}" ${sel === t.v ? 'selected' : ''}>${t.l}</option>`);

export async function newFollowup({ patientId = '', sourceType = 'manual', sourceId = '', type = '', title = '' } = {}) {
  const due = addDays(todayISO(), Number(settings.get('followupDays')) || 3);
  const data = await modal({
    title: tr('متابعة جديدة', 'New follow-up'),
    body: html`
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        <label class="field"><span>${tr('النوع', 'Type')}</span><select name="type" required><option value="">${tr('اختر…', 'Choose…')}</option>${typeOptions(type)}</select></label>
        <label class="field"><span>${tr('تاريخ الاستحقاق', 'Due date')}</span><input type="date" name="dueDate" value="${due}"></label>
        <label class="field span-2"><span>${tr('المطلوب', 'What needs doing')}</span><textarea name="title" placeholder="${tr('مثال: إرسال التحويل لقسم الأشعة وتأكيد الموعد', 'e.g. Send the referral to radiology and confirm the appointment')}">${title}</textarea></label>
      </div>`,
    onMount: (dlg) => mountPatientPicker(dlg),
    validate: (d) => validatePicker(d) || (!d.type ? tr('اختر نوع المتابعة.', 'Choose the type.') : !d.title ? tr('اكتب المطلوب في هذه المتابعة.', 'Write what needs doing.') : null),
  });
  if (!data) return;
  const r = resolvePatient(data);
  if (r.error) { toast(r.error, { type: 'error' }); return; }
  create('followups', { patientId: r.id, sourceType, sourceId, type: data.type, title: data.title, dueDate: data.dueDate, status: 'open', outcome: '', closedAt: '' });
  toast(tr('أُضيفت المتابعة', 'Follow-up added'));
}

async function finishTask(id) {
  const t = enrich(findTask(id));
  const data = await modal({
    title: tr('إنهاء المتابعة', 'Complete follow-up'),
    body: html`
      <div class="panel" style="padding:10px 12px"><span class="chip outline">${fuLabel(t.type)}</span> ${t.title}<div class="small muted">${t.p.name} — ${t.p.mrn}</div></div>
      <label class="field"><span>${tr('ما الذي تمّ؟', 'What was done?')}</span><textarea name="outcome" placeholder="${tr('مثال: أُرسل التحويل وحُدّد موعد الأشعة يوم الأحد، وتم إبلاغ المريض', 'e.g. Referral sent, imaging booked for Sunday, patient informed')}" autofocus></textarea>
        <span class="hint">${tr('يُحفظ في ملف المريض ضمن سجل المتابعات.', 'Saved to the patient record with the follow-up.')}</span></label>
      ${t.sourceType === 'visit' && t.src && t.src.notified !== 'Y' ? html`<label class="check"><input type="checkbox" name="markNotified" checked> ${tr('وضع علامة «تم التبليغ» على زيارة', 'Mark the patient notified for the visit of')} ${fmtDate(t.src.sessionDate)}</label>` : ''}`,
    primary: tr('إنهاء', 'Complete'),
    validate: (d) => (!d.outcome ? tr('اكتب ما تمّ لإغلاق هذه المتابعة.', 'Write what was done to close this follow-up.') : null),
  });
  if (!data) return;
  batch(() => {
    upsert('followups', { id, status: 'done', outcome: data.outcome, closedAt: new Date().toISOString() }, { summary: `${tr('أُنجزت', 'Completed')}: ${t.title}` });
    if (data.markNotified) upsert('visits', { id: t.src.id, notified: 'Y' });
  });
  toast(tr('أُغلقت المتابعة', 'Follow-up completed'), { undo: () => upsert('followups', { id, status: 'open', outcome: '', closedAt: '' }, { summary: tr('إعادة فتح', 'Reopened') }) });
}

// Automatic tasks have no record; the first attempt turns them into a real follow-up.
function materialize(t) {
  let row;
  batch(() => {
    row = create('followups', { patientId: t.patientId, sourceType: 'visit', sourceId: t.sourceId, type: t.type, title: t.title, dueDate: t.dueDate, status: 'open', outcome: '', closedAt: '', attempts: [] });
    upsert('visits', { id: t.sourceId, autoClosed: '1' }, false);
  });
  return row;
}

async function attemptTask(id) {
  const t0 = findTask(id);
  const t = enrich(t0);
  const data = await modal({
    title: tr('تسجيل محاولة تواصل', 'Log call attempt'),
    body: html`
      <div class="row-between panel" style="padding:10px 12px"><div><strong>${t.p.name}</strong> <span class="mrn">${t.p.mrn}</span></div><div>${icon('phone', 15)} ${telLink(t.p.phone)}</div></div>
      <fieldset class="field" style="border:0; padding:0; margin:0"><span class="field-label">${tr('النتيجة', 'Result')}</span>
        <div class="row">${ATTEMPT_RESULTS.map((r, i) => html`<label class="check chip outline" style="padding:6px 12px"><input type="radio" name="result" value="${r.v}" ${i === 0 ? 'checked' : ''}> ${r.l}</label>`)}</div>
      </fieldset>
      <label class="field"><span>${tr('ملاحظة', 'Note')}</span><input name="note" placeholder="${tr('اختياري', 'Optional')}"></label>
      <label class="field"><span>${tr('المحاولة التالية', 'Next attempt')}</span><input type="date" name="next" value="${addDays(todayISO(), 1)}"></label>`,
    primary: tr('تسجيل', 'Log'),
  });
  if (!data) return;
  const attempt = { at: new Date().toISOString(), result: data.result, note: data.note };
  batch(() => {
    const row = t0.auto ? materialize(t0) : t0;
    upsert('followups', { id: row.id, attempts: [...(row.attempts || []), attempt], dueDate: data.next || row.dueDate }, { summary: `${tr('محاولة تواصل', 'Call attempt')}: ${attemptLabel(data.result)}` });
    if (data.result === 'WRONG') upsert('patients', { id: t.patientId, phoneFlag: 'wrong' }, { summary: tr('أُبلغ أن رقم الهاتف خاطئ', 'Phone number reported wrong') });
  });
  toast(data.result === 'WRONG' ? tr('سُجّلت المحاولة، وأُضيف الرقم لقائمة تصحيح البيانات', 'Attempt logged; the number was added to Data fixes') : tr('سُجّلت المحاولة', 'Attempt logged'));
}

async function snoozeTask(id) {
  const t0 = findTask(id);
  const label = (n) => (n === 1 ? tr('غداً', 'Tomorrow') : n === 2 ? tr('بعد يومين', 'In 2 days') : tr('بعد أسبوع', 'In a week'));
  const data = await modal({
    title: tr('تأجيل الاستحقاق', 'Snooze'),
    body: html`<div class="row">${[1, 2, 7].map((n) => html`<button type="button" class="btn btn-sm" data-days="${n}">${label(n)}</button>`)}</div>
      <label class="field"><span>${tr('التاريخ الجديد', 'New date')}</span><input type="date" name="dueDate" value="${addDays(todayISO(), 1)}"></label>`,
    onMount: (dlg) => dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-days]'); if (b) dlg.querySelector('[name=dueDate]').value = addDays(todayISO(), +b.dataset.days); }),
  });
  if (!data?.dueDate) return;
  const row = t0.auto ? materialize(t0) : t0;
  upsert('followups', { id: row.id, dueDate: data.dueDate }, { summary: `${tr('تأجيل إلى', 'Snoozed to')} ${data.dueDate}` });
}

async function editTask(id) {
  const f = get('followups', id);
  const data = await modal({
    title: tr('تعديل المتابعة', 'Edit follow-up'),
    body: html`<div class="grid-2">
      <label class="field"><span>${tr('النوع', 'Type')}</span><select name="type">${typeOptions(f.type)}</select></label>
      <label class="field"><span>${tr('تاريخ الاستحقاق', 'Due date')}</span><input type="date" name="dueDate" value="${f.dueDate}"></label>
      <label class="field span-2"><span>${tr('المطلوب', 'What needs doing')}</span><textarea name="title">${f.title}</textarea></label></div>`,
    validate: (d) => (!d.title ? tr('اكتب المطلوب.', 'Write what needs doing.') : null),
  });
  if (data) upsert('followups', { id, ...data });
}

async function cancelTask(id) {
  const data = await modal({ title: tr('إلغاء المتابعة', 'Cancel follow-up'), body: html`<label class="field"><span>${tr('سبب الإلغاء', 'Reason')}</span><input name="reason" autofocus></label>`, primary: tr('إلغاء المتابعة', 'Cancel follow-up'), secondary: tr('رجوع', 'Back'), danger: true, validate: (d) => (!d.reason ? tr('اكتب سبب الإلغاء.', 'Write the reason.') : null) });
  if (!data) return;
  upsert('followups', { id, status: 'cancelled', outcome: data.reason, closedAt: new Date().toISOString() });
  toast(tr('أُلغيت المتابعة', 'Follow-up cancelled'), { undo: () => upsert('followups', { id, status: 'open', outcome: '', closedAt: '' }) });
}

async function autoBook(id) {
  const t = findTask(id);
  const data = await modal({ title: tr('موعد العيادة القادم', 'Next clinic appointment'), body: html`<label class="field"><span>${tr('التاريخ', 'Date')}</span><input type="date" name="opcDate" min="${todayISO()}" autofocus></label>`, validate: (d) => (!d.opcDate ? tr('اختر التاريخ.', 'Choose the date.') : null) });
  if (data) { upsert('visits', { id: t.sourceId, opcDate: data.opcDate }); toast(tr('حُفظ الموعد — المهمة التالية: تبليغ المريض', 'Appointment saved — next task: notify the patient')); }
}

function printList() {
  const tasks = openTasks().map(enrich).filter((t) => (ui.fuType === 'ALL' || t.type === ui.fuType) && (ui.fuDoctor === 'ALL' || t.physician === ui.fuDoctor));
  tasks.sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
  printTable({
    title: tr('قائمة المتابعات المفتوحة', 'Open follow-ups'),
    subtitle: [ui.fuType !== 'ALL' ? fuLabel(ui.fuType) : '', ui.fuDoctor !== 'ALL' ? dr(ui.fuDoctor) : ''].filter(Boolean).join(' — '),
    columns: [{ label: tr('المريض', 'Patient') }, { label: tr('رقم الملف', 'File no.') }, { label: tr('الهاتف', 'Phone') }, { label: tr('النوع', 'Type') }, { label: tr('المطلوب', 'Task'), width: '32%' }, { label: tr('الطبيب', 'Doctor') }, { label: tr('الاستحقاق', 'Due') }, { label: tr('ملاحظات', 'Notes'), width: '14%' }],
    rows: tasks.map((t) => [t.p.name, t.p.mrn, t.p.phone, fuLabel(t.type), t.title, t.physician ? dr(t.physician) : '', t.dueDate ? fmtDate(t.dueDate) : '—', '']),
  });
}

registerActions({
  'new-followup': (el) => newFollowup({ patientId: el.dataset.patient || '' }),
  'finish-task': (el) => finishTask(el.dataset.id),
  'attempt-task': (el) => attemptTask(el.dataset.id),
  'snooze-task': (el) => snoozeTask(el.dataset.id),
  'edit-task': (el) => editTask(el.dataset.id),
  'cancel-task': (el) => cancelTask(el.dataset.id),
  'waiting-task': (el) => { const f = get('followups', el.dataset.id); upsert('followups', { id: f.id, status: f.status === 'waiting' ? 'open' : 'waiting' }); },
  'reopen-task': (el) => upsert('followups', { id: el.dataset.id, status: 'open', outcome: '', closedAt: '' }, { summary: tr('إعادة فتح', 'Reopened') }),
  'auto-notified': (el) => { const t = findTask(el.dataset.id); upsert('visits', { id: t.sourceId, notified: 'Y' }, { summary: tr('تم تبليغ المريض بالموعد', 'Patient notified of appointment') }); toast(tr('سُجّل التبليغ', 'Marked notified'), { undo: () => upsert('visits', { id: t.sourceId, notified: 'N' }) }); },
  'auto-book': (el) => autoBook(el.dataset.id),
  'auto-close': (el) => { const t = findTask(el.dataset.id); upsert('visits', { id: t.sourceId, autoClosed: '1' }, { summary: tr('أُغلقت المهمة التلقائية بدون إجراء', 'Automatic task closed without action') }); toast(tr('أُغلقت المهمة', 'Task closed'), { undo: () => upsert('visits', { id: t.sourceId, autoClosed: '' }) }); },
  'fu-show': (el) => { ui.fuShow = el.dataset.v; },
  'fu-type': (el) => { ui.fuType = el.dataset.v; },
  'print-fu': () => printList(),
});
registerChanges({
  'fu-doctor': (el) => { ui.fuDoctor = el.value; },
  'fu-q': (el) => { ui.fuQuery = el.value; },
});
