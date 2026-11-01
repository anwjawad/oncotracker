// Today: what needs doing now, across all sections.
import { html, todayISO, fmtDate } from '../util.js';
import { idx, patient, get } from '../store.js';
import { openTasks, readiness, caseStage, issues } from '../rules.js';
import { icon } from '../ui.js';
import { taskRow } from './followups.js';
import { nextSession } from './committee.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('اليوم', 'Today');

export function render() {
  const today = todayISO();
  const { lists } = idx();

  const due = openTasks().filter((t) => t.dueDate && t.dueDate <= today)
    .map((t) => ({ ...t, p: patient(t.patientId) || {}, src: t.sourceType === 'visit' ? get('visits', t.sourceId) : t.sourceType === 'committee' ? get('committee', t.sourceId) : null }))
    .map((t) => ({ ...t, physician: t.physician || t.src?.physician || t.p.physician || '' }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = due.filter((t) => t.dueDate < today).length;

  const sessionDates = [...new Set(lists.committee.map((c) => c.sessionDate))].filter((d) => d >= today).sort();
  const sDate = sessionDates[0] || nextSession();
  const sCases = lists.committee.filter((c) => c.sessionDate === sDate && c.status !== 'withdrawn');
  const incomplete = sCases.filter((c) => caseStage(c, patient(c.patientId)) === 'listed');
  const presented = sCases.filter((c) => c.status === 'presented').length;

  const visitsToday = lists.visits.filter((v) => v.sessionDate === today);
  const byDoc = new Map();
  for (const v of visitsToday) { const d = v.physician || ''; byDoc.set(d, (byDoc.get(d) || 0) + 1); }

  const iss = issues();
  const high = iss.filter((i) => i.sev === 'high');

  return html`
    <p class="today-date">${fmtDate(today, 'long')}</p>
    <div class="today-grid">
      <section class="panel">
        <div class="panel-head">
          <h2>${tr('متابعات مستحقة', 'Follow-ups due')} ${overdue ? html`<span class="chip red">${overdue} ${tr('متأخرة', 'overdue')}</span>` : ''}</h2>
          <a class="btn btn-sm btn-ghost" href="#/followups">${tr('كل المتابعات', 'All follow-ups')}</a>
        </div>
        <div class="panel-body" style="padding-bottom:6px">
          ${due.length ? due.slice(0, 8).map((t) => taskRow(t, { compact: true })) : html`<div class="empty"><strong>${tr('لا شيء مستحق اليوم', 'Nothing due today')}</strong>${tr('المتابعات ذات تاريخ استحقاق اليوم أو قبله تظهر هنا.', 'Follow-ups due today or earlier appear here.')}</div>`}
          ${due.length > 8 ? html`<a class="btn btn-sm btn-ghost" href="#/followups">${tr(`و${due.length - 8} أخرى…`, `and ${due.length - 8} more…`)}</a>` : ''}
        </div>
      </section>

      <div class="stack" style="gap:18px">
        <section class="panel">
          <div class="panel-head"><h2>${tr('اللجنة القادمة', 'Next committee')}</h2><a class="btn btn-sm btn-ghost" href="#/committee?date=${sDate}">${tr('فتح الجلسة', 'Open session')}</a></div>
          <div class="figure-row">
            <div class="figure"><b>${fmtDate(sDate, 'med')}</b><span>${sDate === today ? tr('اليوم', 'Today') : tr('موعد الجلسة', 'Session date')}</span></div>
            <div class="figure"><b>${sCases.length}</b><span>${tr('حالة مُدرجة', 'cases listed')}</span></div>
            <div class="figure"><b style="color:var(--red)">${incomplete.length}</b><span>${tr('غير جاهزة', 'not ready')}</span></div>
            ${presented ? html`<div class="figure"><b style="color:var(--accent-ink)">${presented}</b><span>${tr('عُرضت', 'presented')}</span></div>` : ''}
          </div>
          ${incomplete.length ? html`<ul class="mini-list">${incomplete.slice(0, 5).map((c) => { const p = patient(c.patientId) || {}; return html`
            <li><div><button class="patient-link" data-action="open-patient" data-id="${c.patientId}">${p.name}</button>
              <div class="small" style="color:var(--red)">${tr('ينقصه', 'Missing')}: ${readiness(c, p).missing.map((m) => m.l).join(tr('، ', ', '))}</div></div>
              <span class="muted small">${dr(c.physician)}</span></li>`; })}</ul>` : ''}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>${tr('عيادات اليوم', 'Today\'s clinics')}</h2><a class="btn btn-sm btn-ghost" href="#/clinic?date=${today}">${tr('فتح القائمة', 'Open list')}</a></div>
          ${visitsToday.length ? html`
            <div class="figure-row">
              <div class="figure"><b>${visitsToday.length}</b><span>${tr('مريض', 'patients')}</span></div>
              <div class="figure"><b>${visitsToday.filter((v) => !String(v.plan || '').trim()).length}</b><span>${tr('بدون خطة', 'no plan')}</span></div>
              <div class="figure"><b>${visitsToday.filter((v) => !patient(v.patientId)?.phone).length}</b><span>${tr('بدون هاتف', 'no phone')}</span></div>
            </div>
            <ul class="mini-list">${[...byDoc].map(([d, n]) => html`<li><span>${dr(d)}</span><span class="muted">${n}</span></li>`)}</ul>`
          : html`<div class="empty">${tr('لم تُستورد قائمة عيادة لهذا اليوم بعد.', 'No clinic list imported for today yet.')}</div>`}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>${tr('تصحيح البيانات', 'Data fixes')}</h2><a class="btn btn-sm btn-ghost" href="#/quality">${tr('فتح', 'Open')}</a></div>
          ${iss.length ? html`
            <div class="figure-row">
              <div class="figure"><b style="color:var(--red)">${high.length}</b><span>${tr('عالية الأهمية', 'high priority')}</span></div>
              <div class="figure"><b>${iss.length}</b><span>${tr('إجمالي الملاحظات', 'total issues')}</span></div>
            </div>
            ${high.length ? html`<ul class="mini-list">${high.slice(0, 4).map((i) => html`<li><span>${icon('alert', 15)} ${i.l}</span><span class="muted small">${i.detail || patient(i.patientId)?.name || ''}</span></li>`)}</ul>` : ''}`
          : html`<div class="empty">${tr('لا توجد ملاحظات على البيانات.', 'No data issues.')}</div>`}
        </section>
      </div>
    </div>`;
}
