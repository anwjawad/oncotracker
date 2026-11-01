// New-cases committee: sessions by date, an agenda that moves each case through
// listed → ready → presented (decision recorded, then locked with addenda) or
// deferred to a later session; decisions spawn follow-ups directly.
import { html, todayISO, addDays, fmtDate, fmtTime, nextWeekday, matchesQuery, cleanPhysician, uniq, byText, isISODate, plural } from '../util.js';

const casesText = (n) => plural(n, 'حالة واحدة', 'حالتان', 'حالات', 'حالة');
import { idx, patient, get, create, upsert, remove, restore, batch } from '../store.js';
import { CASE_STATUS, readiness, caseStage, FU_TYPES, fuLabel } from '../rules.js';
import { icon, modal, toast, confirmBox, menu, physicianOptions, patientPickerHTML, mountPatientPicker, resolvePatient, validatePicker } from '../ui.js';
import { settings } from '../settings.js';
import { printTable } from '../print.js';
import { openImport } from '../importer.js';
import { registerActions, registerChanges, ui } from '../registry.js';

export const title = 'لجنة الحالات الجديدة';

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

function caseCard(c) {
  const p = patient(c.patientId) || {};
  const stage = caseStage(c, p);
  const r = readiness(c, p);
  const locked = c.status === 'presented';
  const st = stage === 'ready' ? { l: 'جاهز للعرض', chip: 'blue' } : CASE_STATUS[stage] || CASE_STATUS.listed;
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
          <button class="patient-link case-name" data-action="open-patient" data-id="${c.patientId}">${p.name || 'مريض غير معروف'}</button>
          <span class="mrn">${p.mrn || 'بدون رقم ملف'}</span>
          <div class="small muted">د. ${c.physician || '—'}${carried ? ` · مؤجّلة من جلسة ${fmtDate(carried.sessionDate)}` : ''}${c.sourceVisitId ? ' · محالة من العيادة' : ''}</div>
        </div>
        <div class="case-actions">
          <span class="chip ${st.chip}">${st.l}</span>
          ${c.status !== 'presented' && c.status !== 'withdrawn' && c.status !== 'deferred' ? html`
            <button class="btn btn-sm btn-primary" data-action="case-decide" data-id="${c.id}">${icon('check', 16)} تسجيل القرار</button>
            <button class="btn btn-sm" data-action="case-defer" data-id="${c.id}">${icon('clock', 16)} تأجيل</button>` : ''}
          ${locked ? html`<button class="btn btn-sm" data-action="case-addendum" data-id="${c.id}">${icon('plus', 16)} ملحق</button>` : ''}
          ${menu(html`
            <button data-action="open-patient" data-id="${c.patientId}">${icon('user', 16)} ملف المريض</button>
            <button data-action="case-edit" data-id="${c.id}">${icon('edit', 16)} تعديل الطبيب والتاريخ</button>
            <button data-action="new-followup-case" data-id="${c.id}">${icon('plus', 16)} متابعة لهذه الحالة</button>
            ${c.status === 'withdrawn' || c.status === 'deferred' ? html`<button data-action="case-reopen" data-id="${c.id}">${icon('undo', 16)} إرجاعها مُدرجة</button>` : ''}
            ${c.status !== 'withdrawn' && c.status !== 'presented' ? html`<button data-action="case-withdraw" data-id="${c.id}">${icon('x', 16)} سحب من الجدول</button>` : ''}
            <hr><button class="danger" data-action="case-delete" data-id="${c.id}">${icon('trash', 16)} حذف</button>`)}
        </div>
      </div>

      <div class="case-fields">
        ${ta('briefHistory', 'القصة المرضية', 'التشخيص، الباثولوجي، الصور، العلاجات السابقة…')}
        ${ta('question', 'السؤال المطروح على اللجنة / الخطة المقترحة', 'مثال: هل يُحوّل للجراحة أم علاج كيماوي أولاً؟')}
      </div>
      ${!locked && c.status !== 'withdrawn' ? html`<div class="readiness">${r.items.map((i) => html`<span class="${i.ok ? 'ok' : 'miss'}">${i.ok ? '✓' : '✗'} ${i.l}</span>`)}</div>` : ''}
      ${c.notes ? html`<div class="small muted" style="margin-top:6px; white-space:pre-wrap">${c.notes}</div>` : ''}

      ${locked ? html`
        <div class="decision">
          <h4>قرار اللجنة ${c.decidedAt ? html`<span class="muted">— ${fmtTime(c.decidedAt)}</span>` : ''}</h4>
          <div class="text">${c.decision || 'لم يُسجّل نص القرار.'}</div>
          ${(c.addenda || []).map((a) => html`<div class="addendum"><b>ملحق ${fmtTime(a.at)}${a.by ? ` — ${a.by}` : ''}:</b> ${a.text}</div>`)}
          ${fus.length ? html`<div class="row" style="margin-top:8px">${fus.map((f) => html`<span class="chip ${f.status === 'done' ? 'green' : 'outline'}">${f.status === 'done' ? '✓' : '○'} ${fuLabel(f.type)}: ${f.title}</span>`)}</div>` : ''}
        </div>` : ''}
      ${c.status === 'deferred' && deferredTo ? html`<div class="decision" style="background:var(--amber-soft); border-color:var(--amber)"><h4 style="color:var(--amber)">أُجّلت إلى جلسة ${fmtDate(deferredTo.sessionDate, 'med')}</h4><div class="text">${c.decision}</div></div>` : ''}
    </div>
  </article>`;
}

export function render() {
  const date = ui.committeeDate;
  const { list: dates, counts } = sessions();
  const today = todayISO();
  let cases = idx().lists.committee.filter((c) => c.sessionDate === date);
  const stages = cases.map((c) => caseStage(c, patient(c.patientId)));
  const n = (s) => stages.filter((x) => x === s).length;
  const total = cases.filter((c) => c.status !== 'withdrawn').length;

  if (ui.committeeFilter !== 'all') cases = cases.filter((c) => caseStage(c, patient(c.patientId)) === ui.committeeFilter);
  if (ui.committeeQuery) cases = cases.filter((c) => { const p = patient(c.patientId) || {}; return matchesQuery(ui.committeeQuery, p.name, p.mrn, c.physician, c.briefHistory); });

  const groups = new Map();
  for (const c of cases.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const k = c.physician || 'بدون طبيب';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const pct = (x) => (total ? (x / total) * 100 : 0);

  return html`
    <div class="session-strip" role="tablist" aria-label="الجلسات">
      ${dates.map((d) => html`
        <button class="session-chip ${d === date ? 'active' : ''} ${d < today ? 'past' : ''}" data-action="cm-date" data-v="${d}" role="tab" aria-selected="${d === date}">
          <span class="d">${fmtDate(d, 'med')}</span>
          <span class="s">${counts.get(d) ? casesText(counts.get(d)) : 'لا حالات'}${d === today ? ' · اليوم' : ''}</span>
        </button>`)}
      <label class="session-chip" style="cursor:default"><span class="s">جلسة أخرى</span><input type="date" class="input" style="min-height:30px; padding:2px 6px" value="${date}" data-change="cm-date-pick"></label>
    </div>

    <div class="session-head">
      <div>
        <h2>جلسة ${fmtDate(date, 'long')}</h2>
        <div class="row small muted" style="margin-top:4px">
          <span>${total ? casesText(total) : 'لا حالات'}</span><span>·</span>
          <span style="color:var(--blue)">${n('ready')} جاهزة</span><span>·</span>
          <span style="color:var(--red)">${n('listed')} ناقصة البيانات</span><span>·</span>
          <span style="color:var(--accent-ink)">${n('presented')} عُرضت</span>
          ${n('deferred') ? html`<span>·</span><span style="color:var(--amber)">${n('deferred')} مؤجّلة</span>` : ''}
        </div>
        <div class="progress" title="تقدّم الجلسة">
          <span style="width:${pct(n('presented'))}%; background:var(--accent)"></span>
          <span style="width:${pct(n('deferred'))}%; background:var(--amber)"></span>
          <span style="width:${pct(n('ready'))}%; background:var(--blue)"></span>
        </div>
      </div>
      <div class="row">
        <button class="btn" data-action="cm-import">${icon('upload')} استيراد Excel</button>
        <button class="btn" data-action="cm-print" data-v="agenda">${icon('print')} جدول الأعمال</button>
        <button class="btn" data-action="cm-print" data-v="minutes">${icon('print')} محضر القرارات</button>
        <button class="btn btn-primary" data-action="cm-add">${icon('plus')} إدراج حالة</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="tabs" style="margin:0">
        ${[['all', 'الكل'], ['listed', 'ناقصة'], ['ready', 'جاهزة'], ['presented', 'عُرضت'], ['deferred', 'مؤجّلة']].map(([k, l]) => html`
          <button class="tab ${ui.committeeFilter === k ? 'active' : ''}" data-action="cm-filter" data-v="${k}">${l}${k !== 'all' ? html` <span class="n">${n(k)}</span>` : ''}</button>`)}
      </div>
      <label class="search-box"><input class="input" type="search" placeholder="بحث في هذه الجلسة" value="${ui.committeeQuery}" data-input="cm-q" data-key="cm-q">${icon('search', 16)}</label>
    </div>

    ${cases.length ? html`<div class="agenda">${[...groups].map(([doc, rows]) => html`
        <div class="agenda-group">د. ${doc} — ${rows.length}</div>${rows.map(caseCard)}`)}</div>`
      : html`<div class="panel empty"><strong>${total ? 'لا حالات تطابق الفلتر' : 'لا توجد حالات في هذه الجلسة بعد'}</strong>
          ${total ? '' : html`أدرج حالة من زر «إدراج حالة»، أو أحِلها من قائمة حجوزات العيادة، أو استورد ملف Excel.`}</div>`}`;
}

// ---------- actions ----------
export async function referToCommittee({ patientId = '', plan = '', physician = '', sourceVisitId = '', date = '' } = {}) {
  const data = await modal({
    title: 'إدراج حالة في اللجنة',
    size: 'l',
    body: html`
      ${physicianOptions()}
      ${patientPickerHTML({ patientId })}
      <div class="grid-2">
        <label class="field"><span>تاريخ الجلسة</span><input type="date" name="sessionDate" value="${date || ui.committeeDate || nextSession()}" required></label>
        <label class="field"><span>الطبيب المعالج</span><input name="physician" list="physician-list" value="${physician || patient(patientId)?.physician || ''}"></label>
        <label class="field span-2"><span>القصة المرضية</span><textarea name="briefHistory" placeholder="التشخيص، الباثولوجي، الصور، العلاجات السابقة…"></textarea></label>
        <label class="field span-2"><span>السؤال المطروح / الخطة المقترحة</span><textarea name="question">${plan}</textarea></label>
      </div>
      <div class="warn-text" data-dup-case hidden></div>`,
    primary: 'إدراج',
    onMount: (dlg) => {
      mountPatientPicker(dlg);
      const warn = dlg.querySelector('[data-dup-case]');
      const check = () => {
        const pid = dlg.querySelector('[name=patientId]').value;
        const d = dlg.querySelector('[name=sessionDate]').value;
        const hit = pid && (idx().committeeBy.get(pid) || []).find((c) => c.sessionDate === d);
        warn.hidden = !hit;
        warn.textContent = hit ? 'هذا المريض مُدرج مسبقاً في نفس الجلسة.' : '';
        if (pid && !dlg.querySelector('[name=physician]').value) dlg.querySelector('[name=physician]').value = patient(pid)?.physician || '';
      };
      dlg.addEventListener('picked', check);
      dlg.querySelector('[name=sessionDate]').addEventListener('change', check);
      check();
    },
    validate: (d) => {
      const e = validatePicker(d);
      if (e) return e;
      if (!d.sessionDate) return 'اختر تاريخ الجلسة.';
      if (d.patientId && (idx().committeeBy.get(d.patientId) || []).some((c) => c.sessionDate === d.sessionDate)) return 'هذا المريض مُدرج مسبقاً في نفس الجلسة.';
      return null;
    },
  });
  if (!data) return null;
  const r = resolvePatient(data, { physician: cleanPhysician(data.physician) });
  if (r.error) { toast(r.error, { type: 'error' }); return null; }
  const c = create('committee', {
    patientId: r.id, sessionDate: data.sessionDate, physician: cleanPhysician(data.physician), briefHistory: data.briefHistory,
    question: data.question, plan: '', decision: '', status: 'listed', notes: '', sourceVisitId, carriedFromId: '', deferredToId: '', decidedAt: '',
  });
  toast(`أُدرجت الحالة في جلسة ${fmtDate(data.sessionDate, 'med')}`);
  return c;
}

async function decide(id) {
  const c = get('committee', id);
  const p = patient(c.patientId) || {};
  const due = addDays(todayISO(), Number(settings.get('followupDays')) || 3);
  const suggested = ['NOTIFY', 'REFERRAL', 'APPOINTMENT', 'TESTS', 'PERMIT'];
  const data = await modal({
    title: `قرار اللجنة — ${p.name}`,
    size: 'l',
    body: html`
      <label class="field"><span>نص القرار</span><textarea name="decision" rows="4" autofocus placeholder="مثال: تحويل لجراحة الثدي، ثم علاج كيماوي مساعد حسب الباثولوجي">${c.question || ''}</textarea>
        <span class="hint">بعد الحفظ يُقفل القرار؛ أي تعديل لاحق يُضاف كملحق مؤرّخ.</span></label>
      <div class="field"><span class="field-label">ما الذي يجب فعله بعد القرار؟ (تُنشأ متابعات تلقائياً)</span>
        <div class="stack" style="gap:8px">
          ${FU_TYPES.filter((t) => suggested.includes(t.v)).map((t) => html`
            <div class="row" style="gap:8px; align-items:center">
              <label class="check" style="min-width:150px"><input type="checkbox" name="fu" value="${t.v}" data-multi ${t.v === 'NOTIFY' ? 'checked' : ''}> ${t.l}</label>
              <input class="input" style="flex:1; min-width:180px" name="fuTitle_${t.v}" value="${t.v === 'NOTIFY' ? 'إبلاغ المريض بقرار اللجنة' : ''}" placeholder="التفاصيل">
              <input class="input" style="width:auto" type="date" name="fuDue_${t.v}" value="${t.v === 'NOTIFY' ? addDays(todayISO(), 1) : due}">
            </div>`)}
        </div>
      </div>`,
    primary: 'حفظ القرار',
    validate: (d) => (!d.decision ? 'اكتب نص القرار.' : null),
  });
  if (!data) return;
  batch(() => {
    upsert('committee', { id, status: 'presented', decision: data.decision, decidedAt: new Date().toISOString() }, { summary: 'تسجيل قرار اللجنة' });
    for (const t of data.fu || []) {
      create('followups', {
        patientId: c.patientId, sourceType: 'committee', sourceId: id, type: t,
        title: data['fuTitle_' + t] || `${fuLabel(t)} حسب قرار اللجنة`, dueDate: data['fuDue_' + t] || due, status: 'open', outcome: '', closedAt: '',
      });
    }
  });
  toast(`حُفظ القرار${(data.fu || []).length ? ` وأُنشئت ${data.fu.length} متابعات` : ''}`);
}

async function defer(id) {
  const c = get('committee', id);
  const p = patient(c.patientId) || {};
  const data = await modal({
    title: `تأجيل حالة ${p.name}`,
    body: html`
      <label class="field"><span>إلى جلسة</span><input type="date" name="to" value="${nextSession(addDays(c.sessionDate, 1))}" required></label>
      <label class="field"><span>السبب</span><input name="reason" placeholder="مثال: بانتظار نتيجة الباثولوجي" autofocus></label>`,
    primary: 'تأجيل',
    validate: (d) => (!d.to ? 'اختر الجلسة.' : d.to <= c.sessionDate ? 'اختر جلسة بعد تاريخ هذه الجلسة.' : !d.reason ? 'اكتب سبب التأجيل.' : null),
  });
  if (!data) return;
  batch(() => {
    const next = create('committee', {
      patientId: c.patientId, sessionDate: data.to, physician: c.physician, briefHistory: c.briefHistory, question: c.question,
      plan: c.plan, decision: '', status: 'listed', notes: `مؤجّلة من ${c.sessionDate}: ${data.reason}`, sourceVisitId: c.sourceVisitId, carriedFromId: c.id, deferredToId: '', decidedAt: '',
    });
    upsert('committee', { id, status: 'deferred', decision: data.reason, deferredToId: next.id }, { summary: `تأجيل إلى ${data.to}` });
  });
  toast(`أُجّلت إلى ${fmtDate(data.to, 'med')}`);
}

async function addendum(id) {
  const data = await modal({ title: 'ملحق على القرار', body: html`<label class="field"><span>نص الملحق</span><textarea name="text" autofocus></textarea><span class="hint">يُحفظ بتاريخه واسمك، ولا يُغيّر نص القرار الأصلي.</span></label>`, validate: (d) => (!d.text ? 'اكتب نص الملحق.' : null) });
  if (!data) return;
  const c = get('committee', id);
  upsert('committee', { id, addenda: [...(c.addenda || []), { at: new Date().toISOString(), by: settings.get('userName') || '', text: data.text }] }, { summary: 'ملحق على القرار' });
}

async function editCase(id) {
  const c = get('committee', id);
  const data = await modal({
    title: 'تعديل الحالة',
    body: html`${physicianOptions()}<div class="grid-2">
      <label class="field"><span>الطبيب</span><input name="physician" list="physician-list" value="${c.physician}"></label>
      <label class="field"><span>تاريخ الجلسة</span><input type="date" name="sessionDate" value="${c.sessionDate}"></label>
      <label class="field span-2"><span>ملاحظات</span><textarea name="notes">${c.notes}</textarea></label></div>`,
  });
  if (data) upsert('committee', { id, physician: cleanPhysician(data.physician), sessionDate: data.sessionDate || c.sessionDate, notes: data.notes });
}

async function withdraw(id) {
  const data = await modal({ title: 'سحب الحالة من الجدول', body: html`<label class="field"><span>السبب</span><input name="reason" autofocus></label>`, primary: 'سحب', validate: (d) => (!d.reason ? 'اكتب السبب.' : null) });
  if (data) upsert('committee', { id, status: 'withdrawn', decision: data.reason }, { summary: 'سحب من الجدول' });
}

async function deleteCase(id) {
  const c = get('committee', id);
  if (!(await confirmBox(`حذف حالة ${patient(c.patientId)?.name || ''} من الجلسة؟`, { danger: true, confirm: 'حذف' }))) return;
  remove('committee', id);
  toast('حُذفت الحالة', { undo: () => restore('committee', id) });
}

function print(kind) {
  const cases = idx().lists.committee.filter((c) => c.sessionDate === ui.committeeDate && c.status !== 'withdrawn')
    .sort((a, b) => byText(a.physician, b.physician) || String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!cases.length) { toast('لا توجد حالات للطباعة في هذه الجلسة.', { type: 'error' }); return; }
  const base = (c) => { const p = patient(c.patientId) || {}; return [p.name, p.mrn, c.briefHistory, c.question]; };
  if (kind === 'agenda') {
    printTable({
      title: 'جدول أعمال لجنة الحالات الجديدة', subtitle: fmtDate(ui.committeeDate, 'long'),
      columns: [{ label: 'اسم المريض' }, { label: 'رقم الملف' }, { label: 'القصة المرضية', width: '30%' }, { label: 'السؤال / الخطة المقترحة', width: '26%' }, { label: 'الطبيب' }, { label: 'القرار', width: '16%' }],
      rows: cases.map((c) => [...base(c), c.physician, '']),
    });
  } else {
    printTable({
      title: 'محضر قرارات لجنة الحالات الجديدة', subtitle: fmtDate(ui.committeeDate, 'long'),
      columns: [{ label: 'اسم المريض' }, { label: 'رقم الملف' }, { label: 'القصة المرضية', width: '24%' }, { label: 'السؤال', width: '18%' }, { label: 'الطبيب' }, { label: 'القرار', width: '26%' }],
      rows: cases.map((c) => [...base(c), c.physician,
        c.status === 'presented' ? [c.decision, ...(c.addenda || []).map((a) => `ملحق: ${a.text}`)].join('\n')
          : c.status === 'deferred' ? `مؤجّلة: ${c.decision}` : 'لم يُعرض بعد']),
      footer: 'توقيع رئيس اللجنة: ____________________          توقيع المنسّق: ____________________',
    });
  }
}

registerActions({
  'cm-date': (el) => { ui.committeeDate = el.dataset.v; },
  'cm-filter': (el) => { ui.committeeFilter = el.dataset.v; },
  'cm-add': () => referToCommittee({ date: ui.committeeDate }),
  'cm-import': () => openImport('committee', ui.committeeDate),
  'cm-print': (el) => print(el.dataset.v),
  'refer-committee': (el) => referToCommittee({ patientId: el.dataset.patient }),
  'case-decide': (el) => decide(el.dataset.id),
  'case-defer': (el) => defer(el.dataset.id),
  'case-addendum': (el) => addendum(el.dataset.id),
  'case-edit': (el) => editCase(el.dataset.id),
  'case-withdraw': (el) => withdraw(el.dataset.id),
  'case-reopen': (el) => upsert('committee', { id: el.dataset.id, status: 'listed', decision: '', deferredToId: '' }, { summary: 'إرجاع الحالة مُدرجة' }),
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
