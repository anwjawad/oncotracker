// Patient record: drawer with timeline, edit form with duplicate guard, merge.
import { html, $, normMrn, cleanName, fmtDate, fmtTime } from './util.js';
import { idx, patient, upsert, remove, batch, store } from './store.js';
import { issuesFor, fuLabel, CASE_STATUS, caseStage, attemptLabel, fixPhone } from './rules.js';
import { icon, modal, toast, confirmBox, telLink, dueChip, physicianFieldHTML, mountPhysicianField, readPhysician } from './ui.js';
import { registerActions } from './registry.js';
import { tr, dr, lang } from './i18n.js';

export const drawerState = { id: null };

const FIELD_LABELS = {
  name: ['الاسم', 'Name'], mrn: ['رقم الملف', 'File no.'], phone: ['الهاتف', 'Phone'], phone2: ['هاتف آخر', 'Phone 2'], age: ['العمر', 'Age'], gender: ['الجنس', 'Sex'],
  physician: ['الطبيب', 'Doctor'], diagnosis: ['التشخيص', 'Diagnosis'], notes: ['ملاحظات', 'Notes'], plan: ['الخطة', 'Plan'], opcDate: ['موعد العيادة', 'Clinic appointment'],
  permit: ['التصريح', 'Permit'], referral: ['التحويل', 'Referral'], notified: ['التبليغ', 'Notified'], briefHistory: ['القصة المرضية', 'Brief history'], question: ['السؤال للجنة', 'Question'],
  decision: ['القرار', 'Decision'], status: ['الحالة', 'Status'], ready: ['جاهز', 'Ready'], sessionDate: ['تاريخ الجلسة', 'Session date'], dueDate: ['تاريخ الاستحقاق', 'Due date'], title: ['المهمة', 'Task'],
  outcome: ['النتيجة', 'Outcome'], deleted: ['محذوف', 'Deleted'], patientId: ['المريض', 'Patient'], mergedInto: ['دُمج في', 'Merged into'], phoneFlag: ['تنبيه الهاتف', 'Phone flag'],
  autoClosed: ['إغلاق المهمة التلقائية', 'Automatic task closed'], attempts: ['المحاولات', 'Attempts'], addenda: ['الملاحق', 'Addenda'], noteUrl: ['المرفق', 'Attachment'], type: ['النوع', 'Type'],
  ignoredIssues: ['تنبيهات متجاهلة', 'Ignored issues'], decidedAt: ['تاريخ القرار', 'Decided at'], closedAt: ['تاريخ الإغلاق', 'Closed at'], deferredToId: ['أُجّل إلى', 'Deferred to'],
};
const fieldLabel = (f) => (FIELD_LABELS[f] ? FIELD_LABELS[f][lang() === 'en' ? 1 : 0] : f);
const TABLE_LABELS = { patients: ['الملف', 'record'], visits: ['زيارة العيادة', 'clinic visit'], committee: ['اللجنة', 'committee case'], followups: ['متابعة', 'follow-up'] };
const ACTION_LABELS = { create: ['إنشاء', 'Created'], update: ['تعديل', 'Edited'], delete: ['حذف', 'Deleted'], restore: ['استرجاع', 'Restored'], note: ['', ''], merge: ['دمج', 'Merged'] };
const pick = (pair) => (pair ? pair[lang() === 'en' ? 1 : 0] : '');

export function openPatient(id) {
  drawerState.id = id;
  renderDrawer();
  $('#drawer').hidden = false;
  $('#drawer-scrim').hidden = false;
  $('#drawer').focus?.();
}
export function closeDrawer() {
  drawerState.id = null;
  $('#drawer').hidden = true;
  $('#drawer-scrim').hidden = true;
}

export function renderDrawer() {
  const el = $('#drawer');
  const p = drawerState.id && patient(drawerState.id);
  if (!p || p.deleted) {
    if (drawerState.id && p?.mergedInto) { drawerState.id = p.mergedInto; return renderDrawer(); }
    if (drawerState.id) closeDrawer();
    return;
  }
  const { visitsBy, committeeBy, followupsBy } = idx();
  const visits = [...(visitsBy.get(p.id) || [])].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  const cases = [...(committeeBy.get(p.id) || [])].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  const fus = [...(followupsBy.get(p.id) || [])].sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(a.dueDate).localeCompare(String(b.dueDate)));
  const issues = issuesFor(p.id);
  const activity = store.data.activity.filter((a) => a.patientId === p.id).slice(0, 60);
  const yn = (v) => (v === 'Y' ? tr('نعم', 'yes') : tr('لا', 'no'));

  el.innerHTML = String(html`
    <div class="drawer-head">
      <div class="row-between">
        <h2>${p.name || tr('بدون اسم', 'No name')}</h2>
        <div class="row">
          <button class="btn btn-sm" data-action="edit-patient" data-id="${p.id}">${icon('edit', 16)} ${tr('تعديل البيانات', 'Edit details')}</button>
          <button class="icon-btn" data-action="close-drawer" aria-label="${tr('إغلاق', 'Close')}">${icon('x')}</button>
        </div>
      </div>
      <div class="facts">
        <span>${tr('رقم الملف', 'File no.')}: <b class="ltr">${p.mrn || '—'}</b></span>
        <span>${tr('الهاتف', 'Phone')}: ${telLink(p.phone)}${p.phoneFlag === 'wrong' ? html` <span class="chip red">${tr('أُبلغ أنه خاطئ', 'reported wrong')}</span>` : ''}</span>
        ${p.age ? html`<span>${tr('العمر', 'Age')}: ${p.age}</span>` : ''}
        ${p.physician ? html`<span>${dr(p.physician)}</span>` : ''}
        ${p.diagnosis ? html`<span>${tr('التشخيص', 'Diagnosis')}: ${p.diagnosis}</span>` : ''}
      </div>
      ${issues.length ? html`<div class="issue-strip">${issues.map((i) => html`
        <button class="chip ${i.sev === 'high' ? 'red' : i.sev === 'mid' ? 'amber' : ''}" data-action="fix-issue" data-key="${i.key}" title="${tr('اضغط للإصلاح', 'Click to fix')}">${icon('alert', 13)} ${i.l}</button>`)}</div>` : ''}
    </div>
    <div class="drawer-body">
      <section class="panel">
        <div class="panel-head"><h3>${tr('المتابعات', 'Follow-ups')}</h3>
          <button class="btn btn-sm" data-action="new-followup" data-patient="${p.id}">${icon('plus', 16)} ${tr('متابعة', 'Follow-up')}</button></div>
        ${fus.length ? html`<ul class="mini-list">${fus.map((f) => html`
          <li>
            <div>
              <div><span class="chip outline">${fuLabel(f.type)}</span> <strong>${f.title}</strong></div>
              ${f.status === 'done'
                ? html`<div class="small muted">${tr('أُنجزت', 'Done')} ${fmtTime(f.closedAt)} — ${f.outcome}</div>`
                : f.status === 'cancelled' ? html`<div class="small muted">${tr('أُلغيت', 'Cancelled')} — ${f.outcome}</div>`
                : html`<div class="small">${dueChip(f.dueDate, f.status)}</div>`}
              ${(f.attempts || []).length ? html`<div class="attempts">${f.attempts.length} ${tr('محاولة، آخرها', 'attempt(s), last')}: ${attemptLabel(f.attempts.at(-1).result)} (${fmtTime(f.attempts.at(-1).at)})</div>` : ''}
            </div>
            ${f.status === 'open' || f.status === 'waiting' ? html`<button class="btn btn-sm" data-action="finish-task" data-id="${f.id}">${icon('check', 16)} ${tr('إنهاء', 'Complete')}</button>` : ''}
          </li>`)}</ul>` : html`<div class="empty">${tr('لا توجد متابعات لهذا المريض.', 'No follow-ups for this patient.')}</div>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${tr('لجنة الحالات الجديدة', 'New cases committee')}</h3>
          <button class="btn btn-sm" data-action="refer-committee" data-patient="${p.id}">${icon('send', 16)} ${tr('إدراج في اللجنة', 'Add to committee')}</button></div>
        ${cases.length ? html`<ul class="mini-list">${cases.map((c) => { const st = CASE_STATUS[caseStage(c, p)] || CASE_STATUS.listed; return html`
          <li><div>
            <div><strong>${fmtDate(c.sessionDate, 'med')}</strong> <span class="chip ${st.chip}">${st.l}</span> <span class="muted small">${dr(c.physician)}</span></div>
            ${c.decision ? html`<div class="small"><b>${tr('القرار', 'Decision')}:</b> ${c.decision}</div>` : c.question ? html`<div class="small muted">${c.question}</div>` : ''}
          </div>
          <a class="btn btn-sm btn-ghost" href="#/committee?date=${c.sessionDate}" data-action="close-drawer">${tr('فتح الجلسة', 'Open session')}</a></li>`; })}</ul>`
          : html`<div class="empty">${tr('لم يُعرض على اللجنة.', 'Not presented to the committee.')}</div>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${tr('زيارات العيادة', 'Clinic visits')}</h3>
          <button class="btn btn-sm" data-action="new-visit" data-patient="${p.id}">${icon('plus', 16)} ${tr('زيارة', 'Visit')}</button></div>
        ${visits.length ? html`<ul class="mini-list">${visits.map((v) => html`
          <li><div>
            <div><strong>${fmtDate(v.sessionDate, 'med')}</strong> <span class="muted small">${dr(v.physician)}</span>
              ${v.notified === 'Y' ? html`<span class="chip green">${icon('check', 12)} ${tr('تم التبليغ', 'Notified')}</span>` : ''}</div>
            ${v.plan ? html`<div class="small" style="white-space:pre-wrap">${v.plan}</div>` : ''}
            <div class="small muted">${v.opcDate ? `${tr('الموعد القادم', 'Next appointment')}: ${fmtDate(v.opcDate, 'med')}` : tr('بدون موعد قادم', 'No next appointment')}
              ${v.permit ? ` · ${tr('تصريح', 'Permit')}: ${yn(v.permit)}` : ''}${v.referral ? ` · ${tr('تحويل', 'Referral')}: ${yn(v.referral)}` : ''}</div>
            ${v.noteUrl ? html`<a class="small" href="${v.noteUrl}" target="_blank" rel="noopener">${icon('file', 14)} ${tr('المرفق', 'Attachment')}</a>` : ''}
          </div>
          <a class="btn btn-sm btn-ghost" href="#/clinic?date=${v.sessionDate}" data-action="close-drawer">${tr('فتح القائمة', 'Open list')}</a></li>`)}</ul>`
          : html`<div class="empty">${tr('لا توجد زيارات.', 'No visits.')}</div>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${tr('سجل التعديلات', 'Change log')}</h3><span class="muted small">${tr('من عدّل ماذا ومتى', 'who changed what, and when')}</span></div>
        ${activity.length ? html`<ul class="timeline" style="padding:0 18px">${activity.map(activityItem)}</ul>` : html`<div class="empty">${tr('لا يوجد سجل بعد.', 'Nothing logged yet.')}</div>`}
      </section>

      ${p.notes ? html`<section class="panel"><div class="panel-head"><h3>${tr('ملاحظات', 'Notes')}</h3></div><div class="panel-body" style="white-space:pre-wrap">${p.notes}</div></section>` : ''}
    </div>`);
}

function activityItem(a) {
  const changes = (a.changes || []).filter((c) => !['custom', 'ignoredIssues'].includes(c.f));
  const what = a.action === 'note' ? a.summary : `${pick(ACTION_LABELS[a.action]) || a.action} ${pick(TABLE_LABELS[a.table])}${a.summary ? ' — ' + a.summary : ''}`;
  return html`<li>
    <div class="when">${fmtTime(a.at)}${a.by ? html`<br>${a.by}` : ''}</div>
    <div>
      <div>${what}</div>
      ${changes.slice(0, 6).map((c) => html`<div class="change">${fieldLabel(c.f)}: ${c.from ? html`<del>${c.from}</del> ← ` : ''}<ins>${c.to || tr('(فارغ)', '(empty)')}</ins></div>`)}
    </div>
  </li>`;
}

// ---------- edit / create ----------
export async function editPatient(id, { focus } = {}) {
  const p = id ? patient(id) : { name: '', mrn: '', phone: '', physician: '' };
  const body = html`
    <div class="grid-2">
      <label class="field span-2"><span>${tr('الاسم الكامل', 'Full name')}</span><input name="name" value="${p.name}" required>
        <span class="hint">${tr('اكتب الاسم رباعياً كما في الهوية؛ لا تختصره.', 'Write the full name as on the ID; do not shorten it.')}</span></label>
      <label class="field"><span>${tr('رقم الملف', 'File number')}</span><input name="mrn" class="ltr" value="${p.mrn}"></label>
      <label class="field"><span>${tr('العمر', 'Age')}</span><input name="age" value="${p.age || ''}" inputmode="numeric"></label>
      <label class="field"><span>${tr('الهاتف', 'Phone')}</span><input name="phone" class="ltr" value="${p.phone}" inputmode="tel"></label>
      <label class="field"><span>${tr('هاتف آخر', 'Phone 2')}</span><input name="phone2" class="ltr" value="${p.phone2 || ''}" inputmode="tel"></label>
      ${physicianFieldHTML({ value: p.physician || '', label: tr('الطبيب المتابع', 'Treating doctor') })}
      <label class="field"><span>${tr('الجنس', 'Sex')}</span><select name="gender">
        <option value="" ${!p.gender ? 'selected' : ''}>—</option><option value="M" ${p.gender === 'M' ? 'selected' : ''}>${tr('ذكر', 'Male')}</option><option value="F" ${p.gender === 'F' ? 'selected' : ''}>${tr('أنثى', 'Female')}</option></select></label>
      <label class="field span-2"><span>${tr('التشخيص', 'Diagnosis')}</span><input name="diagnosis" value="${p.diagnosis || ''}"></label>
      <label class="field span-2"><span>${tr('ملاحظات', 'Notes')}</span><textarea name="notes">${p.notes || ''}</textarea></label>
    </div>
    <div class="warn-text" data-dup hidden></div>`;

  const data = await modal({
    title: id ? tr('تعديل بيانات المريض', 'Edit patient') : tr('مريض جديد', 'New patient'),
    body,
    size: 'l',
    onMount: (dlg) => {
      mountPhysicianField(dlg);
      if (focus) dlg.querySelector(`[name=${focus}]`)?.focus();
      const dupBox = dlg.querySelector('[data-dup]');
      const check = () => {
        const m = normMrn(dlg.querySelector('[name=mrn]').value);
        const hit = m && (idx().byMrn.get(m) || []).find((x) => x.id !== id);
        dupBox.hidden = !hit;
        if (hit) dupBox.textContent = tr(`تنبيه: رقم الملف ${m} مسجّل لـ ${hit.name}. إذا كان نفس المريض استخدم «دمج» من صفحة تصحيح البيانات.`, `Warning: file number ${m} belongs to ${hit.name}. If it is the same patient, use Merge on the Data fixes page.`);
      };
      dlg.querySelector('[name=mrn]').addEventListener('input', check);
      check();
    },
    validate: (d) => {
      if (!cleanName(d.name)) return tr('الاسم مطلوب.', 'Name is required.');
      const m = normMrn(d.mrn);
      const hit = m && (idx().byMrn.get(m) || []).find((x) => x.id !== id);
      if (hit && !id) return tr(`رقم الملف ${m} مسجّل لـ ${hit.name}. افتح ملفه بدل إنشاء ملف جديد.`, `File number ${m} belongs to ${hit.name}. Open that record instead of creating a new one.`);
      return null;
    },
  });
  if (!data) return null;
  const patch = {
    name: cleanName(data.name), mrn: normMrn(data.mrn), age: data.age, phone: data.phone ? fixPhone(data.phone) : '',
    phone2: data.phone2 ? fixPhone(data.phone2) : '', physician: readPhysician(data), gender: data.gender, diagnosis: data.diagnosis, notes: data.notes,
  };
  if (id) {
    if (patch.phone !== p.phone) patch.phoneFlag = '';
    upsert('patients', { id, ...patch });
    toast(tr('حُفظت بيانات المريض', 'Patient saved'));
    return id;
  }
  const { create } = await import('./store.js');
  const row = create('patients', patch);
  toast(tr('أُضيف المريض', 'Patient added'));
  return row.id;
}

// ---------- merge ----------
const MERGE_FIELDS = ['name', 'mrn', 'phone', 'phone2', 'age', 'gender', 'physician', 'diagnosis', 'notes'];

export async function mergePatients(ids) {
  const ps = ids.map(patient).filter(Boolean);
  if (ps.length < 2) return;
  const { visitsBy, committeeBy, followupsBy } = idx();
  const links = (p) => (visitsBy.get(p.id) || []).length + (committeeBy.get(p.id) || []).length + (followupsBy.get(p.id) || []).length;
  // Default: the record with more linked rows, then the longer name, is primary.
  const sorted = [...ps].sort((a, b) => links(b) - links(a) || b.name.length - a.name.length);
  const best = (f) => {
    const vals = sorted.map((p) => p[f]).filter((v) => String(v || '').trim());
    if (f === 'name') return sorted.find((p) => p.name === [...vals].sort((a, b) => b.length - a.length)[0])?.id;
    return sorted.find((p) => String(p[f] || '').trim())?.id || sorted[0].id;
  };
  const body = html`
    <p>${tr('اختر القيمة الصحيحة لكل حقل. ستُنقل كل الزيارات وحالات اللجنة والمتابعات إلى الملف الموحّد، ويبقى أثر الدمج في سجل التعديلات.', 'Choose the correct value for each field. All visits, committee cases and follow-ups move to the merged record, and the merge is kept in the change log.')}</p>
    <div class="merge-grid" style="--cols:${ps.length}">
      <div class="merge-row"><div></div>${sorted.map((p) => html`<div><strong>${tr('ملف', 'Record')} ${p.mrn || tr('بدون رقم', 'no number')}</strong><div class="small muted">${links(p)} ${tr('سجل مرتبط', 'linked records')}</div></div>`)}</div>
      ${MERGE_FIELDS.map((f) => html`
        <div class="merge-row"><div>${fieldLabel(f)}</div>
          ${sorted.map((p) => html`<label><input type="radio" name="f_${f}" value="${p.id}" ${best(f) === p.id ? 'checked' : ''}><span style="white-space:pre-wrap">${p[f] || '—'}</span></label>`)}
        </div>`)}
    </div>`;
  const data = await modal({ title: tr('دمج ملفات المريض', 'Merge patient records'), body, primary: tr('دمج الملفات', 'Merge records'), size: 'xl' });
  if (!data) return;

  const primary = sorted[0];
  const merged = {};
  for (const f of MERGE_FIELDS) merged[f] = patient(data['f_' + f] || primary.id)[f] || '';
  merged.mrn = normMrn(merged.mrn);
  merged.phoneFlag = '';
  const others = sorted.slice(1);
  batch(() => {
    upsert('patients', { id: primary.id, ...merged }, { action: 'merge', summary: `${tr('دمج', 'Merged')} ${others.map((o) => `${o.name} (${o.mrn || tr('بدون رقم', 'no number')})`).join(', ')}` });
    for (const o of others) {
      for (const t of ['visits', 'committee', 'followups']) {
        const rows = (t === 'visits' ? visitsBy : t === 'committee' ? committeeBy : followupsBy).get(o.id) || [];
        for (const r of rows) upsert(t, { id: r.id, patientId: primary.id }, false);
      }
      upsert('patients', { id: o.id, deleted: true, mergedInto: primary.id }, { action: 'merge', summary: `${tr('دُمج في ملف', 'Merged into')} ${merged.name}` });
    }
  });
  if (drawerState.id && others.some((o) => o.id === drawerState.id)) drawerState.id = primary.id;
  toast(tr(`دُمجت ${ps.length} ملفات في ملف واحد`, `${ps.length} records merged into one`));
}

export async function deletePatient(id) {
  const p = patient(id);
  const { visitsBy, committeeBy, followupsBy } = idx();
  const n = (visitsBy.get(id) || []).length + (committeeBy.get(id) || []).length + (followupsBy.get(id) || []).length;
  if (n) { toast(tr('لا يمكن حذف مريض له سجلات. إذا كان مكرراً استخدم الدمج.', 'A patient with records cannot be deleted. If it is a duplicate, merge it.'), { type: 'error' }); return; }
  if (!(await confirmBox(`${tr('حذف ملف', 'Delete record of')} ${p.name}?`, { danger: true, confirm: tr('حذف', 'Delete') }))) return;
  remove('patients', id);
  closeDrawer();
  toast(tr('حُذف الملف', 'Record deleted'), { undo: async () => (await import('./store.js')).restore('patients', id) });
}

registerActions({
  'open-patient': (el) => openPatient(el.dataset.id),
  'close-drawer': () => closeDrawer(),
  'edit-patient': (el) => editPatient(el.dataset.id, { focus: el.dataset.focus }),
  'new-patient': async () => { const id = await editPatient(null); if (id) openPatient(id); },
  'merge-patients': (el) => mergePatients(el.dataset.ids.split(',')),
  'delete-patient': (el) => deletePatient(el.dataset.id),
});
