// Follow-ups: one board of dated tasks (manual + automatic from clinic visits),
// grouped by urgency, with call attempts, snooze and a required outcome to close.
import { html, todayISO, addDays, diffDays, fmtDate, fmtTime, matchesQuery, uniq, byText } from '../util.js';
import { idx, patient, get, create, upsert, note, batch } from '../store.js';
import { FU_TYPES, fuLabel, ATTEMPT_RESULTS, attemptLabel, openTasks, autoTasks } from '../rules.js';
import { icon, modal, toast, dueChip, menu, telLink, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker } from '../ui.js';
import { settings } from '../settings.js';
import { printTable } from '../print.js';
import { registerActions, registerChanges, ui } from '../registry.js';

export const title = 'المتابعات';

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
  if (t.sourceType === 'visit' && t.src) return html`<span class="chip outline">عيادة ${fmtDate(t.src.sessionDate)}</span>`;
  if (t.sourceType === 'committee' && t.src) return html`<span class="chip outline">لجنة ${fmtDate(t.src.sessionDate)}</span>`;
  return '';
}

export function taskRow(t, { compact = false } = {}) {
  const last = (t.attempts || []).at(-1);
  const auto = !!t.auto;
  return html`
  <div class="task ${auto ? 'auto' : ''}">
    <div>${dueChip(t.dueDate, t.status)}<div class="small muted">${t.dueDate ? fmtDate(t.dueDate, 'med') : ''}</div></div>
    <div>
      <div class="task-title"><span class="chip ${auto ? 'blue' : 'outline'}">${auto ? 'تلقائية' : fuLabel(t.type)}</span> ${t.title}</div>
      <div class="task-meta">
        <button class="patient-link" data-action="open-patient" data-id="${t.patientId}">${t.p.name || 'مريض غير معروف'}</button>
        <span class="mrn">${t.p.mrn || ''}</span>
        <span>${icon('phone', 13)} ${telLink(t.p.phone)}</span>
        ${t.physician ? html`<span>د. ${t.physician}</span>` : ''}
        ${compact ? '' : sourceChip(t)}
        ${auto && t.visit?.opcDate ? html`<span>الموعد: ${fmtDate(t.visit.opcDate, 'med')}</span>` : ''}
      </div>
      ${!compact && t.src?.plan && t.sourceType === 'visit' ? html`<div class="small muted" style="margin-top:4px; white-space:pre-wrap">${t.src.plan}</div>` : ''}
      ${!compact && t.src?.decision ? html`<div class="small muted" style="margin-top:4px">قرار اللجنة: ${t.src.decision}</div>` : ''}
      ${last ? html`<div class="attempts">${icon('phone', 13)} ${(t.attempts || []).length} محاولة — آخرها ${attemptLabel(last.result)} ${fmtTime(last.at)}${last.note ? ` — ${last.note}` : ''}</div>` : ''}
    </div>
    <div class="task-actions">
      ${auto && t.auto === 'NOTIFY' ? html`<button class="btn btn-sm btn-primary" data-action="auto-notified" data-id="${t.id}">${icon('check', 16)} تم التبليغ</button>` : ''}
      ${auto && t.auto === 'BOOK' ? html`<button class="btn btn-sm btn-primary" data-action="auto-book" data-id="${t.id}">${icon('calendar', 16)} إضافة الموعد</button>` : ''}
      ${!auto ? html`<button class="btn btn-sm btn-primary" data-action="finish-task" data-id="${t.id}">${icon('check', 16)} إنهاء</button>` : ''}
      <button class="btn btn-sm" data-action="attempt-task" data-id="${t.id}">${icon('phone', 16)} محاولة</button>
      ${menu(html`
        <button data-action="snooze-task" data-id="${t.id}">${icon('clock', 16)} تأجيل الاستحقاق</button>
        ${!auto ? html`
          <button data-action="waiting-task" data-id="${t.id}">${icon('pause', 16)} ${t.status === 'waiting' ? 'إلغاء «بانتظار رد»' : 'بانتظار رد من جهة أخرى'}</button>
          <button data-action="edit-task" data-id="${t.id}">${icon('edit', 16)} تعديل</button>
          <hr><button class="danger" data-action="cancel-task" data-id="${t.id}">${icon('x', 16)} إلغاء المتابعة</button>`
        : html`<hr><button class="danger" data-action="auto-close" data-id="${t.id}">${icon('x', 16)} إغلاق بدون إجراء</button>`}
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
        <button class="tab ${ui.fuShow === 'open' ? 'active' : ''}" data-action="fu-show" data-v="open">المفتوحة</button>
        <button class="tab ${ui.fuShow === 'done' ? 'active' : ''}" data-action="fu-show" data-v="done">المنجزة (30 يوماً)</button>
      </div>
      <label class="search-box"><input class="input" type="search" placeholder="بحث بالاسم أو رقم الملف أو المهمة" value="${ui.fuQuery}" data-input="fu-q" data-key="fu-q">${icon('search', 16)}</label>
      <select class="input" style="width:auto" data-change="fu-doctor" aria-label="الطبيب">
        <option value="ALL">كل الأطباء</option>${doctors.map((d) => html`<option ${ui.fuDoctor === d ? 'selected' : ''}>${d}</option>`)}
      </select>
      <span class="spacer"></span>
      <button class="btn" data-action="print-fu">${icon('print')} طباعة</button>
      <button class="btn btn-primary" data-action="new-followup">${icon('plus')} متابعة جديدة</button>
    </div>
    <div class="tabs">
      <button class="tab ${ui.fuType === 'ALL' ? 'active' : ''}" data-action="fu-type" data-v="ALL">الكل <span class="n">${Object.values(typeCounts).reduce((a, b) => a + b, 0)}</span></button>
      ${FU_TYPES.filter((t) => typeCounts[t.v]).map((t) => html`<button class="tab ${ui.fuType === t.v ? 'active' : ''}" data-action="fu-type" data-v="${t.v}">${t.l} <span class="n">${typeCounts[t.v]}</span></button>`)}
    </div>`;

  if (ui.fuShow === 'done') {
    tasks.sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
    return html`${toolbar}
      <div class="panel">${tasks.length ? html`<ul class="mini-list">${tasks.map((t) => html`
        <li><div>
          <div><span class="chip ${t.status === 'done' ? 'green' : ''}">${t.status === 'done' ? 'أُنجزت' : 'أُلغيت'}</span> <span class="chip outline">${fuLabel(t.type)}</span> <strong>${t.title}</strong></div>
          <div class="task-meta"><button class="patient-link" data-action="open-patient" data-id="${t.patientId}">${t.p.name}</button><span class="mrn">${t.p.mrn}</span><span>${fmtTime(t.closedAt)}</span></div>
          <div class="small" style="margin-top:4px">${t.outcome}</div>
        </div>
        ${t.status === 'done' ? html`<button class="btn btn-sm btn-ghost" data-action="reopen-task" data-id="${t.id}">${icon('undo', 16)} إعادة فتح</button>` : ''}</li>`)}</ul>`
        : html`<div class="empty"><strong>لا يوجد شيء هنا</strong>المتابعات المنجزة خلال آخر 30 يوماً تظهر في هذه القائمة.</div>`}</div>`;
  }

  const groups = [
    { k: 'over', l: 'متأخرة', test: (t) => t.dueDate && t.dueDate < today },
    { k: 'today', l: 'مستحقة اليوم', test: (t) => t.dueDate === today },
    { k: 'week', l: 'خلال الأيام السبعة القادمة', test: (t) => t.dueDate > today && t.dueDate <= addDays(today, 7) },
    { k: 'later', l: 'لاحقاً', test: (t) => t.dueDate > addDays(today, 7) },
    { k: 'none', l: 'بدون تاريخ استحقاق', test: (t) => !t.dueDate },
  ];
  tasks.sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')) || (a.status === 'waiting') - (b.status === 'waiting'));
  const body = groups.map((g) => {
    const rows = tasks.filter(g.test);
    if (!rows.length) return '';
    return html`<section class="fu-group"><h3>${g.k === 'over' ? icon('alert', 16) : ''}${g.l} <span class="chip ${g.k === 'over' ? 'red' : g.k === 'today' ? 'amber' : ''}">${rows.length}</span></h3>${rows.map((t) => taskRow(t))}</section>`;
  });
  return html`${toolbar}
    ${tasks.length ? body : html`<div class="panel empty"><strong>لا توجد متابعات مفتوحة</strong>أضف متابعة من ملف المريض، أو من قرار اللجنة، أو من زر «متابعة جديدة».</div>`}`;
}

// ---------- actions ----------
const typeOptions = (sel) => FU_TYPES.map((t) => html`<option value="${t.v}" ${sel === t.v ? 'selected' : ''}>${t.l}</option>`);

export async function newFollowup({ patientId = '', sourceType = 'manual', sourceId = '', type = '', title = '' } = {}) {
  const due = addDays(todayISO(), Number(settings.get('followupDays')) || 3);
  const data = await modal({
    title: 'متابعة جديدة',
    body: html`
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        <label class="field"><span>النوع</span><select name="type" required><option value="">اختر…</option>${typeOptions(type)}</select></label>
        <label class="field"><span>تاريخ الاستحقاق</span><input type="date" name="dueDate" value="${due}"></label>
        <label class="field span-2"><span>المطلوب</span><textarea name="title" placeholder="مثال: إرسال التحويل لقسم الأشعة وتأكيد الموعد">${title}</textarea></label>
      </div>`,
    onMount: (dlg) => mountPatientPicker(dlg),
    validate: (d) => validatePicker(d) || (!d.type ? 'اختر نوع المتابعة.' : !d.title ? 'اكتب المطلوب في هذه المتابعة.' : null),
  });
  if (!data) return;
  const r = resolvePatient(data);
  if (r.error) { toast(r.error, { type: 'error' }); return; }
  create('followups', { patientId: r.id, sourceType, sourceId, type: data.type, title: data.title, dueDate: data.dueDate, status: 'open', outcome: '', closedAt: '' });
  toast('أُضيفت المتابعة');
}

async function finishTask(id) {
  const t = enrich(findTask(id));
  const data = await modal({
    title: 'إنهاء المتابعة',
    body: html`
      <div class="panel" style="padding:10px 12px"><span class="chip outline">${fuLabel(t.type)}</span> ${t.title}<div class="small muted">${t.p.name} — ${t.p.mrn}</div></div>
      <label class="field"><span>ما الذي تمّ؟</span><textarea name="outcome" placeholder="مثال: أُرسل التحويل وحُدّد موعد الأشعة يوم الأحد، وتم إبلاغ المريض" autofocus></textarea>
        <span class="hint">يُحفظ في ملف المريض ضمن سجل المتابعات.</span></label>
      ${t.sourceType === 'visit' && t.src && t.src.notified !== 'Y' ? html`<label class="check"><input type="checkbox" name="markNotified" checked> وضع علامة «تم التبليغ» على زيارة ${fmtDate(t.src.sessionDate)}</label>` : ''}`,
    primary: 'إنهاء',
    validate: (d) => (!d.outcome ? 'اكتب ما تمّ لإغلاق هذه المتابعة.' : null),
  });
  if (!data) return;
  batch(() => {
    upsert('followups', { id, status: 'done', outcome: data.outcome, closedAt: new Date().toISOString() }, { summary: `أُنجزت: ${t.title}` });
    if (data.markNotified) upsert('visits', { id: t.src.id, notified: 'Y' });
  });
  toast('أُغلقت المتابعة', { undo: () => upsert('followups', { id, status: 'open', outcome: '', closedAt: '' }, { summary: 'إعادة فتح' }) });
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
    title: 'تسجيل محاولة تواصل',
    body: html`
      <div class="row-between panel" style="padding:10px 12px"><div><strong>${t.p.name}</strong> <span class="mrn">${t.p.mrn}</span></div><div>${icon('phone', 15)} ${telLink(t.p.phone)}</div></div>
      <fieldset class="field" style="border:0; padding:0; margin:0"><span class="field-label">النتيجة</span>
        <div class="row">${ATTEMPT_RESULTS.map((r, i) => html`<label class="check chip outline" style="padding:6px 12px"><input type="radio" name="result" value="${r.v}" ${i === 0 ? 'checked' : ''}> ${r.l}</label>`)}</div>
      </fieldset>
      <label class="field"><span>ملاحظة</span><input name="note" placeholder="اختياري"></label>
      <label class="field"><span>المحاولة التالية</span><input type="date" name="next" value="${addDays(todayISO(), 1)}"></label>`,
    primary: 'تسجيل',
  });
  if (!data) return;
  const attempt = { at: new Date().toISOString(), result: data.result, note: data.note };
  batch(() => {
    const row = t0.auto ? materialize(t0) : t0;
    upsert('followups', { id: row.id, attempts: [...(row.attempts || []), attempt], dueDate: data.next || row.dueDate }, { summary: `محاولة تواصل: ${attemptLabel(data.result)}` });
    if (data.result === 'WRONG') upsert('patients', { id: t.patientId, phoneFlag: 'wrong' }, { summary: 'أُبلغ أن رقم الهاتف خاطئ' });
  });
  toast(data.result === 'WRONG' ? 'سُجّلت المحاولة، وأُضيف الرقم لقائمة تصحيح البيانات' : 'سُجّلت المحاولة');
}

async function snoozeTask(id) {
  const t0 = findTask(id);
  const data = await modal({
    title: 'تأجيل الاستحقاق',
    body: html`<div class="row">${[1, 2, 7].map((n) => html`<button type="button" class="btn btn-sm" data-days="${n}">${n === 1 ? 'غداً' : n === 2 ? 'بعد يومين' : 'بعد أسبوع'}</button>`)}</div>
      <label class="field"><span>التاريخ الجديد</span><input type="date" name="dueDate" value="${addDays(todayISO(), 1)}"></label>`,
    onMount: (dlg) => dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-days]'); if (b) dlg.querySelector('[name=dueDate]').value = addDays(todayISO(), +b.dataset.days); }),
  });
  if (!data?.dueDate) return;
  const row = t0.auto ? materialize(t0) : t0;
  upsert('followups', { id: row.id, dueDate: data.dueDate }, { summary: `تأجيل إلى ${data.dueDate}` });
}

async function editTask(id) {
  const f = get('followups', id);
  const data = await modal({
    title: 'تعديل المتابعة',
    body: html`<div class="grid-2">
      <label class="field"><span>النوع</span><select name="type">${typeOptions(f.type)}</select></label>
      <label class="field"><span>تاريخ الاستحقاق</span><input type="date" name="dueDate" value="${f.dueDate}"></label>
      <label class="field span-2"><span>المطلوب</span><textarea name="title">${f.title}</textarea></label></div>`,
    validate: (d) => (!d.title ? 'اكتب المطلوب.' : null),
  });
  if (data) upsert('followups', { id, ...data });
}

async function cancelTask(id) {
  const data = await modal({ title: 'إلغاء المتابعة', body: html`<label class="field"><span>سبب الإلغاء</span><input name="reason" autofocus></label>`, primary: 'إلغاء المتابعة', secondary: 'رجوع', danger: true, validate: (d) => (!d.reason ? 'اكتب سبب الإلغاء.' : null) });
  if (!data) return;
  upsert('followups', { id, status: 'cancelled', outcome: data.reason, closedAt: new Date().toISOString() });
  toast('أُلغيت المتابعة', { undo: () => upsert('followups', { id, status: 'open', outcome: '', closedAt: '' }) });
}

async function autoBook(id) {
  const t = findTask(id);
  const data = await modal({ title: 'موعد العيادة القادم', body: html`<label class="field"><span>التاريخ</span><input type="date" name="opcDate" min="${todayISO()}" autofocus></label>`, validate: (d) => (!d.opcDate ? 'اختر التاريخ.' : null) });
  if (data) { upsert('visits', { id: t.sourceId, opcDate: data.opcDate }); toast('حُفظ الموعد — المهمة التالية: تبليغ المريض'); }
}

function printList() {
  const tasks = openTasks().map(enrich).filter((t) => (ui.fuType === 'ALL' || t.type === ui.fuType) && (ui.fuDoctor === 'ALL' || t.physician === ui.fuDoctor));
  tasks.sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
  printTable({
    title: 'قائمة المتابعات المفتوحة',
    subtitle: [ui.fuType !== 'ALL' ? fuLabel(ui.fuType) : '', ui.fuDoctor !== 'ALL' ? `د. ${ui.fuDoctor}` : ''].filter(Boolean).join(' — '),
    columns: [{ label: 'المريض' }, { label: 'رقم الملف' }, { label: 'الهاتف' }, { label: 'النوع' }, { label: 'المطلوب', width: '32%' }, { label: 'الطبيب' }, { label: 'الاستحقاق' }, { label: 'ملاحظات', width: '14%' }],
    rows: tasks.map((t) => [t.p.name, t.p.mrn, t.p.phone, fuLabel(t.type), t.title, t.physician, t.dueDate ? fmtDate(t.dueDate) : '—', '']),
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
  'reopen-task': (el) => upsert('followups', { id: el.dataset.id, status: 'open', outcome: '', closedAt: '' }, { summary: 'إعادة فتح' }),
  'auto-notified': (el) => { const t = findTask(el.dataset.id); upsert('visits', { id: t.sourceId, notified: 'Y' }, { summary: 'تم تبليغ المريض بالموعد' }); toast('سُجّل التبليغ', { undo: () => upsert('visits', { id: t.sourceId, notified: 'N' }) }); },
  'auto-book': (el) => autoBook(el.dataset.id),
  'auto-close': (el) => { const t = findTask(el.dataset.id); upsert('visits', { id: t.sourceId, autoClosed: '1' }, { summary: 'أُغلقت المهمة التلقائية بدون إجراء' }); toast('أُغلقت المهمة', { undo: () => upsert('visits', { id: t.sourceId, autoClosed: '' }) }); },
  'fu-show': (el) => { ui.fuShow = el.dataset.v; },
  'fu-type': (el) => { ui.fuType = el.dataset.v; },
  'print-fu': () => printList(),
});
registerChanges({
  'fu-doctor': (el) => { ui.fuDoctor = el.value; },
  'fu-q': (el) => { ui.fuQuery = el.value; },
});
