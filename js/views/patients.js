// Patients: the master registry. One record per person; everything links to it.
import { html, todayISO, fmtDate, matchesQuery, normMrn } from '../util.js';
import { idx } from '../store.js';
import { issues, CASE_STATUS } from '../rules.js';
import { icon, telLink } from '../ui.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('المرضى', 'Patients');

export function render() {
  const { lists, visitsBy, committeeBy, followupsBy } = idx();
  const today = todayISO();
  const issueSet = new Set(issues().flatMap((i) => (i.patients ? i.patients.map((p) => p.id) : [i.patientId])));

  let rows = lists.patients.map((p) => {
    const vs = visitsBy.get(p.id) || [];
    const cs = committeeBy.get(p.id) || [];
    const fs = (followupsBy.get(p.id) || []).filter((f) => f.status === 'open' || f.status === 'waiting');
    const lastVisit = vs.reduce((m, v) => (v.sessionDate > m ? v.sessionDate : m), '');
    const lastCase = [...cs].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0];
    return { p, lastVisit, lastCase, openFu: fs.length, hasIssue: issueSet.has(p.id), addedToday: String(p.createdAt).slice(0, 10) === today };
  });
  const counts = {
    all: rows.length,
    today: rows.filter((r) => r.addedToday).length,
    fu: rows.filter((r) => r.openFu).length,
    issues: rows.filter((r) => r.hasIssue).length,
  };
  if (ui.patientsFilter === 'today') rows = rows.filter((r) => r.addedToday);
  if (ui.patientsFilter === 'fu') rows = rows.filter((r) => r.openFu);
  if (ui.patientsFilter === 'issues') rows = rows.filter((r) => r.hasIssue);
  if (ui.patientsQuery) {
    const nm = normMrn(ui.patientsQuery);
    rows = rows.filter((r) => (nm && normMrn(r.p.mrn).includes(nm)) || matchesQuery(ui.patientsQuery, r.p.name, r.p.phone, r.p.physician, r.p.diagnosis));
  }
  rows.sort((a, b) => (b.lastVisit || b.p.createdAt || '').localeCompare(a.lastVisit || a.p.createdAt || ''));
  const shown = rows.slice(0, ui.patientsLimit);

  return html`
    <div class="toolbar">
      <label class="search-box" style="flex:1; max-width:420px"><input class="input" type="search" placeholder="${tr('الاسم، رقم الملف، الهاتف، الطبيب أو التشخيص', 'Name, file number, phone, doctor or diagnosis')}" value="${ui.patientsQuery}" data-input="pt-q" data-key="pt-q">${icon('search', 16)}</label>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-action="new-patient">${icon('plus')} ${tr('مريض جديد', 'New patient')}</button>
    </div>
    <div class="tabs">
      ${[['all', tr('الكل', 'All')], ['today', tr('أُضيفوا اليوم', 'Added today')], ['fu', tr('لديهم متابعات مفتوحة', 'With open follow-ups')], ['issues', tr('بحاجة لتصحيح', 'Need fixing')]].map(([k, l]) => html`
        <button class="tab ${ui.patientsFilter === k ? 'active' : ''}" data-action="pt-filter" data-v="${k}">${l} <span class="n">${counts[k]}</span></button>`)}
    </div>
    <div class="panel">
      ${shown.length ? html`
      <div class="table-wrap"><table class="data">
        <thead><tr><th>${tr('الاسم', 'Name')}</th><th>${tr('رقم الملف', 'File no.')}</th><th>${tr('الهاتف', 'Phone')}</th><th>${tr('الطبيب', 'Doctor')}</th><th>${tr('آخر زيارة', 'Last visit')}</th><th>${tr('اللجنة', 'Committee')}</th><th>${tr('متابعات مفتوحة', 'Open follow-ups')}</th></tr></thead>
        <tbody>${shown.map((r) => html`
          <tr>
            <td><button class="patient-link" data-action="open-patient" data-id="${r.p.id}">${r.p.name || tr('بدون اسم', 'No name')}</button>
              ${r.hasIssue ? html` <span class="chip amber" title="${tr('توجد ملاحظات على بيانات هذا المريض', 'This patient\'s data has issues')}">${icon('alert', 12)} ${tr('تصحيح', 'Fix')}</span>` : ''}</td>
            <td class="mrn">${r.p.mrn || '—'}</td>
            <td>${telLink(r.p.phone)}</td>
            <td>${r.p.physician ? dr(r.p.physician) : html`<span class="muted">—</span>`}</td>
            <td class="nowrap">${r.lastVisit ? fmtDate(r.lastVisit) : html`<span class="muted">—</span>`}</td>
            <td class="nowrap">${r.lastCase ? html`<span class="chip ${CASE_STATUS[r.lastCase.status]?.chip || ''}">${(CASE_STATUS[r.lastCase.status] || CASE_STATUS.listed).l} ${fmtDate(r.lastCase.sessionDate)}</span>` : html`<span class="muted">—</span>`}</td>
            <td>${r.openFu ? html`<span class="chip amber">${r.openFu}</span>` : html`<span class="muted">—</span>`}</td>
          </tr>`)}</tbody>
      </table></div>
      ${rows.length > shown.length ? html`<div class="panel-body"><button class="btn" data-action="pt-more">${tr(`عرض المزيد (${rows.length - shown.length} متبقٍ)`, `Show more (${rows.length - shown.length} left)`)}</button></div>` : ''}`
      : html`<div class="empty"><strong>${tr('لا نتائج', 'No results')}</strong>${ui.patientsQuery ? tr('جرّب البحث برقم الملف أو جزء من الاسم.', 'Try the file number or part of the name.') : tr('أضف مريضاً أو استورد قائمة من صفحة العيادة أو اللجنة.', 'Add a patient or import a list from the clinic or committee page.')}</div>`}
    </div>`;
}

registerActions({
  'pt-filter': (el) => { ui.patientsFilter = el.dataset.v; ui.patientsLimit = 200; },
  'pt-more': () => { ui.patientsLimit += 300; },
});
registerChanges({
  'pt-q': (el) => { ui.patientsQuery = el.value; ui.patientsLimit = 200; },
});
