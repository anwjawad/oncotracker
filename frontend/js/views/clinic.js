// Post-clinic bookings: one list per session date, tabbed by physician, edited in place.
import { html, todayISO, addDays, fmtDate, matchesQuery, uniq, byText, isISODate, cleanPhysician, readFileAs } from '../util.js';
import { idx, patient, get, create, upsert, remove, restore, batch } from '../store.js';
import { suggestsCommittee } from '../rules.js';
import { icon, modal, toast, confirmBox, menu, physicianOptions, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker, setPatientField } from '../ui.js';
import { printTable } from '../print.js';
import { openImport } from '../importer.js';
import { api } from '../api.js';
import { registerActions, registerChanges, ui } from '../registry.js';

export const title = 'حجوزات ما بعد العيادة';

export function onRoute(params) {
  if (isISODate(params.get('date'))) { ui.clinicDate = params.get('date'); ui.clinicDoctor = 'ALL'; }
  if (!ui.clinicDate) ui.clinicDate = todayISO();
}

const yn = (v) => (v === 'Y' ? 'نعم' : v === 'N' ? 'لا' : '');

function seg(v, field) {
  return html`<div class="seg" role="group">
    ${['Y', 'N'].map((x) => html`<button type="button" class="${(v[field] || '') === x ? `on-${x}` : ''}" data-action="visit-toggle" data-id="${v.id}" data-field="${field}" data-v="${x}" aria-pressed="${v[field] === x}">${x === 'Y' ? 'نعم' : 'لا'}</button>`)}
  </div>`;
}

function visitRow(v) {
  const p = patient(v.patientId) || {};
  const sel = ui.clinicSelected.has(v.id);
  const inCommittee = (idx().committeeBy.get(v.patientId) || []).find((c) => c.sessionDate >= v.sessionDate && c.status !== 'withdrawn');
  const openFu = (idx().followupsBy.get(v.patientId) || []).filter((f) => f.status === 'open' || f.status === 'waiting').length;
  return html`
  <tr class="${sel ? 'selected' : ''}">
    <td><input type="checkbox" class="check" data-change="visit-select" data-id="${v.id}" ${sel ? 'checked' : ''} aria-label="تحديد"></td>
    <td style="min-width:170px">
      <button class="patient-link" data-action="open-patient" data-id="${v.patientId}">${p.name || 'بدون اسم'}</button>
      <div class="mrn">${p.mrn || 'بدون رقم'}${p.age ? html` · <span>${p.age} سنة</span>` : ''}</div>
      <div class="row" style="gap:4px; margin-top:3px">
        ${inCommittee ? html`<a class="chip accent" href="#/committee?date=${inCommittee.sessionDate}">لجنة ${fmtDate(inCommittee.sessionDate)}</a>` : ''}
        ${openFu ? html`<span class="chip amber">${openFu} متابعة</span>` : ''}
        ${v.noteUrl ? html`<a class="chip outline" href="${v.noteUrl}" target="_blank" rel="noopener">${icon('file', 12)} مرفق</a>` : ''}
      </div>
    </td>
    <td style="width:150px"><input class="cell-input ltr" style="min-width:130px" value="${p.phone || ''}" placeholder="أضف رقماً" inputmode="tel" data-change="patient-phone" data-id="${v.patientId}" data-key="ph-${v.id}" aria-label="الهاتف"></td>
    <td style="min-width:260px">
      <textarea class="cell-input" rows="1" placeholder="خطة العلاج…" data-change="visit-field" data-id="${v.id}" data-field="plan" data-key="plan-${v.id}" aria-label="خطة العلاج">${v.plan || ''}</textarea>
      ${!inCommittee && suggestsCommittee(v.plan) ? html`<button class="btn btn-sm btn-ghost" style="color:var(--accent-ink)" data-action="visit-refer" data-id="${v.id}">${icon('send', 14)} الخطة تذكر اللجنة — إدراجه؟</button>` : ''}
    </td>
    <td style="width:160px"><input type="date" class="cell-input" style="min-width:145px" value="${v.opcDate || ''}" data-change="visit-field" data-id="${v.id}" data-field="opcDate" data-key="opc-${v.id}" aria-label="موعد العيادة"></td>
    <td>${seg(v, 'permit')}</td>
    <td>${seg(v, 'referral')}</td>
    <td style="text-align:center"><input type="checkbox" class="check" ${v.notified === 'Y' ? 'checked' : ''} data-change="visit-notified" data-id="${v.id}" aria-label="تم التبليغ" style="width:20px;height:20px"></td>
    <td>${menu(html`
      <button data-action="open-patient" data-id="${v.patientId}">${icon('user', 16)} ملف المريض</button>
      <button data-action="visit-refer" data-id="${v.id}">${icon('send', 16)} إدراج في لجنة الحالات</button>
      <button data-action="visit-followup" data-id="${v.id}">${icon('plus', 16)} متابعة جديدة</button>
      <button data-action="visit-attach" data-id="${v.id}">${icon('file', 16)} ${v.noteUrl ? 'تغيير المرفق' : 'إرفاق صورة ملاحظة'}</button>
      <button data-action="visit-edit" data-id="${v.id}">${icon('edit', 16)} تعديل الطبيب والتاريخ</button>
      <hr><button class="danger" data-action="visit-delete" data-id="${v.id}">${icon('trash', 16)} حذف من القائمة</button>`)}</td>
  </tr>`;
}

export function render() {
  const date = ui.clinicDate;
  const all = idx().lists.visits.filter((v) => v.sessionDate === date);
  const doctors = uniq(all.map((v) => v.physician || 'بدون طبيب')).sort(byText);
  if (ui.clinicDoctor !== 'ALL' && !doctors.includes(ui.clinicDoctor)) ui.clinicDoctor = 'ALL';
  let rows = ui.clinicDoctor === 'ALL' ? all : all.filter((v) => (v.physician || 'بدون طبيب') === ui.clinicDoctor);
  const scope = rows;
  if (ui.clinicQuery) rows = rows.filter((v) => { const p = patient(v.patientId) || {}; return matchesQuery(ui.clinicQuery, p.name, p.mrn, v.plan); });
  rows.sort((a, b) => byText(a.physician, b.physician) || byText(patient(a.patientId)?.name || '', patient(b.patientId)?.name || ''));
  const count = (fn) => scope.filter(fn).length;
  const selected = [...ui.clinicSelected].filter((id) => get('visits', id) && !get('visits', id).deleted);

  return html`
    <div class="toolbar">
      <div class="row" style="gap:4px">
        <button class="icon-btn" data-action="cl-day" data-v="-1" aria-label="اليوم السابق">${icon('chevR')}</button>
        <input type="date" class="input" style="width:auto" value="${date}" data-change="cl-date" aria-label="تاريخ الجلسة">
        <button class="icon-btn" data-action="cl-day" data-v="1" aria-label="اليوم التالي">${icon('chevL')}</button>
        ${date !== todayISO() ? html`<button class="btn btn-sm btn-ghost" data-action="cl-today">اليوم</button>` : ''}
      </div>
      <strong>${fmtDate(date, 'long')}</strong>
      <span class="spacer"></span>
      <button class="btn" data-action="cl-import">${icon('upload')} استيراد Excel</button>
      <button class="btn" data-action="cl-print">${icon('print')} طباعة ${ui.clinicDoctor === 'ALL' ? 'الكل' : 'القائمة'}</button>
      <button class="btn btn-primary" data-action="new-visit">${icon('plus')} إضافة مريض</button>
    </div>

    <div class="tabs">
      <button class="tab ${ui.clinicDoctor === 'ALL' ? 'active' : ''}" data-action="cl-doctor" data-v="ALL">كل الأطباء <span class="n">${all.length}</span></button>
      ${doctors.map((d) => html`<button class="tab ${ui.clinicDoctor === d ? 'active' : ''}" data-action="cl-doctor" data-v="${d}">د. ${d} <span class="n">${all.filter((v) => (v.physician || 'بدون طبيب') === d).length}</span></button>`)}
    </div>

    <div class="panel">
      <div class="stats">
        <span><b>${scope.length}</b>مريض</span>
        <span><b>${count((v) => String(v.plan || '').trim())}</b>لديهم خطة</span>
        <span><b>${count((v) => v.opcDate)}</b>لديهم موعد</span>
        <span><b>${count((v) => v.notified === 'Y')}</b>تم تبليغهم</span>
        <span><b>${count((v) => !patient(v.patientId)?.phone)}</b>بدون هاتف</span>
      </div>
      <div class="toolbar" style="padding:12px 18px 0; margin-bottom:10px">
        <label class="search-box"><input class="input" type="search" placeholder="بحث بالاسم أو رقم الملف أو الخطة" value="${ui.clinicQuery}" data-input="cl-q" data-key="cl-q">${icon('search', 16)}</label>
        <span class="spacer"></span>
        ${selected.length ? html`
          <span class="small"><b>${selected.length}</b> محدد</span>
          <button class="btn btn-sm" data-action="cl-bulk-notified">${icon('check', 16)} تم تبليغهم</button>
          <button class="btn btn-sm" data-action="cl-bulk-delete" style="color:var(--red)">${icon('trash', 16)} حذف المحدد</button>
          <button class="btn btn-sm btn-ghost" data-action="cl-clear-sel">إلغاء التحديد</button>`
        : html`<button class="btn btn-sm btn-ghost" data-action="cl-clean-empty" title="يحذف من القائمة المعروضة المرضى الذين لم تُكتب لهم خطة">${icon('trash', 16)} حذف من ليس لهم خطة</button>`}
      </div>
      ${rows.length ? html`
        <div class="table-wrap"><table class="data" style="min-width:1120px">
          <thead><tr>
            <th><input type="checkbox" class="check" data-change="visit-select-all" aria-label="تحديد الكل" ${rows.length && rows.every((r) => ui.clinicSelected.has(r.id)) ? 'checked' : ''}></th>
            <th>المريض</th><th>الهاتف</th><th>خطة العلاج</th><th>موعد العيادة القادم</th><th>تصريح</th><th>تحويل</th><th>تم التبليغ</th><th></th>
          </tr></thead>
          <tbody>${rows.map(visitRow)}</tbody>
        </table></div>`
      : html`<div class="empty"><strong>${all.length ? 'لا نتائج لهذا البحث' : 'لا يوجد مرضى في قائمة هذا اليوم'}</strong>${all.length ? '' : 'استورد قائمة العيادة من Excel أو أضف المرضى يدوياً.'}</div>`}
    </div>`;
}

// ---------- actions ----------
export async function newVisit({ patientId = '', date = '' } = {}) {
  const data = await modal({
    title: 'إضافة مريض لقائمة العيادة',
    size: 'l',
    body: html`
      ${physicianOptions()}
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        <label class="field"><span>تاريخ الجلسة</span><input type="date" name="sessionDate" value="${date || ui.clinicDate || todayISO()}"></label>
        <label class="field"><span>الطبيب</span><input name="physician" list="physician-list" value="${ui.clinicDoctor !== 'ALL' ? ui.clinicDoctor : patient(patientId)?.physician || ''}"></label>
        <label class="field span-2"><span>خطة العلاج</span><textarea name="plan"></textarea></label>
        <label class="field"><span>موعد العيادة القادم</span><input type="date" name="opcDate"></label>
      </div>`,
    primary: 'إضافة',
    onMount: (dlg) => mountPatientPicker(dlg),
    validate: (d) => validatePicker(d) || (d.patientId && idx().lists.visits.some((v) => v.patientId === d.patientId && v.sessionDate === d.sessionDate) ? 'هذا المريض موجود مسبقاً في قائمة نفس اليوم.' : null),
  });
  if (!data) return;
  const physician = cleanPhysician(data.physician);
  const r = resolvePatient(data, { physician });
  if (r.error) { toast(r.error, { type: 'error' }); return; }
  create('visits', { patientId: r.id, sessionDate: data.sessionDate || ui.clinicDate, physician, plan: data.plan, opcDate: data.opcDate, permit: '', referral: '', notified: 'N', noteUrl: '', autoClosed: '' });
  toast('أُضيف المريض للقائمة');
}

async function editVisit(id) {
  const v = get('visits', id);
  const data = await modal({
    title: 'تعديل الزيارة',
    body: html`${physicianOptions()}<div class="grid-2">
      <label class="field"><span>الطبيب</span><input name="physician" list="physician-list" value="${v.physician}"></label>
      <label class="field"><span>تاريخ الجلسة</span><input type="date" name="sessionDate" value="${v.sessionDate}"></label></div>`,
  });
  if (data) upsert('visits', { id, physician: cleanPhysician(data.physician), sessionDate: data.sessionDate || v.sessionDate });
}

async function attach(id) {
  const v = get('visits', id);
  const p = patient(v.patientId) || {};
  const data = await modal({
    title: 'إرفاق صورة ملاحظة الأخصائي',
    body: html`
      <p class="muted">اختر صورة من الجهاز، أو الصق صورة (Ctrl+V) داخل هذه النافذة.</p>
      <input type="file" name="file" accept="image/*" class="input">
      <img data-prev alt="" style="max-width:100%; max-height:260px; border-radius:8px; ${v.noteUrl ? '' : 'display:none'}" src="${v.noteUrl || ''}">
      <input type="hidden" name="dataUrl">`,
    primary: 'رفع وحفظ',
    onMount: (dlg) => {
      const prev = dlg.querySelector('[data-prev]');
      const hidden = dlg.querySelector('[name=dataUrl]');
      const use = async (file) => { hidden.value = await readFileAs(file, 'dataURL'); prev.src = hidden.value; prev.style.display = ''; };
      dlg.querySelector('[name=file]').addEventListener('change', (e) => e.target.files[0] && use(e.target.files[0]));
      dlg.addEventListener('paste', (e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) use(f); });
    },
    validate: (d) => (!d.dataUrl ? 'اختر صورة أو الصقها أولاً.' : null),
  });
  if (!data) return;
  toast('جاري رفع الصورة…');
  try {
    const res = await api.call('UPLOAD_FILE', { dataUrl: data.dataUrl, filename: `note_${p.mrn || p.name}_${v.sessionDate}.png` });
    upsert('visits', { id, noteUrl: res.url }, { summary: 'إرفاق صورة ملاحظة' });
    toast('أُرفقت الصورة');
  } catch (e) {
    toast('تعذّر رفع الصورة: ' + e.message, { type: 'error' });
  }
}

async function deleteVisits(ids, label) {
  if (!ids.length) return;
  if (!(await confirmBox(label, { danger: true, confirm: 'حذف' }))) return;
  batch(() => ids.forEach((id) => remove('visits', id)));
  ui.clinicSelected.clear();
  toast(`حُذف ${ids.length} من القائمة`, { undo: () => batch(() => ids.forEach((id) => restore('visits', id))) });
}

function printList() {
  const rows = idx().lists.visits.filter((v) => v.sessionDate === ui.clinicDate && (ui.clinicDoctor === 'ALL' || (v.physician || 'بدون طبيب') === ui.clinicDoctor))
    .sort((a, b) => byText(a.physician, b.physician));
  if (!rows.length) { toast('القائمة فارغة.', { type: 'error' }); return; }
  printTable({
    title: 'حجوزات ما بعد العيادة',
    subtitle: `${fmtDate(ui.clinicDate, 'long')}${ui.clinicDoctor !== 'ALL' ? ` — د. ${ui.clinicDoctor}` : ''}`,
    columns: [{ label: 'المريض' }, { label: 'رقم الملف' }, { label: 'العمر' }, { label: 'الهاتف' }, { label: 'الطبيب' }, { label: 'خطة العلاج', width: '30%' }, { label: 'الموعد' }, { label: 'تصريح' }, { label: 'تحويل' }, { label: 'تبليغ' }],
    rows: rows.map((v) => { const p = patient(v.patientId) || {}; return [p.name, p.mrn, p.age, p.phone, v.physician, v.plan, v.opcDate ? fmtDate(v.opcDate) : '', yn(v.permit), yn(v.referral), v.notified === 'Y' ? '✓' : '']; }),
  });
}

registerActions({
  'new-visit': (el) => newVisit({ patientId: el.dataset.patient || '' }),
  'cl-day': (el) => { ui.clinicDate = addDays(ui.clinicDate, +el.dataset.v); ui.clinicSelected.clear(); },
  'cl-today': () => { ui.clinicDate = todayISO(); },
  'cl-doctor': (el) => { ui.clinicDoctor = el.dataset.v; ui.clinicSelected.clear(); },
  'cl-import': () => openImport('clinic', ui.clinicDate),
  'cl-print': () => printList(),
  'cl-clear-sel': () => ui.clinicSelected.clear(),
  'cl-bulk-notified': () => { const ids = [...ui.clinicSelected]; batch(() => ids.forEach((id) => upsert('visits', { id, notified: 'Y' }))); ui.clinicSelected.clear(); toast(`سُجّل التبليغ لـ ${ids.length}`); },
  'cl-bulk-delete': () => deleteVisits([...ui.clinicSelected], `حذف ${ui.clinicSelected.size} مريض من قائمة هذا اليوم؟`),
  'cl-clean-empty': () => {
    const ids = idx().lists.visits.filter((v) => v.sessionDate === ui.clinicDate && (ui.clinicDoctor === 'ALL' || (v.physician || 'بدون طبيب') === ui.clinicDoctor) && !String(v.plan || '').trim() && !v.opcDate).map((v) => v.id);
    if (!ids.length) { toast('كل المرضى في القائمة لهم خطة.'); return; }
    deleteVisits(ids, `حذف ${ids.length} مريض بدون خطة ولا موعد من القائمة المعروضة؟`);
  },
  'visit-toggle': (el) => { const v = get('visits', el.dataset.id); const f = el.dataset.field; upsert('visits', { id: v.id, [f]: v[f] === el.dataset.v ? '' : el.dataset.v }); },
  'visit-refer': async (el) => { const v = get('visits', el.dataset.id); (await import('./committee.js')).referToCommittee({ patientId: v.patientId, plan: v.plan, physician: v.physician, sourceVisitId: v.id }); },
  'visit-followup': async (el) => { const v = get('visits', el.dataset.id); (await import('./followups.js')).newFollowup({ patientId: v.patientId, sourceType: 'visit', sourceId: v.id }); },
  'visit-attach': (el) => attach(el.dataset.id),
  'visit-edit': (el) => editVisit(el.dataset.id),
  'visit-delete': (el) => deleteVisits([el.dataset.id], 'حذف هذا المريض من قائمة هذا اليوم؟'),
});
registerChanges({
  'cl-date': (el) => { if (el.value) { ui.clinicDate = el.value; ui.clinicSelected.clear(); } },
  'cl-q': (el) => { ui.clinicQuery = el.value; },
  'visit-field': (el) => upsert('visits', { id: el.dataset.id, [el.dataset.field]: el.value.trim() }),
  'visit-notified': (el) => upsert('visits', { id: el.dataset.id, notified: el.checked ? 'Y' : 'N' }),
  'patient-phone': (el) => setPatientField(el.dataset.id, 'phone', el.value.trim()),
  'visit-select': (el) => { el.checked ? ui.clinicSelected.add(el.dataset.id) : ui.clinicSelected.delete(el.dataset.id); },
  'visit-select-all': (el) => {
    const ids = idx().lists.visits.filter((v) => v.sessionDate === ui.clinicDate && (ui.clinicDoctor === 'ALL' || (v.physician || 'بدون طبيب') === ui.clinicDoctor)).map((v) => v.id);
    ids.forEach((id) => (el.checked ? ui.clinicSelected.add(id) : ui.clinicSelected.delete(id)));
  },
});
