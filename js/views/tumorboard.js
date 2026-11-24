// Tumor board: patients discussed at the tumor board, each with a brief history, the
// discussion points, and a checklist of follow-up tasks (referral, permit, clinic booking,
// imaging, labs…). Idea taken from the department's earlier tumor board app; here every
// entry is linked to the patient's record, and every task is a normal follow-up
// (sourceType 'tumorboard'), so it also shows on the Follow-ups page with due dates,
// call attempts and a required outcome — and each task is its own row, safe to edit
// from several devices at once.
import { html, esc, todayISO, addDays, fmtDate, fmtTime, matchesQuery, uniq, byText, cleanName, cleanPhysician, normMrn, readFileAs, count } from '../util.js';
import { idx, patient, get, create, upsert, remove, restore, batch, store } from '../store.js';
import { api } from '../api.js';
import { TB_TASKS, TB_STATUS, fuLabel } from '../rules.js';
import { icon, modal, toast, confirmBox, menu, dueChip, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker, physicianFieldHTML, mountPhysicianField, readPhysician } from '../ui.js';
import { printTable } from '../print.js';
import { parseText, parseHTML, loadMammoth } from '../wordimport.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('لجنة الأورام (Tumor Board)', 'Tumor Board');

const patientsText = (n) => count(n, ['مريض واحد', 'مريضان', 'مرضى', 'مريض'], ['patient', 'patients']);
const OPEN = (f) => f.status === 'open' || f.status === 'waiting';

// The server must know the TumorBoard sheet (new Code.gs) before entries can be saved.
export function boardAvailable() {
  return api.mode() === 'local' || (Array.isArray(store.serverTables) && store.serverTables.includes('tumorboard'));
}

export function tasksOf(entry) {
  return (idx().followupsBy.get(entry.patientId) || []).filter((f) => f.sourceType === 'tumorboard' && f.sourceId === entry.id)
    .sort((a, b) => OPEN(b) - OPEN(a) || String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
}
export const openTasksOf = (entry) => tasksOf(entry).filter(OPEN);

function stage(e) {
  if (e.status === 'closed') return 'closed';
  const all = tasksOf(e).filter((f) => f.status !== 'cancelled');
  if (!all.length) return 'none';
  return all.some(OPEN) ? 'open' : 'done';
}

const FILTERS = () => [
  ['active', tr('قيد المتابعة', 'Active')],
  ['open', tr('لديها مهام مفتوحة', 'Open tasks')],
  ['done', tr('كل المهام منجزة', 'All tasks done')],
  ['none', tr('بدون مهام', 'No tasks')],
  ['closed', tr('مُغلقة', 'Closed')],
  ['all', tr('الكل', 'All')],
];

let focusId = '';
export function onRoute(params) {
  const id = params.get('focus');
  if (id && get('tumorboard', id)) { focusId = id; ui.tbFilter = 'all'; ui.tbQuery = ''; ui.tbDoctor = 'ALL'; }
}
export function mount(root) {
  if (!focusId) return;
  const el = root.querySelector(`[data-row="${CSS.escape(focusId)}"]`);
  focusId = '';
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
}

function visibleEntries() {
  const f = ui.tbFilter;
  return idx().lists.tumorboard
    .filter((e) => {
      const s = stage(e);
      if (f === 'all') return true;
      if (f === 'active') return s !== 'closed';
      return s === f;
    })
    .filter((e) => ui.tbDoctor === 'ALL' || (e.physician || '') === ui.tbDoctor)
    .filter((e) => { const p = patient(e.patientId) || {}; return matchesQuery(ui.tbQuery, p.name, p.mrn, e.physician, e.briefHistory, e.discussion); })
    .sort((a, b) => byText(a.physician || '', b.physician || '') || String(b.boardDate || '').localeCompare(String(a.boardDate || '')) || byText((patient(a.patientId) || {}).name || '', (patient(b.patientId) || {}).name || ''));
}

function taskLine(f) {
  const open = OPEN(f);
  return html`
    <li class="tb-task ${open ? '' : 'is-closed'}">
      <div>
        <div><span class="chip ${f.status === 'done' ? 'green' : f.status === 'cancelled' ? '' : 'outline'}">${f.status === 'done' ? '✓' : f.status === 'cancelled' ? '✗' : '○'} ${fuLabel(f.type)}</span> <strong>${f.title}</strong></div>
        <div class="small muted">
          ${open ? html`${dueChip(f.dueDate, f.status)} ${f.dueDate ? fmtDate(f.dueDate, 'med') : tr('بدون تاريخ', 'no due date')}` : html`${f.status === 'done' ? tr('أُنجزت', 'Done') : tr('أُلغيت', 'Cancelled')} ${fmtTime(f.closedAt)}${f.outcome ? ` — ${f.outcome}` : ''}`}
          ${(f.attempts || []).length ? ` · ${(f.attempts || []).length} ${tr('محاولة', 'attempt(s)')}` : ''}
        </div>
      </div>
      <div class="task-actions">
        ${open ? html`
          <button class="btn btn-sm btn-primary" data-action="finish-task" data-id="${f.id}">${icon('check', 15)} ${tr('إنهاء', 'Complete')}</button>
          ${menu(html`
            <button data-action="attempt-task" data-id="${f.id}">${icon('phone', 16)} ${tr('محاولة تواصل', 'Call attempt')}</button>
            <button data-action="snooze-task" data-id="${f.id}">${icon('clock', 16)} ${tr('تأجيل الاستحقاق', 'Snooze')}</button>
            <button data-action="edit-task" data-id="${f.id}">${icon('edit', 16)} ${tr('تعديل', 'Edit')}</button>
            <hr><button class="danger" data-action="cancel-task" data-id="${f.id}">${icon('x', 16)} ${tr('إلغاء المهمة', 'Cancel task')}</button>`)}`
        : f.status === 'done' ? html`<button class="btn btn-sm btn-ghost" data-action="reopen-task" data-id="${f.id}">${icon('undo', 15)} ${tr('إعادة فتح', 'Reopen')}</button>` : ''}
      </div>
    </li>`;
}

function entryCard(e) {
  const p = patient(e.patientId) || {};
  const s = stage(e);
  const tasks = tasksOf(e);
  const open = tasks.filter(OPEN).length;
  const live = tasks.filter((f) => f.status !== 'cancelled').length;
  const closed = e.status === 'closed';
  const ta = (field, label, ph) => html`
    <label class="field"><span>${label}</span>
      <textarea dir="auto" class="cell-input" style="border-color:var(--line)" data-change="tb-field" data-id="${e.id}" data-field="${field}" data-key="tb-${e.id}-${field}" placeholder="${ph}">${e[field] || ''}</textarea></label>`;
  return html`
  <article class="case" data-stage="tb-${s}" data-row="${e.id}">
    <div class="case-no" aria-hidden="true"></div>
    <div>
      <div class="case-top">
        <div>
          <button class="patient-link case-name" data-action="open-patient" data-id="${e.patientId}">${p.name || tr('مريض غير معروف', 'Unknown patient')}</button>
          <span class="mrn">${p.mrn || tr('بدون رقم ملف', 'no file number')}</span>
          <div class="small muted">${e.physician ? dr(e.physician) : tr('بدون طبيب', 'No doctor')}${p.age ? ` · ${p.age} ${tr('سنة', 'yrs')}` : ''}${e.boardDate ? ` · ${tr('نوقش في', 'discussed')} ${fmtDate(e.boardDate, 'med')}` : ''}</div>
          <div class="row" style="margin-top:6px">
            ${closed ? html`<span class="chip">${TB_STATUS.closed.l}</span>` : ''}
            ${live === 0 ? html`<span class="chip">${tr('بدون مهام', 'No tasks')}</span>` : open === 0 ? html`<span class="chip green">${tr(`كل المهام منجزة (${live})`, `All ${live} done`)}</span>` : html`<span class="chip amber">${tr(`${open} من ${live} مفتوحة`, `${open} of ${live} open`)}</span>`}
          </div>
        </div>
        <div class="case-actions">
          ${!closed ? html`<button class="btn btn-sm btn-primary" data-action="tb-add-task" data-id="${e.id}">${icon('plus', 16)} ${tr('مهمة', 'Task')}</button>` : ''}
          <button class="btn btn-sm" data-action="tb-print-one" data-id="${e.id}">${icon('print', 16)}</button>
          ${menu(html`
            <button data-action="open-patient" data-id="${e.patientId}">${icon('user', 16)} ${tr('ملف المريض', 'Patient record')}</button>
            <button data-action="tb-edit" data-id="${e.id}">${icon('edit', 16)} ${tr('تعديل الطبيب والتاريخ', 'Change doctor or date')}</button>
            ${closed ? html`<button data-action="tb-reopen" data-id="${e.id}">${icon('undo', 16)} ${tr('إعادة فتح', 'Reopen')}</button>`
              : html`<button data-action="tb-close" data-id="${e.id}">${icon('check', 16)} ${tr('إغلاق الحالة', 'Close case')}</button>`}
            <hr><button class="danger" data-action="tb-delete" data-id="${e.id}">${icon('trash', 16)} ${tr('حذف', 'Delete')}</button>`)}
        </div>
      </div>
      <div class="case-fields">
        ${ta('briefHistory', tr('التشخيص / القصة المرضية', 'Diagnosis / brief history'), tr('التشخيص، المرحلة، العلاجات السابقة…', 'Diagnosis, stage, previous treatment…'))}
        ${ta('discussion', tr('نقاط النقاش / توصيات اللجنة', 'Discussion points / board recommendation'), tr('ما نوقش وما أوصت به اللجنة…', 'What was discussed and recommended…'))}
      </div>
      ${tasks.length ? html`<ul class="tb-tasks">${tasks.map(taskLine)}</ul>` : ''}
    </div>
  </article>`;
}

export function render() {
  const all = idx().lists.tumorboard;
  const entries = visibleEntries();
  const doctors = uniq(all.map((e) => e.physician || '')).filter(Boolean).sort(byText);
  const counts = {};
  for (const e of all) { const s = stage(e); counts[s] = (counts[s] || 0) + 1; }
  counts.active = all.length - (counts.closed || 0);
  counts.all = all.length;
  const groups = new Map();
  for (const e of entries) { const k = e.physician || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  const can = boardAvailable();

  return html`
    ${!can ? html`<div class="panel warn-text" style="padding:12px 16px; margin-bottom:14px">${tr('لجنة الأورام تحتاج نشر ملف backend/Code.gs الجديد على Apps Script (Deploy ← Manage deployments ← Edit ← New version). حتى ذلك الحين لا يمكن إضافة مرضى هنا.', 'The tumor board needs the new backend/Code.gs deployed to Apps Script (Deploy → Manage deployments → Edit → New version). Until then patients cannot be added here.')}</div>` : ''}
    <div class="toolbar">
      <label class="search-box"><input class="input" type="search" placeholder="${tr('الاسم، رقم الملف، الطبيب، التشخيص', 'Name, file number, doctor, diagnosis')}" value="${ui.tbQuery}" data-input="tb-q" data-key="tb-q">${icon('search', 16)}</label>
      <select class="input" style="width:auto" data-change="tb-doctor" aria-label="${tr('الطبيب', 'Doctor')}">
        <option value="ALL">${tr('كل الأطباء', 'All doctors')}</option>${doctors.map((d) => html`<option value="${d}" ${ui.tbDoctor === d ? 'selected' : ''}>${dr(d)}</option>`)}
      </select>
      <span class="spacer"></span>
      <button class="btn" data-action="tb-print" ${entries.length ? '' : 'disabled'}>${icon('print')} ${tr('طباعة اللجنة', 'Print board')}</button>
      <button class="btn" data-action="tb-import" ${can ? '' : 'disabled'}>${icon('upload')} ${tr('استيراد من Word', 'Import from Word')}</button>
      <button class="btn btn-primary" data-action="tb-add" ${can ? '' : 'disabled'}>${icon('plus')} ${tr('إضافة مريض', 'Add patient')}</button>
    </div>
    <div class="tabs">
      ${FILTERS().map(([k, l]) => html`<button class="tab ${ui.tbFilter === k ? 'active' : ''}" data-action="tb-filter" data-v="${k}">${l} <span class="n">${counts[k] || 0}</span></button>`)}
    </div>
    ${entries.length ? html`<div class="agenda">${[...groups].map(([doc, rows]) => html`
        ${ui.tbDoctor === 'ALL' ? html`<div class="agenda-group">${doc ? dr(doc) : tr('بدون طبيب', 'No doctor')} — ${patientsText(rows.length)}</div>` : ''}${rows.map(entryCard)}`)}</div>`
      : html`<div class="panel empty"><strong>${all.length ? tr('لا يوجد مرضى مطابقون', 'No patients match') : tr('لا يوجد مرضى في لجنة الأورام بعد', 'No tumor board patients yet')}</strong>${all.length ? tr('غيّر الفلتر أو البحث.', 'Change the filter or the search.') : tr('أضف المرضى واحداً واحداً، أو استورد قائمة اللجنة من ملف Word.', 'Add patients one by one, or import the board list from Word.')}</div>`}`;
}

// ---------- add / edit ----------
function activeEntryFor(patientId) {
  return idx().lists.tumorboard.find((e) => e.patientId === patientId && e.status !== 'closed');
}

export async function addToBoard({ patientId = '' } = {}) {
  if (!boardAvailable()) { toast(tr('انشر ملف Code.gs الجديد أولاً.', 'Deploy the new Code.gs first.'), { type: 'error' }); return; }
  const p0 = patientId && patient(patientId);
  const data = await modal({
    title: tr('إضافة مريض للجنة الأورام', 'Add patient to the tumor board'),
    size: 'l',
    body: html`
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        ${physicianFieldHTML({ value: p0?.physician })}
        <label class="field"><span>${tr('تاريخ النقاش في اللجنة', 'Date discussed')}</span><input type="date" name="boardDate" value="${todayISO()}"></label>
        <label class="field span-2"><span>${tr('التشخيص / القصة المرضية', 'Diagnosis / brief history')}</span><textarea dir="auto" name="briefHistory">${p0?.diagnosis || ''}</textarea></label>
        <label class="field span-2"><span>${tr('نقاط النقاش / توصيات اللجنة', 'Discussion points / board recommendation')}</span><textarea dir="auto" name="discussion"></textarea></label>
      </div>`,
    primary: tr('إضافة', 'Add'),
    onMount: (dlg) => {
      mountPatientPicker(dlg);
      mountPhysicianField(dlg);
      dlg.addEventListener('picked', (ev) => {
        const p = ev.detail || {};
        const hist = dlg.querySelector('[name=briefHistory]');
        if (!hist.value.trim() && p.diagnosis) hist.value = p.diagnosis;
        // Pre-fill the doctor from the patient's record when none is chosen yet.
        const sel = dlg.querySelector('select[name=physician]');
        const doc = cleanPhysician(p.physician || '');
        if (sel && !sel.value && doc) {
          const known = [...sel.options].find((o) => o.value.toLowerCase() === doc.toLowerCase());
          if (known) sel.value = known.value;
          else { sel.value = '__other'; const other = dlg.querySelector('[name=physicianOther]'); other.hidden = false; other.value = doc; }
        }
      });
    },
    validate: (d) => validatePicker(d) || (d.patientId && activeEntryFor(d.patientId) ? tr('هذا المريض موجود في لجنة الأورام وحالته مفتوحة.', 'This patient is already on the tumor board with an open case.') : null),
  });
  if (!data) return;
  const r = resolvePatient(data);
  if (r.error) { toast(r.error, { type: 'error' }); return; }
  const row = create('tumorboard', { patientId: r.id, physician: readPhysician(data), boardDate: data.boardDate || todayISO(), briefHistory: data.briefHistory.trim(), discussion: data.discussion.trim(), status: 'active', notes: '' });
  toast(tr('أُضيف المريض للجنة الأورام', 'Added to the tumor board'));
  focusId = row.id;
}

async function editEntry(id) {
  const e = get('tumorboard', id);
  const data = await modal({
    title: tr('تعديل الطبيب والتاريخ', 'Change doctor or date'),
    body: html`<div class="grid-2">${physicianFieldHTML({ value: e.physician })}
      <label class="field"><span>${tr('تاريخ النقاش', 'Date discussed')}</span><input type="date" name="boardDate" value="${e.boardDate || ''}"></label></div>`,
    onMount: (dlg) => mountPhysicianField(dlg),
  });
  if (data) upsert('tumorboard', { id, physician: readPhysician(data), boardDate: data.boardDate });
}

async function addTask(id) {
  const e = get('tumorboard', id);
  const p = patient(e.patientId) || {};
  const due = addDays(todayISO(), 3);
  const data = await modal({
    title: `${tr('مهمة متابعة', 'Follow-up task')} — ${p.name || ''}`,
    body: html`
      <div class="grid-2">
        <label class="field"><span>${tr('المهمة', 'Task')}</span><select name="kind">${TB_TASKS.map((t) => html`<option value="${t.v}">${t.l}</option>`)}</select></label>
        <label class="field"><span>${tr('تاريخ الاستحقاق', 'Due date')}</span><input type="date" name="dueDate" value="${due}"></label>
        <label class="field span-2" data-clinic hidden><span>${tr('العيادة', 'Clinic')}</span><input name="clinic" placeholder="${tr('مثال: الأشعة، الجراحة…', 'e.g. Radiotherapy, Surgery…')}"></label>
        <label class="field span-2" data-other hidden><span>${tr('عنوان المهمة', 'Task title')}</span><input name="title"></label>
        <label class="field span-2"><span>${tr('ملاحظة', 'Note')}</span><input name="note" placeholder="${tr('اختياري', 'Optional')}"></label>
      </div>
      <label class="check"><input type="checkbox" name="another"> ${tr('إضافة مهمة أخرى بعد الحفظ', 'Add another task after saving')}</label>`,
    primary: tr('إضافة المهمة', 'Add task'),
    onMount: (dlg) => {
      const sel = dlg.querySelector('[name=kind]');
      const sync = () => {
        const t = TB_TASKS.find((x) => x.v === sel.value);
        dlg.querySelector('[data-clinic]').hidden = !t.needsClinic;
        dlg.querySelector('[data-other]').hidden = !t.needsTitle;
      };
      sel.addEventListener('change', sync); sync();
    },
    validate: (d) => (d.kind === 'other' && !d.title.trim() ? tr('اكتب عنوان المهمة.', 'Write the task title.') : null),
  });
  if (!data) return;
  const t = TB_TASKS.find((x) => x.v === data.kind);
  let title = t.needsTitle ? data.title.trim() : t.l;
  if (t.needsClinic && data.clinic.trim()) title = `${title} - ${data.clinic.trim()}`;
  if (data.note.trim()) title = `${title}\n${data.note.trim()}`;
  create('followups', { patientId: e.patientId, sourceType: 'tumorboard', sourceId: e.id, type: t.fu, title, dueDate: data.dueDate, status: 'open', outcome: '', closedAt: '', attempts: [] });
  toast(tr('أُضيفت المهمة — تظهر أيضاً في صفحة المتابعات', 'Task added — it also shows on the Follow-ups page'));
  if (data.another) addTask(id);
}

// ---------- import from Word ----------
async function importWord() {
  if (!boardAvailable()) return;
  let parsed = [];
  const data = await modal({
    title: tr('استيراد قائمة لجنة الأورام من Word', 'Import the tumor board list from Word'),
    size: 'xl',
    body: html`
      <p class="small muted">${tr('ارفع ملف ‎.docx‎ (يُقرأ أول جدول فيه)، أو انسخ الجدول من Word والصقه. الأعمدة المتوقعة: #، رقم الملف، القصة المرضية، الطبيب، نقاط النقاش.', 'Upload the .docx (its first table is read), or copy the table from Word and paste it. Expected columns: #, file number, brief history, physician, discussion points.')}</p>
      <div class="grid-2">
        <label class="field"><span>${tr('ملف Word', 'Word file')}</span><input type="file" accept=".docx" data-docx class="input"></label>
        <label class="field"><span>${tr('…أو الصق الجدول هنا', '…or paste the table here')}</span><textarea data-paste rows="4"></textarea>
          <button type="button" class="btn btn-sm" data-parse style="justify-self:start; margin-top:6px">${tr('قراءة النص الملصق', 'Read pasted text')}</button></label>
      </div>
      <label class="field" style="max-width:260px"><span>${tr('تاريخ اللجنة', 'Board date')}</span><input type="date" name="boardDate" value="${todayISO()}"></label>
      <div data-preview></div>`,
    primary: tr('استيراد المحدد', 'Import selected'),
    onMount: (dlg) => {
      const prev = dlg.querySelector('[data-preview]');
      const show = (list) => {
        parsed = list.map((r) => {
          const mrn = normMrn(r.fileNumber);
          const p = mrn ? idx().byMrn.get(mrn)?.[0] : null;
          return { ...r, mrn, patient: p, onBoard: !!(p && activeEntryFor(p.id)) };
        });
        prev.innerHTML = parsed.length ? `<p class="small" style="margin:6px 0"><b>${parsed.length}</b> ${esc(tr('مريض في الملف. راجع الأسماء ثم استورد.', 'patients found. Check the names, then import.'))}</p>
          <div class="preview"><table class="data"><thead><tr><th></th><th>${esc(tr('الاسم', 'Name'))}</th><th>${esc(tr('رقم الملف', 'File no.'))}</th><th>${esc(tr('الطبيب', 'Doctor'))}</th><th>${esc(tr('القصة المرضية', 'Brief history'))}</th><th>${esc(tr('الحالة', 'Status'))}</th></tr></thead><tbody>
          ${parsed.map((r, i) => `<tr>
            <td><input type="checkbox" name="pick${i}" ${r.onBoard ? '' : 'checked'} aria-label="${i + 1}"></td>
            <td>${r.patient ? `<strong>${esc(r.patient.name)}</strong>` : `<input class="cell-input" name="name${i}" placeholder="${esc(tr('اسم المريض', 'Patient name'))}" value="">`}</td>
            <td class="ltr">${esc(r.mrn || '—')}</td>
            <td>${esc(cleanPhysician(r.physician) || '—')}</td>
            <td class="small" style="max-width:340px; white-space:pre-wrap">${esc(r.diagnosis)}</td>
            <td>${r.onBoard ? `<span class="chip amber">${esc(tr('موجود في اللجنة', 'Already on the board'))}</span>` : r.patient ? `<span class="chip green">${esc(tr('مريض موجود', 'Existing patient'))}</span>` : `<span class="chip">${esc(tr('مريض جديد', 'New patient'))}</span>`}</td>
          </tr>`).join('')}</tbody></table></div>` : `<p class="warn-text">${esc(tr('لم يُعثر على مرضى. تأكد أن الجدول يبدأ برقم في العمود الأول.', 'No patients found. Make sure the table has a number in the first column.'))}</p>`;
      };
      dlg.querySelector('[data-docx]').addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        try {
          const mammoth = await loadMammoth();
          const res = await mammoth.convertToHtml({ arrayBuffer: await readFileAs(file) });
          show(parseHTML(res.value));
        } catch (err) { prev.innerHTML = `<p class="warn-text">${esc(tr('تعذّرت قراءة الملف: ', 'Could not read the file: '))}${esc(err.message)}</p>`; }
      });
      dlg.querySelector('[data-parse]').addEventListener('click', () => show(parseText(dlg.querySelector('[data-paste]').value)));
    },
    validate: (d) => {
      if (!parsed.length) return tr('ارفع الملف أو الصق الجدول أولاً.', 'Load a file or paste the table first.');
      const picked = parsed.map((r, i) => ({ r, i })).filter(({ i }) => d[`pick${i}`]);
      if (!picked.length) return tr('اختر مريضاً واحداً على الأقل.', 'Select at least one patient.');
      const noName = picked.find(({ r, i }) => !r.patient && !cleanName(d[`name${i}`]));
      return noName ? tr(`اكتب اسم المريض في الصف ${noName.i + 1}.`, `Enter the patient name in row ${noName.i + 1}.`) : null;
    },
  });
  if (!data) return;
  let added = 0; let created = 0;
  batch(() => {
    parsed.forEach((r, i) => {
      if (!data[`pick${i}`]) return;
      let pid = r.patient?.id;
      if (!pid) {
        const again = r.mrn ? idx().byMrn.get(r.mrn)?.[0] : null;   // created by an earlier row of this file
        pid = again ? again.id : create('patients', { name: cleanName(data[`name${i}`]), mrn: r.mrn, age: r.age || '', physician: cleanPhysician(r.physician), diagnosis: '' }, false).id;
        if (!again) created++;
      }
      if (activeEntryFor(pid)) return;
      create('tumorboard', { patientId: pid, physician: cleanPhysician(r.physician), boardDate: data.boardDate || todayISO(), briefHistory: r.diagnosis, discussion: r.discussion, status: 'active', notes: '' }, false);
      added++;
    });
  });
  toast(tr(`أُضيف ${added} للجنة الأورام (${created} مريض جديد)`, `Added ${added} to the tumor board (${created} new patients)`));
}

// ---------- printing ----------
const taskText = (f) => {
  const st = f.status === 'done' ? tr('منجزة', 'DONE') : f.status === 'cancelled' ? tr('ملغاة', 'CANCELLED') : f.dueDate && f.dueDate < todayISO() ? tr('متأخرة', 'OVERDUE') : tr('مفتوحة', 'OPEN');
  const due = OPEN(f) && f.dueDate ? ` · ${tr('الاستحقاق', 'due')} ${fmtDate(f.dueDate, 'med')}` : '';
  return `• ${f.title.split('\n')[0]} [${st}${due}]${f.outcome ? ` — ${f.outcome}` : ''}`;
};

function printRows(entries) {
  return entries.map((e) => {
    const p = patient(e.patientId) || {};
    const tasks = tasksOf(e).filter((f) => f.status !== 'cancelled');
    return [
      `${p.name || ''}\n${p.mrn || '—'}${p.age ? ` · ${p.age} ${tr('سنة', 'yrs')}` : ''}`,
      e.physician ? dr(e.physician) : '',
      e.briefHistory || '',
      e.discussion || '',
      tasks.length ? tasks.map(taskText).join('\n') : tr('بدون مهام', 'No tasks'),
    ];
  });
}
const PRINT_COLUMNS = () => [
  { label: tr('المريض', 'Patient'), width: '15%' },
  { label: tr('الطبيب', 'Doctor'), width: '9%' },
  { label: tr('التشخيص / القصة المرضية', 'Diagnosis / brief history'), width: '25%' },
  { label: tr('نقاط النقاش', 'Discussion points'), width: '23%' },
  { label: tr('مهام المتابعة', 'Follow-up tasks') },
];

function printBoard() {
  const entries = visibleEntries();
  const tasks = entries.flatMap(tasksOf);
  const t = todayISO();
  printTable({
    title: tr('لجنة الأورام — المرضى ومهام المتابعة', 'Tumor Board — patients & follow-up tasks'),
    subtitle: [FILTERS().find(([k]) => k === ui.tbFilter)?.[1], ui.tbDoctor !== 'ALL' ? dr(ui.tbDoctor) : ''].filter(Boolean).join(' — '),
    columns: PRINT_COLUMNS(),
    rows: printRows(entries),
    footer: tr(`${entries.length} مريض · ${tasks.filter(OPEN).length} مهمة مفتوحة · ${tasks.filter((f) => OPEN(f) && f.dueDate && f.dueDate < t).length} متأخرة · ${tasks.filter((f) => f.status === 'done').length} منجزة`,
      `${entries.length} patients · ${tasks.filter(OPEN).length} open tasks · ${tasks.filter((f) => OPEN(f) && f.dueDate && f.dueDate < t).length} overdue · ${tasks.filter((f) => f.status === 'done').length} done`),
  });
}

function printOne(id) {
  const e = get('tumorboard', id);
  const p = patient(e.patientId) || {};
  printTable({
    title: tr('تقرير متابعة لجنة الأورام', 'Tumor Board follow-up report'),
    subtitle: `${p.name || ''} — ${p.mrn || ''}`,
    columns: PRINT_COLUMNS(),
    rows: printRows([e]),
  });
}

registerActions({
  'tb-filter': (el) => { ui.tbFilter = el.dataset.v; },
  'tb-add': () => addToBoard(),
  'tb-add-patient': (el) => addToBoard({ patientId: el.dataset.patient || '' }),
  'tb-add-task': (el) => addTask(el.dataset.id),
  'tb-edit': (el) => editEntry(el.dataset.id),
  'tb-import': () => importWord(),
  'tb-print': () => printBoard(),
  'tb-print-one': (el) => printOne(el.dataset.id),
  'tb-close': (el) => { upsert('tumorboard', { id: el.dataset.id, status: 'closed' }, { summary: tr('أُغلقت حالة لجنة الأورام', 'Tumor board case closed') }); toast(tr('أُغلقت الحالة', 'Case closed'), { undo: () => upsert('tumorboard', { id: el.dataset.id, status: 'active' }) }); },
  'tb-reopen': (el) => upsert('tumorboard', { id: el.dataset.id, status: 'active' }, { summary: tr('أُعيد فتح حالة لجنة الأورام', 'Tumor board case reopened') }),
  'tb-delete': async (el) => {
    const e = get('tumorboard', el.dataset.id);
    const p = patient(e.patientId) || {};
    if (!(await confirmBox(tr(`حذف ${p.name || 'المريض'} من لجنة الأورام؟ مهام المتابعة تبقى في ملف المريض.`, `Remove ${p.name || 'this patient'} from the tumor board? Their follow-up tasks stay in the patient record.`), { title: tr('حذف من اللجنة', 'Remove from board'), confirm: tr('حذف', 'Delete'), danger: true }))) return;
    remove('tumorboard', e.id);
    toast(tr('حُذف من لجنة الأورام', 'Removed from the tumor board'), { undo: () => restore('tumorboard', e.id) });
  },
});
registerChanges({
  'tb-field': (el) => upsert('tumorboard', { id: el.dataset.id, [el.dataset.field]: el.value.trim() }),
  'tb-doctor': (el) => { ui.tbDoctor = el.value; },
  'tb-q': (el) => { ui.tbQuery = el.value; },
});
