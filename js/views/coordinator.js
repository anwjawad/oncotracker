// New cases coordinator: the same cases as the New Cases Committee (a case appears here the moment a
// doctor adds it there), shown read-only as the doctor wrote them, plus the coordinator's own
// "Ready" mark and "Coordinator notes" taken during the meeting.
// Stored on the committee row itself (coordNotes, coordNotesAt, coordNotesBy). The Apps Script
// backend adds unknown columns on first write, so no Code.gs change is needed.
import { html, todayISO, fmtDate, fmtTime, matchesQuery, uniq, byText, nationalIdOf } from '../util.js';
import { idx, patient, get, upsert } from '../store.js';
import { CASE_STATUS, readiness, caseStage, fuLabel } from '../rules.js';
import { icon, toast, menu } from '../ui.js';
import { settings } from '../settings.js';
import { printTable } from '../print.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';
import { sessions, onRoute as committeeRoute } from './committee.js';

export const title = () => tr('منسّق الحالات الجديدة', 'New cases coordinator');
export const onRoute = committeeRoute;

const docKey = (c) => c.physician || '';
const hasNotes = (c) => !!String(c.coordNotes || '').trim();

const block = (label, text) => html`
  <div class="coord-read"><div class="coord-read-label">${label}</div><div class="coord-read-text" dir="auto">${text || html`<span class="muted">—</span>`}</div></div>`;

function caseCard(c) {
  const p = patient(c.patientId) || {};
  const stage = caseStage(c, p);
  const open = !['presented', 'deferred', 'withdrawn'].includes(c.status);
  const locked = c.status === 'presented';
  const st = CASE_STATUS[stage] || CASE_STATUS.listed;
  const r = readiness(c, p);
  const fus = (idx().followupsBy.get(c.patientId) || []).filter((f) => f.sourceType === 'committee' && f.sourceId === c.id);
  const nid = nationalIdOf(p);
  return html`
  <article class="case coord-case" data-stage="${stage}">
    <div class="case-no" aria-hidden="true"></div>
    <div>
      <div class="case-top">
        <div>
          <button class="patient-link case-name" data-action="open-patient" data-id="${c.patientId}">${p.name || tr('مريض غير معروف', 'Unknown patient')}</button>
          <span class="mrn">${p.mrn || tr('بدون رقم ملف', 'no file number')}</span>
          ${nid ? html`<span class="mrn">${tr('هوية', 'ID')}: ${nid}</span>` : ''}
          <div class="small muted">${dr(c.physician)} · ${tr('أُضيفت', 'added')} ${fmtTime(c.createdAt)}</div>
        </div>
        <div class="case-actions">
          ${open ? html`<button class="ready-btn ${c.ready === '1' ? 'on' : ''}" data-action="case-ready" data-id="${c.id}" aria-pressed="${String(c.ready === '1')}">${icon('check', 15)} ${tr('جاهز', 'Ready')}</button>`
            : html`<span class="chip ${st.chip}">${st.l}</span>`}
          ${open ? html`<button class="btn btn-sm btn-primary" data-action="case-decide" data-id="${c.id}">${tr('تسجيل القرار', 'Record decision')}</button>` : ''}
          ${locked ? html`<button class="btn btn-sm" data-action="case-addendum" data-id="${c.id}">${icon('plus', 16)} ${tr('ملحق', 'Addendum')}</button>` : ''}
          ${menu(html`
            <button data-action="open-patient" data-id="${c.patientId}">${icon('user', 16)} ${tr('ملف المريض', 'Patient record')}</button>
            <button data-action="new-followup-case" data-id="${c.id}">${icon('plus', 16)} ${tr('متابعة لهذه الحالة', 'Follow-up for this case')}</button>
            ${open ? html`<button data-action="case-defer" data-id="${c.id}">${icon('clock', 16)} ${tr('تأجيل', 'Defer')}</button>` : ''}
            <button data-action="case-edit" data-id="${c.id}">${icon('edit', 16)} ${tr('تعديل الطبيب والتاريخ', 'Change doctor or date')}</button>`)}
        </div>
      </div>

      <div class="coord-doctor">
        <div class="coord-doctor-head">${icon('user', 14)} ${tr('ما كتبه الطبيب', 'Written by the doctor')}</div>
        ${block(tr('القصة المرضية', 'Brief history'), c.briefHistory)}
        ${block(tr('السؤال المطروح / الخطة المقترحة', 'Question / proposed plan'), c.question)}
        ${c.notes ? block(tr('ملاحظات', 'Notes'), c.notes) : ''}
      </div>
      ${open && c.ready !== '1' ? html`<div class="readiness">${r.items.map((i) => html`<span class="${i.ok ? 'ok' : 'miss'}">${i.ok ? '✓' : '✗'} ${i.l}</span>`)}</div>` : ''}

      <label class="field coord-notes">
        <span>${icon('edit', 14)} Coordinator notes — ${tr('ملاحظات المنسّق', 'notes from the meeting')}
          ${c.coordNotesAt ? html`<small class="muted">· ${tr('آخر حفظ', 'saved')} ${fmtTime(c.coordNotesAt)}${c.coordNotesBy ? ` — ${c.coordNotesBy}` : ''}</small>` : ''}</span>
        <textarea class="cell-input" dir="auto" rows="3" data-change="coord-notes" data-id="${c.id}" data-key="coord-${c.id}" placeholder="${tr('ما قيل عن المريض في الاجتماع، المطلوب من المنسّق…', 'What was said about the patient in the meeting, what the coordinator needs to do…')}">${c.coordNotes || ''}</textarea>
        <span class="hint">${tr('تُحفظ تلقائياً عند الخروج من المربع.', 'Saved automatically when you leave the box.')}</span>
      </label>

      ${locked ? html`
        <div class="decision">
          <h4>${tr('قرار اللجنة', 'Committee decision')} ${c.decidedAt ? html`<span class="muted">— ${fmtTime(c.decidedAt)}</span>` : ''}</h4>
          <div class="text">${c.decision || tr('لم يُسجّل نص القرار.', 'No decision text recorded.')}</div>
          ${(c.addenda || []).map((a) => html`<div class="addendum"><b>${tr('ملحق', 'Addendum')} ${fmtTime(a.at)}${a.by ? ` — ${a.by}` : ''}:</b> ${a.text}</div>`)}
          ${fus.length ? html`<div class="row" style="margin-top:8px">${fus.map((f) => html`<span class="chip ${f.status === 'done' ? 'green' : 'outline'}">${f.status === 'done' ? '✓' : '○'} ${fuLabel(f.type)}: ${f.title}</span>`)}</div>` : ''}
        </div>` : ''}
      ${c.status === 'deferred' ? html`<div class="decision" style="background:var(--amber-soft); border-color:var(--amber)"><h4 style="color:var(--amber)">${tr('مؤجّلة', 'Deferred')}</h4><div class="text">${c.decision}</div></div>` : ''}
    </div>
  </article>`;
}

function sessionCases() {
  return idx().lists.committee.filter((c) => c.sessionDate === ui.committeeDate && c.status !== 'withdrawn');
}

export function render() {
  const date = ui.committeeDate;
  const today = todayISO();
  const { list: dates, counts } = sessions();
  const session = sessionCases();
  const doctors = uniq(session.map(docKey)).sort(byText);
  if (ui.committeeDoctor !== 'ALL' && !doctors.includes(ui.committeeDoctor)) ui.committeeDoctor = 'ALL';
  let cases = ui.committeeDoctor === 'ALL' ? session : session.filter((c) => docKey(c) === ui.committeeDoctor);
  const total = cases.length;
  const stageOf = (c) => caseStage(c, patient(c.patientId));
  const n = {
    listed: cases.filter((c) => stageOf(c) === 'listed').length,
    ready: cases.filter((c) => stageOf(c) === 'ready').length,
    presented: cases.filter((c) => stageOf(c) === 'presented').length,
    nonotes: cases.filter((c) => !hasNotes(c)).length,
  };
  const f = ui.coordFilter;
  if (f === 'nonotes') cases = cases.filter((c) => !hasNotes(c));
  else if (f !== 'all') cases = cases.filter((c) => stageOf(c) === f);
  if (ui.coordQuery) cases = cases.filter((c) => { const p = patient(c.patientId) || {}; return matchesQuery(ui.coordQuery, p.name, p.mrn, nationalIdOf(p), c.physician, c.briefHistory, c.question, c.coordNotes); });

  const groups = new Map();
  for (const c of cases.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const k = docKey(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }

  return html`
    <div class="session-strip" role="tablist" aria-label="${tr('الجلسات', 'Sessions')}">
      ${dates.map((d) => html`
        <button class="session-chip ${d === date ? 'active' : ''} ${d < today ? 'past' : ''}" data-action="cm-date" data-v="${d}" role="tab" aria-selected="${String(d === date)}">
          <span class="d">${fmtDate(d, 'med')}</span>
          <span class="s">${counts.get(d) ? `${counts.get(d)} ${tr('حالة', 'cases')}` : tr('لا حالات', 'No cases')}${d === today ? tr(' · اليوم', ' · today') : ''}</span>
        </button>`)}
      <label class="session-chip" style="cursor:default"><span class="s">${tr('جلسة أخرى', 'Other session')}</span><input type="date" class="input" style="min-height:30px; padding:2px 6px" value="${date}" data-change="cm-date-pick"></label>
    </div>

    <div class="session-head">
      <div>
        <h2>${tr('جلسة', 'Session')} ${fmtDate(date, 'long')}</h2>
        <div class="row small muted" style="margin-top:4px">
          <span>${total} ${tr('حالة', 'cases')}</span><span>·</span>
          <span style="color:var(--blue)">${n.ready} ${tr('جاهزة', 'ready')}</span><span>·</span>
          <span style="color:var(--accent-ink)">${n.presented} ${tr('عُرضت', 'presented')}</span><span>·</span>
          <span>${total - n.nonotes} ${tr('عليها ملاحظات منسّق', 'with coordinator notes')}</span>
        </div>
      </div>
      <div class="row">
        <button class="btn" data-action="coord-print">${icon('print')} ${tr('طباعة مع ملاحظات المنسّق', 'Print with coordinator notes')}</button>
      </div>
    </div>

    ${doctors.length ? html`<div class="tabs">
      <button class="tab ${ui.committeeDoctor === 'ALL' ? 'active' : ''}" data-action="cm-doctor" data-v="ALL">${tr('كل الأطباء', 'All doctors')} <span class="n">${session.length}</span></button>
      ${doctors.map((d) => html`<button class="tab ${ui.committeeDoctor === d ? 'active' : ''}" data-action="cm-doctor" data-v="${d}">${dr(d)} <span class="n">${session.filter((c) => docKey(c) === d).length}</span></button>`)}
    </div>` : ''}

    <div class="toolbar">
      <div class="tabs" style="margin:0">
        ${[['all', tr('الكل', 'All'), total], ['listed', tr('غير جاهزة', 'Not ready'), n.listed], ['ready', tr('جاهزة', 'Ready'), n.ready], ['presented', tr('عُرضت', 'Presented'), n.presented], ['nonotes', tr('بدون ملاحظات منسّق', 'No coordinator notes'), n.nonotes]].map(([k, l, x]) => html`
          <button class="tab ${f === k ? 'active' : ''}" data-action="coord-filter" data-v="${k}">${l} <span class="n">${x}</span></button>`)}
      </div>
      <label class="search-box"><input class="input" type="search" placeholder="${tr('بحث في هذه الجلسة', 'Search this session')}" value="${ui.coordQuery}" data-input="coord-q" data-key="coord-q">${icon('search', 16)}</label>
    </div>

    ${cases.length ? html`<div class="agenda">${[...groups].map(([doc, rows]) => html`
        ${ui.committeeDoctor === 'ALL' ? html`<div class="agenda-group">${dr(doc)} — ${rows.length}</div>` : ''}${rows.map(caseCard)}`)}</div>`
      : html`<div class="panel empty"><strong>${total ? tr('لا حالات تطابق الفلتر', 'No cases match this filter') : tr('لا توجد حالات في هذه الجلسة بعد', 'No cases in this session yet')}</strong>
          ${total ? '' : tr('الحالات التي يضيفها الأطباء في «لجنة الحالات الجديدة» تظهر هنا مباشرة.', 'Cases the doctors add in "New cases committee" appear here right away.')}</div>`}`;
}

function print() {
  const cases = sessionCases().filter((c) => ui.committeeDoctor === 'ALL' || docKey(c) === ui.committeeDoctor)
    .sort((a, b) => byText(a.physician, b.physician) || String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!cases.length) { toast(tr('لا توجد حالات للطباعة في هذه الجلسة.', 'No cases to print in this session.'), { type: 'error' }); return; }
  const status = (c) => {
    const p = patient(c.patientId) || {};
    const s = caseStage(c, p);
    if (s === 'presented') return [c.decision, ...(c.addenda || []).map((a) => `${tr('ملحق', 'Addendum')}: ${a.text}`)].filter(Boolean).join('\n') || tr('عُرضت', 'Presented');
    if (s === 'deferred') return `${tr('مؤجّلة', 'Deferred')}: ${c.decision}`;
    return s === 'ready' ? tr('جاهز ✓', 'Ready ✓') : tr('غير جاهز', 'Not ready');
  };
  printTable({
    title: 'New Cases Coordinator',
    subtitle: `${fmtDate(ui.committeeDate, 'long')}${ui.committeeDoctor !== 'ALL' ? ` — ${dr(ui.committeeDoctor)}` : ''}`,
    columns: [{ label: tr('اسم المريض', 'Patient') }, { label: tr('رقم الملف', 'File no.') }, { label: tr('القصة المرضية', 'Brief history'), width: '22%' }, { label: tr('السؤال / الخطة المقترحة', 'Question / proposed plan'), width: '18%' }, { label: tr('الطبيب', 'Doctor') }, { label: tr('الحالة / القرار', 'Status / decision'), width: '13%' }, { label: 'Coordinator notes', width: '24%' }],
    rows: cases.map((c) => { const p = patient(c.patientId) || {}; return [p.name, p.mrn, c.briefHistory, c.question, dr(c.physician), status(c), c.coordNotes || '']; }),
    footer: tr('توقيع المنسّق: ____________________', 'Coordinator: ____________________'),
  });
}

registerActions({
  'coord-filter': (el) => { ui.coordFilter = el.dataset.v; },
  'coord-print': () => print(),
});
registerChanges({
  'coord-notes': (el) => {
    const c = get('committee', el.dataset.id);
    const v = el.value.trim();
    if (!c || v === String(c.coordNotes || '').trim()) return;
    upsert('committee', { id: c.id, coordNotes: v, coordNotesAt: new Date().toISOString(), coordNotesBy: settings.get('userName') || '' }, { summary: tr('ملاحظات المنسّق', 'Coordinator notes') });
  },
  'coord-q': (el) => { ui.coordQuery = el.value; },
});
