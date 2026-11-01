// Post-clinic bookings: one list per session date, tabbed by physician, edited in place.
import { html, todayISO, addDays, fmtDate, matchesQuery, uniq, byText, isISODate, readFileAs } from '../util.js';
import { idx, patient, get, create, upsert, remove, restore, batch } from '../store.js';
import { suggestsCommittee } from '../rules.js';
import { icon, prevIcon, nextIcon, modal, toast, confirmBox, menu, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker, setPatientField, physicianFieldHTML, mountPhysicianField, readPhysician } from '../ui.js';
import { printTable } from '../print.js';
import { openImport } from '../importer.js';
import { api } from '../api.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('حجوزات ما بعد العيادة', 'Post-clinic bookings');

const docKey = (v) => v.physician || '';

export function onRoute(params) {
  if (isISODate(params.get('date'))) { ui.clinicDate = params.get('date'); ui.clinicDoctor = 'ALL'; }
  if (!ui.clinicDate) ui.clinicDate = todayISO();
}

const yn = (v) => (v === 'Y' ? tr('نعم', 'Yes') : v === 'N' ? tr('لا', 'No') : '');

function seg(v, field) {
  return html`<div class="seg" role="group">
    ${['Y', 'N'].map((x) => html`<button type="button" class="${(v[field] || '') === x ? `on-${x}` : ''}" data-action="visit-toggle" data-id="${v.id}" data-field="${field}" data-v="${x}" aria-pressed="${String(v[field] === x)}">${yn(x)}</button>`)}
  </div>`;
}

function visitRow(v) {
  const p = patient(v.patientId) || {};
  const sel = ui.clinicSelected.has(v.id);
  const inCommittee = (idx().committeeBy.get(v.patientId) || []).find((c) => c.sessionDate >= v.sessionDate && c.status !== 'withdrawn');
  const openFu = (idx().followupsBy.get(v.patientId) || []).filter((f) => f.status === 'open' || f.status === 'waiting').length;
  return html`
  <tr class="${sel ? 'selected' : ''}">
    <td><input type="checkbox" class="check" data-change="visit-select" data-id="${v.id}" ${sel ? 'checked' : ''} aria-label="${tr('تحديد', 'Select')}"></td>
    <td style="min-width:170px">
      <button class="patient-link" data-action="open-patient" data-id="${v.patientId}">${p.name || tr('بدون اسم', 'No name')}</button>
      <div class="mrn">${p.mrn || tr('بدون رقم', 'no number')}${p.age ? html` · <span>${p.age} ${tr('سنة', 'y')}</span>` : ''}</div>
      <div class="row" style="gap:4px; margin-top:3px">
        ${inCommittee ? html`<a class="chip accent" href="#/committee?date=${inCommittee.sessionDate}">${tr('لجنة', 'Committee')} ${fmtDate(inCommittee.sessionDate)}</a>` : ''}
        ${openFu ? html`<span class="chip amber">${openFu} ${tr('متابعة', 'follow-up')}</span>` : ''}
        ${v.noteUrl ? html`<a class="chip outline" href="${v.noteUrl}" target="_blank" rel="noopener">${icon('file', 12)} ${tr('مرفق', 'Attachment')}</a>` : ''}
      </div>
    </td>
    <td style="width:150px"><input class="cell-input ltr" style="min-width:130px" value="${p.phone || ''}" placeholder="${tr('أضف رقماً', 'Add number')}" inputmode="tel" data-change="patient-phone" data-id="${v.patientId}" data-key="ph-${v.id}" aria-label="${tr('الهاتف', 'Phone')}"></td>
    <td style="min-width:260px">
      <textarea class="cell-input" rows="1" placeholder="${tr('خطة العلاج…', 'Treatment plan…')}" data-change="visit-field" data-id="${v.id}" data-field="plan" data-key="plan-${v.id}" aria-label="${tr('خطة العلاج', 'Treatment plan')}">${v.plan || ''}</textarea>
      ${!inCommittee && suggestsCommittee(v.plan) ? html`<button class="btn btn-sm btn-ghost" style="color:var(--accent-ink)" data-action="visit-refer" data-id="${v.id}">${icon('send', 14)} ${tr('الخطة تذكر اللجنة — إدراجه؟', 'Plan mentions the committee — add?')}</button>` : ''}
    </td>
    <td style="width:160px"><input type="date" class="cell-input" style="min-width:145px" value="${v.opcDate || ''}" data-change="visit-field" data-id="${v.id}" data-field="opcDate" data-key="opc-${v.id}" aria-label="${tr('موعد العيادة', 'Clinic appointment')}"></td>
    <td>${seg(v, 'permit')}</td>
    <td>${seg(v, 'referral')}</td>
    <td style="text-align:center"><input type="checkbox" class="check" ${v.notified === 'Y' ? 'checked' : ''} data-change="visit-notified" data-id="${v.id}" aria-label="${tr('تم التبليغ', 'Notified')}" style="width:20px;height:20px"></td>
    <td>${menu(html`
      <button data-action="open-patient" data-id="${v.patientId}">${icon('user', 16)} ${tr('ملف المريض', 'Patient record')}</button>
      <button data-action="visit-refer" data-id="${v.id}">${icon('send', 16)} ${tr('إدراج في لجنة الحالات', 'Add to committee')}</button>
      <button data-action="visit-followup" data-id="${v.id}">${icon('plus', 16)} ${tr('متابعة جديدة', 'New follow-up')}</button>
      <button data-action="visit-attach" data-id="${v.id}">${icon('file', 16)} ${v.noteUrl ? tr('تغيير المرفق', 'Replace attachment') : tr('إرفاق صورة ملاحظة', 'Attach note image')}</button>
      <button data-action="visit-edit" data-id="${v.id}">${icon('edit', 16)} ${tr('تعديل الطبيب والتاريخ', 'Change doctor or date')}</button>
      <hr><button class="danger" data-action="visit-delete" data-id="${v.id}">${icon('trash', 16)} ${tr('حذف من القائمة', 'Remove from list')}</button>`)}</td>
  </tr>`;
}

export function render() {
  const date = ui.clinicDate;
  const all = idx().lists.visits.filter((v) => v.sessionDate === date);
  const doctors = uniq(all.map(docKey)).sort(byText);
  if (ui.clinicDoctor !== 'ALL' && !doctors.includes(ui.clinicDoctor)) ui.clinicDoctor = 'ALL';
  let rows = ui.clinicDoctor === 'ALL' ? all : all.filter((v) => docKey(v) === ui.clinicDoctor);
  const scope = rows;
  if (ui.clinicQuery) rows = rows.filter((v) => { const p = patient(v.patientId) || {}; return matchesQuery(ui.clinicQuery, p.name, p.mrn, v.plan); });
  rows.sort((a, b) => byText(a.physician, b.physician) || byText(patient(a.patientId)?.name || '', patient(b.patientId)?.name || ''));
  const n = (fn) => scope.filter(fn).length;
  const selected = [...ui.clinicSelected].filter((id) => get('visits', id) && !get('visits', id).deleted);

  return html`
    <div class="toolbar">
      <div class="row" style="gap:4px">
        <button class="icon-btn" data-action="cl-day" data-v="-1" aria-label="${tr('اليوم السابق', 'Previous day')}">${prevIcon()}</button>
        <input type="date" class="input" style="width:auto" value="${date}" data-change="cl-date" aria-label="${tr('تاريخ الجلسة', 'Session date')}">
        <button class="icon-btn" data-action="cl-day" data-v="1" aria-label="${tr('اليوم التالي', 'Next day')}">${nextIcon()}</button>
        ${date !== todayISO() ? html`<button class="btn btn-sm btn-ghost" data-action="cl-today">${tr('اليوم', 'Today')}</button>` : ''}
      </div>
      <strong>${fmtDate(date, 'long')}</strong>
      <span class="spacer"></span>
      <button class="btn" data-action="cl-import">${icon('upload')} ${tr('استيراد Excel', 'Import Excel')}</button>
      <button class="btn" data-action="cl-print">${icon('print')} ${ui.clinicDoctor === 'ALL' ? tr('طباعة الكل', 'Print all') : tr('طباعة القائمة', 'Print list')}</button>
      <button class="btn btn-primary" data-action="new-visit">${icon('plus')} ${tr('إضافة مريض', 'Add patient')}</button>
    </div>

    <div class="tabs">
      <button class="tab ${ui.clinicDoctor === 'ALL' ? 'active' : ''}" data-action="cl-doctor" data-v="ALL">${tr('كل الأطباء', 'All doctors')} <span class="n">${all.length}</span></button>
      ${doctors.map((d) => html`<button class="tab ${ui.clinicDoctor === d ? 'active' : ''}" data-action="cl-doctor" data-v="${d}">${dr(d)} <span class="n">${all.filter((v) => docKey(v) === d).length}</span></button>`)}
    </div>

    <div class="panel">
      <div class="stats">
        <span><b>${scope.length}</b>${tr('مريض', 'patients')}</span>
        <span><b>${n((v) => String(v.plan || '').trim())}</b>${tr('لديهم خطة', 'with a plan')}</span>
        <span><b>${n((v) => v.opcDate)}</b>${tr('لديهم موعد', 'with an appointment')}</span>
        <span><b>${n((v) => v.notified === 'Y')}</b>${tr('تم تبليغهم', 'notified')}</span>
        <span><b>${n((v) => !patient(v.patientId)?.phone)}</b>${tr('بدون هاتف', 'no phone')}</span>
      </div>
      <div class="toolbar" style="padding:12px 18px 0; margin-bottom:10px">
        <label class="search-box"><input class="input" type="search" placeholder="${tr('بحث بالاسم أو رقم الملف أو الخطة', 'Search name, file number or plan')}" value="${ui.clinicQuery}" data-input="cl-q" data-key="cl-q">${icon('search', 16)}</label>
        <span class="spacer"></span>
        ${selected.length ? html`
          <span class="small"><b>${selected.length}</b> ${tr('محدد', 'selected')}</span>
          <button class="btn btn-sm" data-action="cl-bulk-notified">${icon('check', 16)} ${tr('تم تبليغهم', 'Mark notified')}</button>
          <button class="btn btn-sm" data-action="cl-bulk-delete" style="color:var(--red)">${icon('trash', 16)} ${tr('حذف المحدد', 'Remove selected')}</button>
          <button class="btn btn-sm btn-ghost" data-action="cl-clear-sel">${tr('إلغاء التحديد', 'Clear selection')}</button>`
        : html`<button class="btn btn-sm btn-ghost" data-action="cl-clean-empty" title="${tr('يحذف من القائمة المعروضة المرضى الذين لم تُكتب لهم خطة', 'Removes patients with no plan and no appointment from the list shown')}">${icon('trash', 16)} ${tr('حذف من ليس لهم خطة', 'Remove those without a plan')}</button>`}
      </div>
      ${rows.length ? html`
        <div class="table-wrap"><table class="data" style="min-width:1120px">
          <thead><tr>
            <th><input type="checkbox" class="check" data-change="visit-select-all" aria-label="${tr('تحديد الكل', 'Select all')}" ${rows.length && rows.every((r) => ui.clinicSelected.has(r.id)) ? 'checked' : ''}></th>
            <th>${tr('المريض', 'Patient')}</th><th>${tr('الهاتف', 'Phone')}</th><th>${tr('خطة العلاج', 'Treatment plan')}</th><th>${tr('موعد العيادة القادم', 'Next clinic appointment')}</th><th>${tr('تصريح', 'Permit')}</th><th>${tr('تحويل', 'Referral')}</th><th>${tr('تم التبليغ', 'Notified')}</th><th></th>
          </tr></thead>
          <tbody>${rows.map(visitRow)}</tbody>
        </table></div>`
      : html`<div class="empty"><strong>${all.length ? tr('لا نتائج لهذا البحث', 'No results') : tr('لا يوجد مرضى في قائمة هذا اليوم', 'No patients on this day\'s list')}</strong>${all.length ? '' : tr('استورد قائمة العيادة من Excel أو أضف المرضى يدوياً.', 'Import the clinic list from Excel or add patients one by one.')}</div>`}
    </div>`;
}

// ---------- actions ----------
export async function newVisit({ patientId = '', date = '' } = {}) {
  const data = await modal({
    title: tr('إضافة مريض لقائمة العيادة', 'Add patient to clinic list'),
    size: 'l',
    body: html`
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        <label class="field"><span>${tr('تاريخ الجلسة', 'Session date')}</span><input type="date" name="sessionDate" value="${date || ui.clinicDate || todayISO()}"></label>
        ${physicianFieldHTML({ value: ui.clinicDoctor !== 'ALL' && ui.clinicDoctor ? ui.clinicDoctor : undefined })}
        <label class="field span-2"><span>${tr('خطة العلاج', 'Treatment plan')}</span><textarea name="plan"></textarea></label>
        <label class="field"><span>${tr('موعد العيادة القادم', 'Next clinic appointment')}</span><input type="date" name="opcDate"></label>
      </div>`,
    primary: tr('إضافة', 'Add'),
    onMount: (dlg) => { mountPatientPicker(dlg); mountPhysicianField(dlg); },
    validate: (d) => validatePicker(d)
      || (d.physician === '__other' && !d.physicianOther ? tr('اكتب اسم الطبيب.', 'Type the doctor\'s name.') : null)
      || (d.patientId && idx().lists.visits.some((v) => v.patientId === d.patientId && v.sessionDate === d.sessionDate) ? tr('هذا المريض موجود مسبقاً في قائمة نفس اليوم.', 'This patient is already on this day\'s list.') : null),
  });
  if (!data) return;
  const physician = readPhysician(data);
  const r = resolvePatient(data, { physician });
  if (r.error) { toast(r.error, { type: 'error' }); return; }
  create('visits', { patientId: r.id, sessionDate: data.sessionDate || ui.clinicDate, physician, plan: data.plan, opcDate: data.opcDate, permit: '', referral: '', notified: 'N', noteUrl: '', autoClosed: '' });
  toast(tr('أُضيف المريض للقائمة', 'Patient added to the list'));
}

async function editVisit(id) {
  const v = get('visits', id);
  const data = await modal({
    title: tr('تعديل الزيارة', 'Edit visit'),
    body: html`<div class="grid-2">
      ${physicianFieldHTML({ value: v.physician })}
      <label class="field"><span>${tr('تاريخ الجلسة', 'Session date')}</span><input type="date" name="sessionDate" value="${v.sessionDate}"></label></div>`,
    onMount: (dlg) => mountPhysicianField(dlg),
  });
  if (data) upsert('visits', { id, physician: readPhysician(data), sessionDate: data.sessionDate || v.sessionDate });
}

async function attach(id) {
  const v = get('visits', id);
  const p = patient(v.patientId) || {};
  const data = await modal({
    title: tr('إرفاق صورة ملاحظة الأخصائي', 'Attach specialist note image'),
    body: html`
      <p class="muted">${tr('اختر صورة من الجهاز، أو الصق صورة (Ctrl+V) داخل هذه النافذة.', 'Choose an image, or paste one (Ctrl+V) into this window.')}</p>
      <input type="file" name="file" accept="image/*" class="input">
      <img data-prev alt="" style="max-width:100%; max-height:260px; border-radius:8px; ${v.noteUrl ? '' : 'display:none'}" src="${v.noteUrl || ''}">
      <input type="hidden" name="dataUrl">`,
    primary: tr('رفع وحفظ', 'Upload and save'),
    onMount: (dlg) => {
      const prev = dlg.querySelector('[data-prev]');
      const hidden = dlg.querySelector('[name=dataUrl]');
      const use = async (file) => { hidden.value = await readFileAs(file, 'dataURL'); prev.src = hidden.value; prev.style.display = ''; };
      dlg.querySelector('[name=file]').addEventListener('change', (e) => e.target.files[0] && use(e.target.files[0]));
      dlg.addEventListener('paste', (e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) use(f); });
    },
    validate: (d) => (!d.dataUrl ? tr('اختر صورة أو الصقها أولاً.', 'Choose or paste an image first.') : null),
  });
  if (!data) return;
  toast(tr('جاري رفع الصورة…', 'Uploading…'));
  try {
    const res = await api.call('UPLOAD_FILE', { dataUrl: data.dataUrl, filename: `note_${p.mrn || p.name}_${v.sessionDate}.png` });
    upsert('visits', { id, noteUrl: res.url }, { summary: tr('إرفاق صورة ملاحظة', 'Note image attached') });
    toast(tr('أُرفقت الصورة', 'Image attached'));
  } catch (e) {
    toast(`${tr('تعذّر رفع الصورة', 'Upload failed')}: ${e.message}`, { type: 'error' });
  }
}

async function deleteVisits(ids, label) {
  if (!ids.length) return;
  if (!(await confirmBox(label, { danger: true, confirm: tr('حذف', 'Remove') }))) return;
  batch(() => ids.forEach((id) => remove('visits', id)));
  ui.clinicSelected.clear();
  toast(tr(`حُذف ${ids.length} من القائمة`, `Removed ${ids.length} from the list`), { undo: () => batch(() => ids.forEach((id) => restore('visits', id))) });
}

function printList() {
  const rows = idx().lists.visits.filter((v) => v.sessionDate === ui.clinicDate && (ui.clinicDoctor === 'ALL' || docKey(v) === ui.clinicDoctor))
    .sort((a, b) => byText(a.physician, b.physician));
  if (!rows.length) { toast(tr('القائمة فارغة.', 'The list is empty.'), { type: 'error' }); return; }
  printTable({
    title: tr('حجوزات ما بعد العيادة', 'Post-clinic bookings'),
    subtitle: `${fmtDate(ui.clinicDate, 'long')}${ui.clinicDoctor !== 'ALL' ? ` — ${dr(ui.clinicDoctor)}` : ''}`,
    columns: [{ label: tr('المريض', 'Patient') }, { label: tr('رقم الملف', 'File no.') }, { label: tr('العمر', 'Age') }, { label: tr('الهاتف', 'Phone') }, { label: tr('الطبيب', 'Doctor') }, { label: tr('خطة العلاج', 'Treatment plan'), width: '30%' }, { label: tr('الموعد', 'Appointment') }, { label: tr('تصريح', 'Permit') }, { label: tr('تحويل', 'Referral') }, { label: tr('تبليغ', 'Notified') }],
    rows: rows.map((v) => { const p = patient(v.patientId) || {}; return [p.name, p.mrn, p.age, p.phone, v.physician ? dr(v.physician) : '', v.plan, v.opcDate ? fmtDate(v.opcDate) : '', yn(v.permit), yn(v.referral), v.notified === 'Y' ? '✓' : '']; }),
  });
}

const scopeIds = () => idx().lists.visits.filter((v) => v.sessionDate === ui.clinicDate && (ui.clinicDoctor === 'ALL' || docKey(v) === ui.clinicDoctor));

registerActions({
  'new-visit': (el) => newVisit({ patientId: el.dataset.patient || '' }),
  'cl-day': (el) => { ui.clinicDate = addDays(ui.clinicDate, +el.dataset.v); ui.clinicSelected.clear(); },
  'cl-today': () => { ui.clinicDate = todayISO(); },
  'cl-doctor': (el) => { ui.clinicDoctor = el.dataset.v; ui.clinicSelected.clear(); },
  'cl-import': () => openImport('clinic', ui.clinicDate),
  'cl-print': () => printList(),
  'cl-clear-sel': () => ui.clinicSelected.clear(),
  'cl-bulk-notified': () => { const ids = [...ui.clinicSelected]; batch(() => ids.forEach((id) => upsert('visits', { id, notified: 'Y' }))); ui.clinicSelected.clear(); toast(tr(`سُجّل التبليغ لـ ${ids.length}`, `${ids.length} marked notified`)); },
  'cl-bulk-delete': () => deleteVisits([...ui.clinicSelected], tr(`حذف ${ui.clinicSelected.size} مريض من قائمة هذا اليوم؟`, `Remove ${ui.clinicSelected.size} patients from this day's list?`)),
  'cl-clean-empty': () => {
    const ids = scopeIds().filter((v) => !String(v.plan || '').trim() && !v.opcDate).map((v) => v.id);
    if (!ids.length) { toast(tr('كل المرضى في القائمة لهم خطة.', 'Everyone on the list has a plan.')); return; }
    deleteVisits(ids, tr(`حذف ${ids.length} مريض بدون خطة ولا موعد من القائمة المعروضة؟`, `Remove ${ids.length} patients with no plan and no appointment from this list?`));
  },
  'visit-toggle': (el) => { const v = get('visits', el.dataset.id); const f = el.dataset.field; upsert('visits', { id: v.id, [f]: v[f] === el.dataset.v ? '' : el.dataset.v }); },
  'visit-refer': async (el) => { const v = get('visits', el.dataset.id); (await import('./committee.js')).referToCommittee({ patientId: v.patientId, plan: v.plan, physician: v.physician, sourceVisitId: v.id }); },
  'visit-followup': async (el) => { const v = get('visits', el.dataset.id); (await import('./followups.js')).newFollowup({ patientId: v.patientId, sourceType: 'visit', sourceId: v.id }); },
  'visit-attach': (el) => attach(el.dataset.id),
  'visit-edit': (el) => editVisit(el.dataset.id),
  'visit-delete': (el) => deleteVisits([el.dataset.id], tr('حذف هذا المريض من قائمة هذا اليوم؟', 'Remove this patient from this day\'s list?')),
});
registerChanges({
  'cl-date': (el) => { if (el.value) { ui.clinicDate = el.value; ui.clinicSelected.clear(); } },
  'cl-q': (el) => { ui.clinicQuery = el.value; },
  'visit-field': (el) => upsert('visits', { id: el.dataset.id, [el.dataset.field]: el.value.trim() }),
  'visit-notified': (el) => upsert('visits', { id: el.dataset.id, notified: el.checked ? 'Y' : 'N' }),
  'patient-phone': (el) => setPatientField(el.dataset.id, 'phone', el.value.trim()),
  'visit-select': (el) => { el.checked ? ui.clinicSelected.add(el.dataset.id) : ui.clinicSelected.delete(el.dataset.id); },
  'visit-select-all': (el) => { scopeIds().forEach((v) => (el.checked ? ui.clinicSelected.add(v.id) : ui.clinicSelected.delete(v.id))); },
});
