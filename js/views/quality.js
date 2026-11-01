// Data correction centre: every detected problem with patient entries, a one-click
// fix where it is safe, merge for duplicates, and bulk phone entry.
import { html, normMrn, latinDigits } from '../util.js';
import { idx, patient, upsert, batch, note } from '../store.js';
import { issues, ISSUE_DEFS, fixPhone } from '../rules.js';
import { icon, modal, toast, confirmBox, telLink } from '../ui.js';
import { editPatient, mergePatients, openPatient } from '../patient.js';
import { registerActions, ui } from '../registry.js';

export const title = 'تصحيح البيانات';

const SEV_LABEL = { high: 'عالية', mid: 'متوسطة', low: 'منخفضة' };

function issueRow(i) {
  const p = patient(i.patientId) || {};
  let actions;
  if (i.fix === 'merge') actions = html`
    <button class="btn btn-sm btn-primary" data-action="merge-patients" data-ids="${i.patients.map((x) => x.id).join(',')}">${icon('merge', 16)} دمج</button>
    ${i.code === 'DUP_NAME' ? html`<button class="btn btn-sm btn-ghost" data-action="ignore-issue" data-key="${i.key}">ليسوا نفس الشخص</button>` : ''}`;
  else if (i.autofix) actions = html`<button class="btn btn-sm btn-primary" data-action="autofix-one" data-key="${i.key}">${icon('wand', 16)} إصلاح</button>`;
  else if (i.fix === 'record') actions = html`<button class="btn btn-sm" data-action="open-patient" data-id="${i.patientId}">فتح الملف</button>`;
  else actions = html`
    <button class="btn btn-sm btn-primary" data-action="edit-patient" data-id="${i.patientId}" data-focus="${i.field || 'name'}">${icon('edit', 16)} تصحيح</button>
    ${['NO_PHONE', 'SHORT_NAME', 'NO_MRN', 'PHONE_FORMAT'].includes(i.code) ? html`<button class="btn btn-sm btn-ghost" data-action="ignore-issue" data-key="${i.key}">تجاهل</button>` : ''}`;

  return html`
    <tr>
      <td><span class="sev ${i.sev}">${SEV_LABEL[i.sev]}</span></td>
      <td>${i.l}${i.detail ? html`<div class="small muted ltr" style="text-align:start">${i.detail}</div>` : ''}</td>
      <td>${i.patients
        ? i.patients.map((x) => html`<div><button class="patient-link" data-action="open-patient" data-id="${x.id}">${x.name}</button> <span class="mrn">${x.mrn || 'بدون رقم'}</span></div>`)
        : html`<button class="patient-link" data-action="open-patient" data-id="${i.patientId}">${p.name || '—'}</button> <span class="mrn">${p.mrn || ''}</span>`}</td>
      <td>${i.patients ? '' : telLink(p.phone)}</td>
      <td><div class="row" style="gap:6px; justify-content:flex-end">${actions}</div></td>
    </tr>`;
}

export function render() {
  const all = issues();
  const byCode = new Map();
  for (const i of all) byCode.set(i.code, (byCode.get(i.code) || 0) + 1);
  if (ui.qualityCode !== 'ALL' && !byCode.has(ui.qualityCode)) ui.qualityCode = 'ALL';
  const shown = ui.qualityCode === 'ALL' ? all : all.filter((i) => i.code === ui.qualityCode);
  const autofixable = all.filter((i) => i.autofix).length;

  return html`
    <div class="toolbar">
      <p class="muted" style="max-width:640px">كل ملاحظة هنا مرتبطة بملف مريض. التصحيح يتم مرة واحدة في الملف فيظهر في العيادة واللجنة والمتابعات معاً، ويُسجَّل في سجل التعديلات.</p>
      <span class="spacer"></span>
      <button class="btn" data-action="bulk-phones">${icon('phone')} لصق أرقام هواتف دفعة واحدة</button>
      ${autofixable ? html`<button class="btn btn-primary" data-action="autofix-all">${icon('wand')} إصلاح تلقائي آمن (${autofixable})</button>` : ''}
    </div>

    ${all.length ? html`
    <div class="issue-cards">
      <button class="issue-card ${ui.qualityCode === 'ALL' ? 'active' : ''}" data-action="q-code" data-v="ALL"><b>${all.length}</b>كل الملاحظات</button>
      ${Object.entries(ISSUE_DEFS).filter(([c]) => byCode.has(c)).map(([c, d]) => html`
        <button class="issue-card ${ui.qualityCode === c ? 'active' : ''}" data-action="q-code" data-v="${c}"><b>${byCode.get(c)}</b><span class="sev ${d.sev}">${d.l}</span></button>`)}
    </div>
    <div class="panel"><div class="table-wrap"><table class="data">
      <thead><tr><th>الأهمية</th><th>الملاحظة</th><th>المريض</th><th>الهاتف</th><th></th></tr></thead>
      <tbody>${shown.slice(0, 300).map(issueRow)}</tbody>
    </table></div>
    ${shown.length > 300 ? html`<div class="panel-body small muted">يُعرض أول 300 من ${shown.length}. أصلح هذه أو استخدم الإصلاح التلقائي لتظهر البقية.</div>` : ''}</div>`
    : html`<div class="panel empty"><strong>البيانات نظيفة</strong>لا توجد أرقام مكررة أو ناقصة أو بصيغة خاطئة.</div>`}`;
}

// ---------- actions ----------
const findIssue = (key) => issues().find((i) => i.key === key);

function applyAutofix(list) {
  batch(() => {
    for (const i of list) upsert('patients', { id: i.patientId, ...i.autofix }, { summary: `إصلاح تلقائي: ${i.l}` });
  });
}

async function bulkPhones() {
  const data = await modal({
    title: 'لصق أرقام الهواتف',
    size: 'l',
    body: html`
      <p class="muted">الصق سطراً لكل مريض: رقم الملف ثم الهاتف (يمكن النسخ مباشرة من عمودين في Excel).</p>
      <label class="field"><textarea name="text" rows="8" class="ltr" placeholder="123456	0599123456&#10;654321	0568765432" autofocus></textarea></label>
      <label class="check"><input type="checkbox" name="overwrite"> استبدال الأرقام الموجودة أيضاً (افتراضياً تُملأ الفارغة فقط)</label>
      <div data-prev class="small"></div>`,
    primary: 'حفظ الأرقام',
    onMount: (dlg) => {
      const ta = dlg.querySelector('[name=text]'); const prev = dlg.querySelector('[data-prev]');
      ta.addEventListener('input', () => {
        const r = parsePhones(ta.value, dlg.querySelector('[name=overwrite]').checked);
        prev.innerHTML = String(html`<span class="chip green">سيُحدَّث ${r.updates.length}</span> <span class="chip">لديهم رقم ${r.kept}</span> <span class="chip red">رقم ملف غير موجود ${r.missing.length}</span>${r.missing.length ? html`<div class="muted ltr" style="margin-top:6px">${r.missing.slice(0, 20).join('، ')}</div>` : ''}`);
      });
    },
    validate: (d) => (!parsePhones(d.text, d.overwrite).updates.length ? 'لا توجد أرقام جديدة لحفظها.' : null),
  });
  if (!data) return;
  const r = parsePhones(data.text, data.overwrite);
  batch(() => {
    for (const u of r.updates) upsert('patients', { id: u.id, phone: u.phone, phoneFlag: '' }, false);
    note(`لصق أرقام هواتف: ${r.updates.length} مريض`);
  });
  toast(`حُفظ ${r.updates.length} رقم هاتف`);
}

function parsePhones(text, overwrite) {
  const updates = []; const missing = []; let kept = 0;
  for (const line of String(text || '').split(/\r?\n/)) {
    const parts = latinDigits(line).trim().split(/[\t,;]+|\s{2,}|\s(?=\+?\d{7,})/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const mrn = normMrn(parts[0]);
    const p = idx().byMrn.get(mrn)?.[0];
    if (!p) { missing.push(parts[0]); continue; }
    if (p.phone && !overwrite) { kept++; continue; }
    updates.push({ id: p.id, phone: fixPhone(parts[1]) });
  }
  return { updates, missing, kept };
}

registerActions({
  'q-code': (el) => { ui.qualityCode = el.dataset.v; },
  'autofix-one': (el) => { const i = findIssue(el.dataset.key); if (i) { applyAutofix([i]); toast('تم الإصلاح'); } },
  'autofix-all': async () => {
    const list = issues().filter((i) => i.autofix);
    if (!(await confirmBox(`سيُصلَح ${list.length} سجل تلقائياً: توحيد صيغة أرقام الملفات، إرجاع الصفر الأول لأرقام الهواتف، وتنظيف المسافات والأرقام العربية في الأسماء. كل تغيير يُسجَّل ويمكن مراجعته في ملف المريض.`, { confirm: 'إصلاح' }))) return;
    applyAutofix(list);
    toast(`أُصلح ${list.length} سجل`);
  },
  'ignore-issue': (el) => {
    const i = findIssue(el.dataset.key);
    if (!i) return;
    const targets = i.patients || [patient(i.patientId)];
    batch(() => targets.forEach((p) => upsert('patients', { id: p.id, ignoredIssues: [...(p.ignoredIssues || []), i.key] }, { summary: `تجاهل: ${i.l}` })));
  },
  'fix-issue': (el) => {
    const i = findIssue(el.dataset.key);
    if (!i) return;
    if (i.fix === 'merge') mergePatients(i.patients.map((p) => p.id));
    else if (i.autofix) { applyAutofix([i]); toast('تم الإصلاح'); }
    else if (i.fix === 'record') openPatient(i.patientId);
    else editPatient(i.patientId, { focus: i.field });
  },
  'bulk-phones': () => bulkPhones(),
});
