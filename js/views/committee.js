// New-cases committee: sessions by date, an agenda that moves each case through
// listed → ready → presented (decision recorded, then locked with addenda) or
// deferred to a later session; decisions spawn follow-ups directly.
import { html, todayISO, addDays, fmtDate, fmtTime, nextWeekday, matchesQuery, uniq, byText, isISODate, count } from '../util.js';
import { idx, patient, get, create, upsert, remove, restore, batch } from '../store.js';
import { CASE_STATUS, readiness, caseStage, FU_TYPES, fuLabel } from '../rules.js';
import { icon, modal, toast, confirmBox, menu, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker, physicianFieldHTML, mountPhysicianField, readPhysician } from '../ui.js';
import { settings } from '../settings.js';
import { printTable } from '../print.js';
import { openImport } from '../importer.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('لجنة الحالات الجديدة', 'New Cases Committee');

const casesText = (n) => count(n, ['حالة واحدة', 'حالتان', 'حالات', 'حالة'], ['case', 'cases']);
const docKey = (c) => c.physician || '';

export const nextSession = (from = todayISO()) => nextWeekday(settings.get('committeeDay'), from);

export function onRoute(params) {
  if (isISODate(params.get('date'))) ui.committeeDate = params.get('date');
  if (!ui.committeeDate) {
    // Default: the nearest session today or later that has cases, else the next committee day.
    const dates = uniq(idx().lists.committee.map((c) => c.sessionDate)).filter((d) => d >= todayISO()).sort();
    ui.committeeDate = dates[0] || nextSession();
  }
}

function sessions() {
  const counts = new Map();
  for (const c of idx().lists.committee) counts.set(c.sessionDate, (counts.get(c.sessionDate) || 0) + 1);
  const today = todayISO();
  const nxt = nextSession();
  if (!counts.has(nxt)) counts.set(nxt, 0);
  if (!counts.has(ui.committeeDate)) counts.set(ui.committeeDate, 0);
  const all = [...counts.keys()].filter(Boolean).sort();
  const past = all.filter((d) => d < today).slice(-6);
  const future = all.filter((d) => d >= today);
  return { list: [...past, ...future], counts };
}

const readyToggle = (checked) => html`
  <label class="ready-toggle"><input type="checkbox" name="ready" ${checked ? 'checked' : ''}>
    <span>${icon('check', 16)} ${tr('جاهز', 'Ready')}</span>
    <small>${tr('بيانات المريض مكتملة ولا يحتاج متابعة قبل العرض', 'Patient info is complete — nothing to chase before the meeting')}</small></label>`;

function caseCard(c) {
  const p = patient(c.patientId) || {};
  const stage = caseStage(c, p);
  const r = readiness(c, p);
  const locked = c.status === 'presented';
  const open = !['presented', 'deferred', 'withdrawn'].includes(c.status);
  const st = CASE_STATUS[stage] || CASE_STATUS.listed;
  const fus = (idx().followupsBy.get(c.patientId) || []).filter((f) => f.sourceType === 'committee' && f.sourceId === c.id);
  const carried = c.carriedFromId && get('committee', c.carriedFromId);
  const deferredTo = c.deferredToId && get('committee', c.deferredToId);
  const ta = (field, label, ph) => html`
    <label class="field"><span>${label}</span>
      <textarea class="cell-input" style="border-color:var(--line)" data-change="case-field" data-id="${c.id}" data-field="${field}" data-key="c-${c.id}-${field}" placeholder="${ph}" ${locked ? 'readonly' : ''}>${c[field] || ''}</textarea></label>`;

  return html`
  <article class="case" data-stage="${stage}">
    <div class="case-no" aria-hidden="true"></div>
    <div>
      <div class="case-top">
        <div>
          <button class="patient-link case-name" data-action="open-patient" data-id="${c.patientId}">${p.name || tr('مريض غير معروف', 'Unknown patient')}</button>
          <span class="mrn">${p.mrn || tr('بدون رقم ملف', 'no file number')}</span>
          <div class="small muted">${dr(c.physician)}${carried ? ` · ${tr('مؤجّلة من جلسة', 'deferred from')} ${fmtDate(carried.sessionDate)}` : ''}${c.sourceVisitId ? ` · ${tr('محالة من العيادة', 'referred from clinic')}` : ''}</div>
        </div>
        <div class="case-actions">
          ${open ? html`<button class="ready-btn ${c.ready === '1' ? 'on' : ''}" data-action="case-ready" data-id="${c.id}" aria-pressed="${String(c.ready === '1')}" title="${tr('اضغط لتعليم المريض جاهزاً أو إلغاء ذلك', 'Click to mark the patient ready, or to undo')}">${icon('check', 15)} ${tr('جاهز', 'Ready')}</button>`
            : html`<span class="chip ${st.chip}">${st.l}</span>`}
          ${open ? html`
            <button class="btn btn-sm btn-primary" data-action="case-decide" data-id="${c.id}">${tr('تسجيل القرار', 'Record decision')}</button>
            <button class="btn btn-sm" data-action="case-defer" data-id="${c.id}">${icon('clock', 16)} ${tr('تأجيل', 'Defer')}</button>` : ''}
          ${locked ? html`<button class="btn btn-sm" data-action="case-addendum" data-id="${c.id}">${icon('plus', 16)} ${tr('ملحق', 'Addendum')}</button>` : ''}
          ${menu(html`
            <button data-action="open-patient" data-id="${c.patientId}">${icon('user', 16)} ${tr('ملف المريض', 'Patient record')}</button>
            <button data-action="case-edit" data-id="${c.id}">${icon('edit', 16)} ${tr('تعديل الطبيب والتاريخ', 'Change doctor or date')}</button>
            <button data-action="new-followup-case" data-id="${c.id}">${icon('plus', 16)} ${tr('متابعة لهذه الحالة', 'Follow-up for this case')}</button>
            ${c.status === 'withdrawn' || c.status === 'deferred' ? html`<button data-action="case-reopen" data-id="${c.id}">${icon('undo', 16)} ${tr('إرجاعها مُدرجة', 'Put back on agenda')}</button>` : ''}
            ${c.status !== 'withdrawn' && c.status !== 'presented' ? html`<button data-action="case-withdraw" data-id="${c.id}">${icon('x', 16)} ${tr('سحب من الجدول', 'Withdraw from agenda')}</button>` : ''}
            <hr><button class="danger" data-action="case-delete" data-id="${c.id}">${icon('trash', 16)} ${tr('حذف', 'Delete')}</button>`)}
        </div>
      </div>

      <div class="case-fields">
        ${ta('briefHistory', tr('القصة المرضية', 'Brief history'), tr('التشخيص، الباثولوجي، الصور، العلاجات السابقة…', 'Diagnosis, pathology, imaging, previous treatment…'))}
        ${ta('question', tr('السؤال المطروح على اللجنة / الخطة المقترحة', 'Question for the committee / proposed plan'), tr('مثال: هل يُحوّل للجراحة أم علاج كيماوي أولاً؟', 'e.g. Surgery first or neoadjuvant chemotherapy?'))}
      </div>
      ${open ? (c.ready === '1'
        ? html`<div class="readiness"><span class="ok">✓ ${tr('علّمه المنسّق جاهزاً', 'Marked ready by coordinator')}</span></div>`
        : html`<div class="readiness">${r.items.map((i) => html`<span class="${i.ok ? 'ok' : 'miss'}">${i.ok ? '✓' : '✗'} ${i.l}</span>`)}</div>`) : ''}
      ${c.notes ? html`<div class="small muted" style="margin-top:6px; white-space:pre-wrap">${c.notes}</div>` : ''}

      ${locked ? html`
        <div class="decision">
          <h4>${tr('قرار اللجنة', 'Committee decision')} ${c.decidedAt ? html`<span class="muted">— ${fmtTime(c.decidedAt)}</span>` : ''}</h4>
          <div class="text">${c.decision || tr('لم يُسجّل نص القرار.', 'No decision text recorded.')}</div>
          ${(c.addenda || []).map((a) => html`<div class="addendum"><b>${tr('ملحق', 'Addendum')} ${fmtTime(a.at)}${a.by ? ` — ${a.by}` : ''}:</b> ${a.text}</div>`)}
          ${fus.length ? html`<div class="row" style="margin-top:8px">${fus.map((f) => html`<span class="chip ${f.status === 'done' ? 'green' : 'outline'}">${f.status === 'done' ? '✓' : '○'} ${fuLabel(f.type)}: ${f.title}</span>`)}</div>` : ''}
        </div>` : ''}
      ${c.status === 'deferred' && deferredTo ? html`<div class="decision" style="background:var(--amber-soft); border-color:var(--amber)"><h4 style="color:var(--amber)">${tr('أُجّلت إلى جلسة', 'Deferred to session')} ${fmtDate(deferredTo.sessionDate, 'med')}</h4><div class="text">${c.decision}</div></div>` : ''}
    </div>
  </article>`;
}

export function render() {
  const date = ui.committeeDate;
  const { list: dates, counts } = sessions();
  const today = todayISO();
  const session = idx().lists.committee.filter((c) => c.sessionDate === date);
  const doctors = uniq(session.map(docKey)).sort(byText);
  if (ui.committeeDoctor !== 'ALL' && !doctors.includes(ui.committeeDoctor)) ui.committeeDoctor = 'ALL';
  let cases = ui.committeeDoctor === 'ALL' ? session : session.filter((c) => docKey(c) === ui.committeeDoctor);
  const stages = cases.map((c) => caseStage(c, patient(c.patientId)));
  const n = (s) => stages.filter((x) => x === s).length;
  const total = cases.filter((c) => c.status !== 'withdrawn').length;

  if (ui.committeeFilter !== 'all') cases = cases.filter((c) => caseStage(c, patient(c.patientId)) === ui.committeeFilter);
  if (ui.committeeQuery) cases = cases.filter((c) => { const p = patient(c.patientId) || {}; return matchesQuery(ui.committeeQuery, p.name, p.mrn, c.physician, c.briefHistory); });

  const groups = new Map();
  for (const c of cases.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const k = docKey(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const pct = (x) => (total ? (x / total) * 100 : 0);

  return html`
    <div class="session-strip" role="tablist" aria-label="${tr('الجلسات', 'Sessions')}">
      ${dates.map((d) => html`
        <button class="session-chip ${d === date ? 'active' : ''} ${d < today ? 'past' : ''}" data-action="cm-date" data-v="${d}" role="tab" aria-selected="${String(d === date)}">
          <span class="d">${fmtDate(d, 'med')}</span>
          <span class="s">${counts.get(d) ? casesText(counts.get(d)) : tr('لا حالات', 'No cases')}${d === today ? tr(' · اليوم', ' · today') : ''}</span>
        </button>`)}
      <label class="session-chip" style="cursor:default"><span class="s">${tr('جلسة أخرى', 'Other session')}</span><input type="date" class="input" style="min-height:30px; padding:2px 6px" value="${date}" data-change="cm-date-pick"></label>
    </div>

    <div class="session-head">
      <div>
        <h2>${tr('جلسة', 'Session')} ${fmtDate(date, 'long')}</h2>
        <div class="row small muted" style="margin-top:4px">
          <span>${total ? casesText(total) : tr('لا حالات', 'No cases')}</span><span>·</span>
          <span style="color:var(--blue)">${n('ready')} ${tr('جاهزة', 'ready')}</span><span>·</span>
          <span style="color:var(--red)">${n('listed')} ${tr('غير جاهزة', 'not ready')}</span><span>·</span>
          <span style="color:var(--accent-ink)">${n('presented')} ${tr('عُرضت', 'presented')}</span>
          ${n('deferred') ? html`<span>·</span><span style="color:var(--amber)">${n('deferred')} ${tr('مؤجّلة', 'deferred')}</span>` : ''}
        </div>
        <div class="progress" title="${tr('تقدّم الجلسة', 'Session progress')}">
          <span style="width:${pct(n('presented'))}%; background:var(--accent)"></span>
          <span style="width:${pct(n('deferred'))}%; background:var(--amber)"></span>
          <span style="width:${pct(n('ready'))}%; background:var(--blue)"></span>
        </div>
      </div>
      <div class="row">
        <button class="btn" data-action="cm-import">${icon('upload')} ${tr('استيراد Excel', 'Import Excel')}</button>
        <button class="btn" data-action="cm-print" data-v="agenda">${icon('print')} ${tr('جدول الأعمال', 'Agenda')}</button>
        <button class="btn" data-action="cm-print" data-v="minutes">${icon('print')} ${tr('محضر القرارات', 'Minutes')}</button>
        <button class="btn btn-primary" data-action="cm-add">${icon('plus')} ${tr('إدراج حالة', 'Add case')}</button>
      </div>
    </div>

    ${doctors.length ? html`<div class="tabs">
      <button class="tab ${ui.committeeDoctor === 'ALL' ? 'active' : ''}" data-action="cm-doctor" data-v="ALL">${tr('كل الأطباء', 'All doctors')} <span class="n">${session.length}</span></button>
      ${doctors.map((d) => html`<button class="tab ${ui.committeeDoctor === d ? 'active' : ''}" data-action="cm-doctor" data-v="${d}">${dr(d)} <span class="n">${session.filter((c) => docKey(c) === d).length}</span></button>`)}
    </div>` : ''}

    <div class="toolbar">
      <div class="tabs" style="margin:0">
        ${[['all', tr('الكل', 'All')], ['listed', tr('غير جاهزة', 'Not ready')], ['ready', tr('جاهزة', 'Ready')], ['presented', tr('عُرضت', 'Presented')], ['deferred', tr('مؤجّلة', 'Deferred')]].map(([k, l]) => html`
          <button class="tab ${ui.committeeFilter === k ? 'active' : ''}" data-action="cm-filter" data-v="${k}">${l}${k !== 'all' ? html` <span class="n">${n(k)}</span>` : ''}</button>`)}
      </div>
      <label class="search-box"><input class="input" type="search" placeholder="${tr('بحث في هذه الجلسة', 'Search this session')}" value="${ui.committeeQuery}" data-input="cm-q" data-key="cm-q">${icon('search', 16)}</label>
    </div>

    ${cases.length ? html`<div class="agenda">${[...groups].map(([doc, rows]) => html`
        ${ui.committeeDoctor === 'ALL' ? html`<div class="agenda-group">${dr(doc)} — ${rows.length}</div>` : ''}${rows.map(caseCard)}`)}</div>`
      : html`<div class="panel empty"><strong>${total ? tr('لا حالات تطابق الفلتر', 'No cases match this filter') : tr('لا توجد حالات في هذه الجلسة بعد', 'No cases in this session yet')}</strong>
          ${total ? '' : tr('أدرج حالة من زر «إدراج حالة»، أو أحِلها من قائمة حجوزات العيادة، أو استورد ملف Excel.', 'Use "Add case", refer one from the post-clinic list, or import an Excel file.')}</div>`}`;
}

// ---------- actions ----------
// Cases are always added to today's session: during the meeting doctors name their
// patients quickly, so there is no date to pick. Moving a case later is done with
// "Change doctor or date" or "Defer".
export async function referToCommittee({ patientId = '', plan = '', physician, sourceVisitId = '' } = {}) {
  const docDefault = physician !== undefined ? physician : (ui.committeeDoctor !== 'ALL' && ui.committeeDoctor ? ui.committeeDoctor : undefined);
  const sessionDate = todayISO();
  const data = await modal({
    title: `${tr('إدراج حالة — جلسة اليوم', 'Add case — today\'s session')} (${fmtDate(sessionDate, 'med')})`,
    size: 'l',
    body: html`
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        ${physicianFieldHTML({ value: docDefault, label: tr('الطبيب المعالج', 'Treating doctor') })}
        <label class="field span-2"><span>${tr('القصة المرضية', 'Brief history')}</span><textarea name="briefHistory" placeholder="${tr('التشخيص، الباثولوجي، الصور، العلاجات السابقة…', 'Diagnosis, pathology, imaging, previous treatment…')}"></textarea></label>
        <label class="field span-2"><span>${tr('السؤال المطروح / الخطة المقترحة', 'Question / proposed plan')}</span><textarea name="question">${plan}</textarea></label>
      </div>
      ${readyToggle(false)}
      <div class="warn-text" data-dup-case hidden></div>`,
    primary: tr('إدراج', 'Add'),
    onMount: (dlg) => {
      mountPatientPicker(dlg);
      mountPhysicianField(dlg);
      const warn = dlg.querySelector('[data-dup-case]');
      const check = () => {
        const pid = dlg.querySelector('[name=patientId]').value;
        const hit = pid && (idx().committeeBy.get(pid) || []).find((c) => c.sessionDate === sessionDate);
        warn.hidden = !hit;
        warn.textContent = hit ? tr('هذا المريض مُدرج مسبقاً في جلسة اليوم.', 'This patient is already on today\'s agenda.') : '';
      };
      dlg.addEventListener('picked', check);
      check();
    },
    validate: (d) => {
      const e = validatePicker(d);
      if (e) return e;
      if (d.physician === '__other' && !d.physicianOther) return tr('اكتب اسم الطبيب.', 'Type the doctor\'s name.');
      if (d.patientId && (idx().committeeBy.get(d.patientId) || []).some((c) => c.sessionDate === sessionDate)) return tr('هذا المريض مُدرج مسبقاً في جلسة اليوم.', 'This patient is already on today\'s agenda.');
      return null;
    },
  });
  if (!data) return null;
  const doc = readPhysician(data);
  const r = resolvePatient(data, { physician: doc });
  if (r.error) { toast(r.error, { type: 'error' }); return null; }
  const c = create('committee', {
    patientId: r.id, sessionDate, physician: doc, briefHistory: data.briefHistory,
    question: data.question, plan: '', decision: '', status: 'listed', ready: data.ready ? '1' : '', notes: '', sourceVisitId, carriedFromId: '', deferredToId: '', decidedAt: '',
  });
  ui.committeeDate = sessionDate;
  toast(tr('أُدرجت الحالة في جلسة اليوم', 'Case added to today\'s session'));
  return c;
}

async function decide(id) {
  const c = get('committee', id);
  const p = patient(c.patientId) || {};
  const due = addDays(todayISO(), Number(settings.get('followupDays')) || 3);
  const suggested = ['NOTIFY', 'REFERRAL', 'APPOINTMENT', 'TESTS', 'PERMIT'];
  const notifyTitle = tr('إبلاغ المريض بقرار اللجنة', 'Tell the patient the committee decision');
  const data = await modal({
    title: `${tr('قرار اللجنة', 'Committee decision')} — ${p.name}`,
    size: 'l',
    body: html`
      <label class="field"><span>${tr('نص القرار', 'Decision')}</span><textarea name="decision" rows="4" autofocus placeholder="${tr('مثال: تحويل لجراحة الثدي، ثم علاج كيماوي مساعد حسب الباثولوجي', 'e.g. Refer to breast surgery, then adjuvant chemotherapy depending on pathology')}">${c.question || ''}</textarea>
        <span class="hint">${tr('بعد الحفظ يُقفل القرار؛ أي تعديل لاحق يُضاف كملحق مؤرّخ.', 'Once saved the decision is locked; later changes are added as dated addenda.')}</span></label>
      <div class="field"><span class="field-label">${tr('ما الذي يجب فعله بعد القرار؟ (تُنشأ متابعات تلقائياً)', 'What needs doing after the decision? (creates follow-ups)')}</span>
        <div class="stack" style="gap:8px">
          ${FU_TYPES.filter((t) => suggested.includes(t.v)).map((t) => html`
            <div class="row" style="gap:8px; align-items:center">
              <label class="check" style="min-width:150px"><input type="checkbox" name="fu" value="${t.v}" data-multi ${t.v === 'NOTIFY' ? 'checked' : ''}> ${t.l}</label>
              <input class="input" style="flex:1; min-width:180px" name="fuTitle_${t.v}" value="${t.v === 'NOTIFY' ? notifyTitle : ''}" placeholder="${tr('التفاصيل', 'Details')}">
              <input class="input" style="width:auto" type="date" name="fuDue_${t.v}" value="${t.v === 'NOTIFY' ? addDays(todayISO(), 1) : due}">
            </div>`)}
        </div>
      </div>`,
    primary: tr('حفظ القرار', 'Save decision'),
    validate: (d) => (!d.decision ? tr('اكتب نص القرار.', 'Write the decision.') : null),
  });
  if (!data) return;
  batch(() => {
    upsert('committee', { id, status: 'presented', decision: data.decision, decidedAt: new Date().toISOString() }, { summary: tr('تسجيل قرار اللجنة', 'Committee decision recorded') });
    for (const t of data.fu || []) {
      create('followups', {
        patientId: c.patientId, sourceType: 'committee', sourceId: id, type: t,
        title: data['fuTitle_' + t] || `${fuLabel(t)} ${tr('حسب قرار اللجنة', 'per committee decision')}`, dueDate: data['fuDue_' + t] || due, status: 'open', outcome: '', closedAt: '',
      });
    }
  });
  toast(tr(`حُفظ القرار${(data.fu || []).length ? ` وأُنشئت ${data.fu.length} متابعات` : ''}`, `Decision saved${(data.fu || []).length ? `, ${data.fu.length} follow-ups created` : ''}`));
}

async function defer(id) {
  const c = get('committee', id);
  const p = patient(c.patientId) || {};
  const data = await modal({
    title: `${tr('تأجيل حالة', 'Defer case')} ${p.name}`,
    body: html`
      <label class="field"><span>${tr('إلى جلسة', 'To session')}</span><input type="date" name="to" value="${nextSession(addDays(c.sessionDate, 1))}" required></label>
      <label class="field"><span>${tr('السبب', 'Reason')}</span><input name="reason" placeholder="${tr('مثال: بانتظار نتيجة الباثولوجي', 'e.g. Waiting for pathology')}" autofocus></label>`,
    primary: tr('تأجيل', 'Defer'),
    validate: (d) => (!d.to ? tr('اختر الجلسة.', 'Choose the session.') : d.to <= c.sessionDate ? tr('اختر جلسة بعد تاريخ هذه الجلسة.', 'Choose a session after this one.') : !d.reason ? tr('اكتب سبب التأجيل.', 'Write the reason.') : null),
  });
  if (!data) return;
  batch(() => {
    const next = create('committee', {
      patientId: c.patientId, sessionDate: data.to, physician: c.physician, briefHistory: c.briefHistory, question: c.question,
      plan: c.plan, decision: '', status: 'listed', ready: c.ready || '', notes: `${tr('مؤجّلة من', 'Deferred from')} ${c.sessionDate}: ${data.reason}`, sourceVisitId: c.sourceVisitId, carriedFromId: c.id, deferredToId: '', decidedAt: '',
    });
    upsert('committee', { id, status: 'deferred', decision: data.reason, deferredToId: next.id }, { summary: `${tr('تأجيل إلى', 'Deferred to')} ${data.to}` });
  });
  toast(`${tr('أُجّلت إلى', 'Deferred to')} ${fmtDate(data.to, 'med')}`);
}

async function addendum(id) {
  const data = await modal({ title: tr('ملحق على القرار', 'Addendum to decision'), body: html`<label class="field"><span>${tr('نص الملحق', 'Addendum')}</span><textarea name="text" autofocus></textarea><span class="hint">${tr('يُحفظ بتاريخه واسمك، ولا يُغيّر نص القرار الأصلي.', 'Saved with the date and your name; the original decision is unchanged.')}</span></label>`, validate: (d) => (!d.text ? tr('اكتب نص الملحق.', 'Write the addendum.') : null) });
  if (!data) return;
  const c = get('committee', id);
  upsert('committee', { id, addenda: [...(c.addenda || []), { at: new Date().toISOString(), by: settings.get('userName') || '', text: data.text }] }, { summary: tr('ملحق على القرار', 'Addendum to decision') });
}

async function editCase(id) {
  const c = get('committee', id);
  const data = await modal({
    title: tr('تعديل الحالة', 'Edit case'),
    body: html`<div class="grid-2">
      ${physicianFieldHTML({ value: c.physician })}
      <label class="field"><span>${tr('تاريخ الجلسة', 'Session date')}</span><input type="date" name="sessionDate" value="${c.sessionDate}"></label>
      <label class="field span-2"><span>${tr('ملاحظات', 'Notes')}</span><textarea name="notes">${c.notes}</textarea></label></div>`,
    onMount: (dlg) => mountPhysicianField(dlg),
  });
  if (data) upsert('committee', { id, physician: readPhysician(data), sessionDate: data.sessionDate || c.sessionDate, notes: data.notes });
}

async function withdraw(id) {
  const data = await modal({ title: tr('سحب الحالة من الجدول', 'Withdraw case'), body: html`<label class="field"><span>${tr('السبب', 'Reason')}</span><input name="reason" autofocus></label>`, primary: tr('سحب', 'Withdraw'), validate: (d) => (!d.reason ? tr('اكتب السبب.', 'Write the reason.') : null) });
  if (data) upsert('committee', { id, status: 'withdrawn', decision: data.reason }, { summary: tr('سحب من الجدول', 'Withdrawn') });
}

async function deleteCase(id) {
  const c = get('committee', id);
  if (!(await confirmBox(`${tr('حذف حالة', 'Delete case of')} ${patient(c.patientId)?.name || ''}${tr(' من الجلسة؟', ' from this session?')}`, { danger: true, confirm: tr('حذف', 'Delete') }))) return;
  remove('committee', id);
  toast(tr('حُذفت الحالة', 'Case deleted'), { undo: () => restore('committee', id) });
}

function print(kind) {
  const cases = idx().lists.committee.filter((c) => c.sessionDate === ui.committeeDate && c.status !== 'withdrawn' && (ui.committeeDoctor === 'ALL' || docKey(c) === ui.committeeDoctor))
    .sort((a, b) => byText(a.physician, b.physician) || String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!cases.length) { toast(tr('لا توجد حالات للطباعة في هذه الجلسة.', 'No cases to print in this session.'), { type: 'error' }); return; }
  const base = (c) => { const p = patient(c.patientId) || {}; return [p.name, p.mrn, c.briefHistory, c.question]; };
  const subtitle = `${fmtDate(ui.committeeDate, 'long')}${ui.committeeDoctor !== 'ALL' ? ` — ${dr(ui.committeeDoctor)}` : ''}`;
  if (kind === 'agenda') {
    const status = (c) => {
      const p = patient(c.patientId) || {};
      if (caseStage(c, p) === 'ready') return tr('جاهز ✓', 'Ready ✓');
      return `${tr('غير جاهز', 'Not ready')}: ${readiness(c, p).missing.map((m) => m.l).join(tr('، ', ', '))}`;
    };
    printTable({
      title: tr('جدول أعمال لجنة الحالات الجديدة', 'New Cases Committee — Agenda'), subtitle,
      columns: [{ label: tr('اسم المريض', 'Patient') }, { label: tr('رقم الملف', 'File no.') }, { label: tr('القصة المرضية', 'Brief history'), width: '28%' }, { label: tr('السؤال / الخطة المقترحة', 'Question / proposed plan'), width: '24%' }, { label: tr('الطبيب', 'Doctor') }, { label: tr('الحالة', 'Status') }, { label: tr('القرار', 'Decision'), width: '14%' }],
      rows: cases.map((c) => [...base(c), dr(c.physician), status(c), '']),
    });
  } else {
    printTable({
      title: tr('محضر قرارات لجنة الحالات الجديدة', 'New Cases Committee — Minutes'), subtitle,
      columns: [{ label: tr('اسم المريض', 'Patient') }, { label: tr('رقم الملف', 'File no.') }, { label: tr('القصة المرضية', 'Brief history'), width: '24%' }, { label: tr('السؤال', 'Question'), width: '18%' }, { label: tr('الطبيب', 'Doctor') }, { label: tr('القرار', 'Decision'), width: '26%' }],
      rows: cases.map((c) => [...base(c), dr(c.physician),
        c.status === 'presented' ? [c.decision, ...(c.addenda || []).map((a) => `${tr('ملحق', 'Addendum')}: ${a.text}`)].join('\n')
          : c.status === 'deferred' ? `${tr('مؤجّلة', 'Deferred')}: ${c.decision}` : tr('لم يُعرض بعد', 'Not presented yet')]),
      footer: tr('توقيع رئيس اللجنة: ____________________          توقيع المنسّق: ____________________', 'Committee chair: ____________________          Coordinator: ____________________'),
    });
  }
}

registerActions({
  'cm-date': (el) => { ui.committeeDate = el.dataset.v; },
  'cm-doctor': (el) => { ui.committeeDoctor = el.dataset.v; },
  'cm-filter': (el) => { ui.committeeFilter = el.dataset.v; },
  'cm-add': () => referToCommittee(),
  'cm-import': () => openImport('committee', ui.committeeDate),
  'cm-print': (el) => print(el.dataset.v),
  'refer-committee': (el) => referToCommittee({ patientId: el.dataset.patient }),
  'case-ready': (el) => {
    const c = get('committee', el.dataset.id);
    const on = c.ready !== '1';
    upsert('committee', { id: c.id, ready: on ? '1' : '' }, { summary: on ? tr('تعليم المريض جاهزاً', 'Marked ready') : tr('إلغاء «جاهز»', 'Unmarked ready') });
  },
  'case-decide': (el) => decide(el.dataset.id),
  'case-defer': (el) => defer(el.dataset.id),
  'case-addendum': (el) => addendum(el.dataset.id),
  'case-edit': (el) => editCase(el.dataset.id),
  'case-withdraw': (el) => withdraw(el.dataset.id),
  'case-reopen': (el) => upsert('committee', { id: el.dataset.id, status: 'listed', decision: '', deferredToId: '' }, { summary: tr('إرجاع الحالة مُدرجة', 'Put back on agenda') }),
  'case-delete': (el) => deleteCase(el.dataset.id),
  'new-followup-case': async (el) => {
    const c = get('committee', el.dataset.id);
    (await import('./followups.js')).newFollowup({ patientId: c.patientId, sourceType: 'committee', sourceId: c.id });
  },
});
registerChanges({
  'case-field': (el) => upsert('committee', { id: el.dataset.id, [el.dataset.field]: el.value.trim() }),
  'cm-date-pick': (el) => { if (el.value) ui.committeeDate = el.value; },
  'cm-q': (el) => { ui.committeeQuery = el.value; },
});
