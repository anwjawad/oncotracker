// Patient record: drawer with timeline, edit form with duplicate guard, merge.
import { html, esc, $, normMrn, normName, cleanName, cleanPhysician, phoneDigits, fmtDate, fmtTime, relDay, todayISO } from './util.js';
import { idx, patient, upsert, remove, batch, store, note } from './store.js';
import { issuesFor, fuLabel, CASE_STATUS, caseStage, attemptLabel, fixPhone } from './rules.js';
import { icon, modal, toast, confirmBox, physicianOptions, telLink, dueChip } from './ui.js';
import { registerActions } from './registry.js';

export const drawerState = { id: null };

const FIELD_LABELS = {
  name: 'الاسم', mrn: 'رقم الملف', phone: 'الهاتف', phone2: 'هاتف آخر', age: 'العمر', gender: 'الجنس',
  physician: 'الطبيب', diagnosis: 'التشخيص', notes: 'ملاحظات', plan: 'الخطة', opcDate: 'موعد العيادة',
  permit: 'التصريح', referral: 'التحويل', notified: 'التبليغ', briefHistory: 'القصة المرضية', question: 'السؤال للجنة',
  decision: 'القرار', status: 'الحالة', sessionDate: 'تاريخ الجلسة', dueDate: 'تاريخ الاستحقاق', title: 'المهمة',
  outcome: 'النتيجة', deleted: 'محذوف', patientId: 'المريض', mergedInto: 'دُمج في', phoneFlag: 'تنبيه الهاتف',
  autoClosed: 'إغلاق المهمة التلقائية', attempts: 'المحاولات', addenda: 'الملاحق', noteUrl: 'المرفق', type: 'النوع',
  ignoredIssues: 'تنبيهات متجاهلة', decidedAt: 'تاريخ القرار', closedAt: 'تاريخ الإغلاق', deferredToId: 'أُجّل إلى',
};
const TABLE_LABELS = { patients: 'الملف', visits: 'زيارة العيادة', committee: 'اللجنة', followups: 'متابعة' };
const ACTION_LABELS = { create: 'إنشاء', update: 'تعديل', delete: 'حذف', restore: 'استرجاع', note: '', merge: 'دمج' };

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
  const visits = (visitsBy.get(p.id) || []).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  const cases = (committeeBy.get(p.id) || []).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  const fus = (followupsBy.get(p.id) || []).sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(a.dueDate).localeCompare(String(b.dueDate)));
  const issues = issuesFor(p.id);
  const activity = store.data.activity.filter((a) => a.patientId === p.id).slice(0, 60);

  el.innerHTML = String(html`
    <div class="drawer-head">
      <div class="row-between">
        <h2>${p.name || 'بدون اسم'}</h2>
        <div class="row">
          <button class="btn btn-sm" data-action="edit-patient" data-id="${p.id}">${icon('edit', 16)} تعديل البيانات</button>
          <button class="icon-btn" data-action="close-drawer" aria-label="إغلاق">${icon('x')}</button>
        </div>
      </div>
      <div class="facts">
        <span>رقم الملف: <b class="ltr">${p.mrn || '—'}</b></span>
        <span>الهاتف: ${telLink(p.phone)}${p.phoneFlag === 'wrong' ? html` <span class="chip red">أُبلغ أنه خاطئ</span>` : ''}</span>
        ${p.age ? html`<span>العمر: ${p.age}</span>` : ''}
        ${p.physician ? html`<span>الطبيب: ${p.physician}</span>` : ''}
        ${p.diagnosis ? html`<span>التشخيص: ${p.diagnosis}</span>` : ''}
      </div>
      ${issues.length ? html`<div class="issue-strip">${issues.map((i) => html`
        <button class="chip ${i.sev === 'high' ? 'red' : i.sev === 'mid' ? 'amber' : ''}" data-action="fix-issue" data-key="${i.key}" title="اضغط للإصلاح">${icon('alert', 13)} ${i.l}</button>`)}</div>` : ''}
    </div>
    <div class="drawer-body">
      <section class="panel">
        <div class="panel-head"><h3>المتابعات</h3>
          <button class="btn btn-sm" data-action="new-followup" data-patient="${p.id}">${icon('plus', 16)} متابعة</button></div>
        ${fus.length ? html`<ul class="mini-list">${fus.map((f) => html`
          <li>
            <div>
              <div><span class="chip outline">${fuLabel(f.type)}</span> <strong>${f.title}</strong></div>
              ${f.status === 'done'
                ? html`<div class="small muted">أُنجزت ${fmtTime(f.closedAt)} — ${f.outcome}</div>`
                : f.status === 'cancelled' ? html`<div class="small muted">أُلغيت — ${f.outcome}</div>`
                : html`<div class="small">${dueChip(f.dueDate, f.status)}</div>`}
              ${(f.attempts || []).length ? html`<div class="attempts">${f.attempts.length} محاولة، آخرها: ${attemptLabel(f.attempts.at(-1).result)} (${fmtTime(f.attempts.at(-1).at)})</div>` : ''}
            </div>
            ${f.status === 'open' || f.status === 'waiting' ? html`<button class="btn btn-sm" data-action="finish-task" data-id="${f.id}">${icon('check', 16)} إنهاء</button>` : ''}
          </li>`)}</ul>` : html`<div class="empty">لا توجد متابعات لهذا المريض.</div>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>لجنة الحالات الجديدة</h3>
          <button class="btn btn-sm" data-action="refer-committee" data-patient="${p.id}">${icon('send', 16)} إدراج في اللجنة</button></div>
        ${cases.length ? html`<ul class="mini-list">${cases.map((c) => html`
          <li><div>
            <div><strong>${fmtDate(c.sessionDate, 'med')}</strong> <span class="chip ${CASE_STATUS[caseStage(c, p)]?.chip || 'blue'}">${CASE_STATUS[c.status]?.l || 'مُدرج'}</span> <span class="muted small">${c.physician}</span></div>
            ${c.decision ? html`<div class="small"><b>القرار:</b> ${c.decision}</div>` : c.plan ? html`<div class="small muted">الخطة المقترحة: ${c.plan}</div>` : ''}
          </div>
          <a class="btn btn-sm btn-ghost" href="#/committee?date=${c.sessionDate}" data-action="close-drawer">فتح الجلسة</a></li>`)}</ul>`
          : html`<div class="empty">لم يُعرض على اللجنة.</div>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>زيارات العيادة</h3>
          <button class="btn btn-sm" data-action="new-visit" data-patient="${p.id}">${icon('plus', 16)} زيارة</button></div>
        ${visits.length ? html`<ul class="mini-list">${visits.map((v) => html`
          <li><div>
            <div><strong>${fmtDate(v.sessionDate, 'med')}</strong> <span class="muted small">${v.physician}</span>
              ${v.notified === 'Y' ? html`<span class="chip green">${icon('check', 12)} تم التبليغ</span>` : ''}</div>
            ${v.plan ? html`<div class="small" style="white-space:pre-wrap">${v.plan}</div>` : ''}
            <div class="small muted">${v.opcDate ? `الموعد القادم: ${fmtDate(v.opcDate, 'med')}` : 'بدون موعد قادم'}
              ${v.permit ? ` · تصريح: ${v.permit === 'Y' ? 'نعم' : 'لا'}` : ''}${v.referral ? ` · تحويل: ${v.referral === 'Y' ? 'نعم' : 'لا'}` : ''}</div>
            ${v.noteUrl ? html`<a class="small" href="${v.noteUrl}" target="_blank" rel="noopener">${icon('file', 14)} المرفق</a>` : ''}
          </div>
          <a class="btn btn-sm btn-ghost" href="#/clinic?date=${v.sessionDate}" data-action="close-drawer">فتح القائمة</a></li>`)}</ul>`
          : html`<div class="empty">لا توجد زيارات.</div>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>سجل التعديلات</h3><span class="muted small">من عدّل ماذا ومتى</span></div>
        ${activity.length ? html`<ul class="timeline" style="padding:0 18px">${activity.map(activityItem)}</ul>` : html`<div class="empty">لا يوجد سجل بعد.</div>`}
      </section>

      ${p.notes ? html`<section class="panel"><div class="panel-head"><h3>ملاحظات</h3></div><div class="panel-body" style="white-space:pre-wrap">${p.notes}</div></section>` : ''}
    </div>`);
}

function activityItem(a) {
  const changes = (a.changes || []).filter((c) => !['custom', 'ignoredIssues'].includes(c.f));
  const what = a.action === 'note' ? a.summary : `${ACTION_LABELS[a.action] ?? a.action} ${TABLE_LABELS[a.table] || ''}${a.summary ? ' — ' + a.summary : ''}`;
  return html`<li>
    <div class="when">${fmtTime(a.at)}${a.by ? html`<br>${a.by}` : ''}</div>
    <div>
      <div>${what}</div>
      ${changes.slice(0, 6).map((c) => html`<div class="change">${FIELD_LABELS[c.f] || c.f}: ${c.from ? html`<del>${c.from}</del> ← ` : ''}<ins>${c.to || '(فارغ)'}</ins></div>`)}
    </div>
  </li>`;
}

// ---------- edit / create ----------
export async function editPatient(id, { focus } = {}) {
  const p = id ? patient(id) : { name: '', mrn: '', phone: '' };
  const body = html`
    ${physicianOptions()}
    <div class="grid-2">
      <label class="field span-2"><span>الاسم الكامل</span><input name="name" value="${p.name}" required>
        <span class="hint">اكتب الاسم رباعياً كما في الهوية؛ لا تختصره.</span></label>
      <label class="field"><span>رقم الملف</span><input name="mrn" class="ltr" value="${p.mrn}"></label>
      <label class="field"><span>العمر</span><input name="age" value="${p.age || ''}" inputmode="numeric"></label>
      <label class="field"><span>الهاتف</span><input name="phone" class="ltr" value="${p.phone}" inputmode="tel"></label>
      <label class="field"><span>هاتف آخر</span><input name="phone2" class="ltr" value="${p.phone2 || ''}" inputmode="tel"></label>
      <label class="field"><span>الطبيب المتابع</span><input name="physician" list="physician-list" value="${p.physician || ''}"></label>
      <label class="field"><span>الجنس</span><select name="gender">
        <option value="" ${!p.gender ? 'selected' : ''}>—</option><option value="M" ${p.gender === 'M' ? 'selected' : ''}>ذكر</option><option value="F" ${p.gender === 'F' ? 'selected' : ''}>أنثى</option></select></label>
      <label class="field span-2"><span>التشخيص</span><input name="diagnosis" value="${p.diagnosis || ''}"></label>
      <label class="field span-2"><span>ملاحظات</span><textarea name="notes">${p.notes || ''}</textarea></label>
    </div>
    <div class="warn-text" data-dup hidden></div>`;

  const data = await modal({
    title: id ? 'تعديل بيانات المريض' : 'مريض جديد',
    body,
    size: 'l',
    onMount: (dlg) => {
      if (focus) dlg.querySelector(`[name=${focus}]`)?.focus();
      const dupBox = dlg.querySelector('[data-dup]');
      const check = () => {
        const m = normMrn(dlg.querySelector('[name=mrn]').value);
        const hit = m && (idx().byMrn.get(m) || []).find((x) => x.id !== id);
        dupBox.hidden = !hit;
        if (hit) dupBox.textContent = `تنبيه: رقم الملف ${m} مسجّل لـ ${hit.name}. إذا كان نفس المريض استخدم «دمج» من صفحة تصحيح البيانات.`;
      };
      dlg.querySelector('[name=mrn]').addEventListener('input', check);
      check();
    },
    validate: (d) => {
      if (!cleanName(d.name)) return 'الاسم مطلوب.';
      const m = normMrn(d.mrn);
      const hit = m && (idx().byMrn.get(m) || []).find((x) => x.id !== id);
      if (hit && !id) return `رقم الملف ${m} مسجّل لـ ${hit.name}. افتح ملفه بدل إنشاء ملف جديد.`;
      return null;
    },
  });
  if (!data) return null;
  const patch = {
    name: cleanName(data.name), mrn: normMrn(data.mrn), age: data.age, phone: fixPhone(data.phone),
    phone2: fixPhone(data.phone2), physician: cleanPhysician(data.physician), gender: data.gender, diagnosis: data.diagnosis, notes: data.notes,
  };
  if (!data.phone) patch.phone = '';
  if (!data.phone2) patch.phone2 = '';
  if (id) {
    if (patch.phone !== p.phone) patch.phoneFlag = '';
    upsert('patients', { id, ...patch });
    toast('حُفظت بيانات المريض');
    return id;
  }
  const { create } = await import('./store.js');
  const row = create('patients', patch);
  toast('أُضيف المريض');
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
    <p>اختر القيمة الصحيحة لكل حقل. ستُنقل كل الزيارات وحالات اللجنة والمتابعات إلى الملف الموحّد، ويبقى أثر الدمج في سجل التعديلات.</p>
    <div class="merge-grid" style="--cols:${ps.length}">
      <div class="merge-row"><div></div>${sorted.map((p) => html`<div><strong>ملف ${p.mrn || 'بدون رقم'}</strong><div class="small muted">${links(p)} سجل مرتبط</div></div>`)}</div>
      ${MERGE_FIELDS.map((f) => html`
        <div class="merge-row"><div>${FIELD_LABELS[f]}</div>
          ${sorted.map((p) => html`<label><input type="radio" name="f_${f}" value="${p.id}" ${best(f) === p.id ? 'checked' : ''}><span style="white-space:pre-wrap">${p[f] || '—'}</span></label>`)}
        </div>`)}
    </div>`;
  const data = await modal({ title: 'دمج ملفات المريض', body, primary: 'دمج الملفات', size: 'xl' });
  if (!data) return;

  const primary = sorted[0];
  const merged = {};
  for (const f of MERGE_FIELDS) merged[f] = patient(data['f_' + f] || primary.id)[f] || '';
  merged.mrn = normMrn(merged.mrn);
  merged.phoneFlag = '';
  const others = sorted.slice(1);
  batch(() => {
    upsert('patients', { id: primary.id, ...merged }, { action: 'merge', summary: `دمج ${others.map((o) => `${o.name} (${o.mrn || 'بدون رقم'})`).join('، ')}` });
    for (const o of others) {
      for (const t of ['visits', 'committee', 'followups']) {
        const rows = (t === 'visits' ? visitsBy : t === 'committee' ? committeeBy : followupsBy).get(o.id) || [];
        for (const r of rows) upsert(t, { id: r.id, patientId: primary.id }, false);
      }
      upsert('patients', { id: o.id, deleted: true, mergedInto: primary.id }, { action: 'merge', summary: `دُمج في ملف ${merged.name}` });
    }
  });
  if (drawerState.id && others.some((o) => o.id === drawerState.id)) drawerState.id = primary.id;
  toast(`دُمجت ${ps.length} ملفات في ملف واحد`);
}

export async function deletePatient(id) {
  const p = patient(id);
  const { visitsBy, committeeBy, followupsBy } = idx();
  const n = (visitsBy.get(id) || []).length + (committeeBy.get(id) || []).length + (followupsBy.get(id) || []).length;
  if (n) { toast('لا يمكن حذف مريض له سجلات. إذا كان مكرراً استخدم الدمج.', { type: 'error' }); return; }
  if (!(await confirmBox(`حذف ملف ${p.name}؟`, { danger: true, confirm: 'حذف' }))) return;
  remove('patients', id);
  closeDrawer();
  toast('حُذف الملف', { undo: async () => (await import('./store.js')).restore('patients', id) });
}

registerActions({
  'open-patient': (el) => openPatient(el.dataset.id),
  'close-drawer': () => closeDrawer(),
  'edit-patient': (el) => editPatient(el.dataset.id, { focus: el.dataset.focus }),
  'new-patient': async () => { const id = await editPatient(null); if (id) openPatient(id); },
  'merge-patients': (el) => mergePatients(el.dataset.ids.split(',')),
  'delete-patient': (el) => deletePatient(el.dataset.id),
});
