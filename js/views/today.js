// Today: what needs doing now, across all sections.
import { html, todayISO, fmtDate } from '../util.js';
import { idx, patient } from '../store.js';
import { openTasks, readiness, caseStage, issues } from '../rules.js';
import { icon } from '../ui.js';
import { taskRow } from './followups.js';
import { nextSession } from './committee.js';
import { get } from '../store.js';

export const title = 'اليوم';

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
  for (const v of visitsToday) { const d = v.physician || 'بدون طبيب'; byDoc.set(d, (byDoc.get(d) || 0) + 1); }

  const iss = issues();
  const high = iss.filter((i) => i.sev === 'high');

  return html`
    <p class="today-date">${fmtDate(today, 'long')}</p>
    <div class="today-grid">
      <section class="panel">
        <div class="panel-head">
          <h2>متابعات مستحقة ${overdue ? html`<span class="chip red">${overdue} متأخرة</span>` : ''}</h2>
          <a class="btn btn-sm btn-ghost" href="#/followups">كل المتابعات</a>
        </div>
        <div class="panel-body" style="padding-bottom:6px">
          ${due.length ? due.slice(0, 8).map((t) => taskRow(t, { compact: true })) : html`<div class="empty"><strong>لا شيء مستحق اليوم</strong>المتابعات ذات تاريخ استحقاق اليوم أو قبله تظهر هنا.</div>`}
          ${due.length > 8 ? html`<a class="btn btn-sm btn-ghost" href="#/followups">و${due.length - 8} أخرى…</a>` : ''}
        </div>
      </section>

      <div class="stack" style="gap:18px">
        <section class="panel">
          <div class="panel-head"><h2>اللجنة القادمة</h2><a class="btn btn-sm btn-ghost" href="#/committee?date=${sDate}">فتح الجلسة</a></div>
          <div class="figure-row">
            <div class="figure"><b>${fmtDate(sDate, 'med')}</b><span>${sDate === today ? 'اليوم' : 'موعد الجلسة'}</span></div>
            <div class="figure"><b>${sCases.length}</b><span>حالة مُدرجة</span></div>
            <div class="figure"><b style="color:var(--red)">${incomplete.length}</b><span>ناقصة البيانات</span></div>
            ${presented ? html`<div class="figure"><b style="color:var(--accent-ink)">${presented}</b><span>عُرضت</span></div>` : ''}
          </div>
          ${incomplete.length ? html`<ul class="mini-list">${incomplete.slice(0, 5).map((c) => { const p = patient(c.patientId) || {}; return html`
            <li><div><button class="patient-link" data-action="open-patient" data-id="${c.patientId}">${p.name}</button>
              <div class="small" style="color:var(--red)">ينقصه: ${readiness(c, p).missing.map((m) => m.l).join('، ')}</div></div>
              <span class="muted small">د. ${c.physician || '—'}</span></li>`; })}</ul>` : ''}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>عيادات اليوم</h2><a class="btn btn-sm btn-ghost" href="#/clinic?date=${today}">فتح القائمة</a></div>
          ${visitsToday.length ? html`
            <div class="figure-row">
              <div class="figure"><b>${visitsToday.length}</b><span>مريض</span></div>
              <div class="figure"><b>${visitsToday.filter((v) => !String(v.plan || '').trim()).length}</b><span>بدون خطة</span></div>
              <div class="figure"><b>${visitsToday.filter((v) => !patient(v.patientId)?.phone).length}</b><span>بدون هاتف</span></div>
            </div>
            <ul class="mini-list">${[...byDoc].map(([d, n]) => html`<li><span>د. ${d}</span><span class="muted">${n}</span></li>`)}</ul>`
          : html`<div class="empty">لم تُستورد قائمة عيادة لهذا اليوم بعد.</div>`}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>تصحيح البيانات</h2><a class="btn btn-sm btn-ghost" href="#/quality">فتح</a></div>
          ${iss.length ? html`
            <div class="figure-row">
              <div class="figure"><b style="color:var(--red)">${high.length}</b><span>عالية الأهمية</span></div>
              <div class="figure"><b>${iss.length}</b><span>إجمالي الملاحظات</span></div>
            </div>
            ${high.length ? html`<ul class="mini-list">${high.slice(0, 4).map((i) => html`<li><span>${icon('alert', 15)} ${i.l}</span><span class="muted small">${i.detail || patient(i.patientId)?.name || ''}</span></li>`)}</ul>` : ''}`
          : html`<div class="empty">لا توجد ملاحظات على البيانات.</div>`}
        </section>
      </div>
    </div>`;
}
