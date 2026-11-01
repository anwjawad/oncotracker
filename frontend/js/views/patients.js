// Patients: the master registry. One record per person; everything links to it.
import { html, todayISO, fmtDate, matchesQuery, normMrn } from '../util.js';
import { idx } from '../store.js';
import { issues, CASE_STATUS } from '../rules.js';
import { icon, telLink } from '../ui.js';
import { registerActions, registerChanges, ui } from '../registry.js';

export const title = 'المرضى';

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
      <label class="search-box" style="flex:1; max-width:420px"><input class="input" type="search" placeholder="الاسم، رقم الملف، الهاتف، الطبيب أو التشخيص" value="${ui.patientsQuery}" data-input="pt-q" data-key="pt-q">${icon('search', 16)}</label>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-action="new-patient">${icon('plus')} مريض جديد</button>
    </div>
    <div class="tabs">
      ${[['all', 'الكل'], ['today', 'أُضيفوا اليوم'], ['fu', 'لديهم متابعات مفتوحة'], ['issues', 'بحاجة لتصحيح']].map(([k, l]) => html`
        <button class="tab ${ui.patientsFilter === k ? 'active' : ''}" data-action="pt-filter" data-v="${k}">${l} <span class="n">${counts[k]}</span></button>`)}
    </div>
    <div class="panel">
      ${shown.length ? html`
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الاسم</th><th>رقم الملف</th><th>الهاتف</th><th>الطبيب</th><th>آخر زيارة</th><th>اللجنة</th><th>متابعات مفتوحة</th></tr></thead>
        <tbody>${shown.map((r) => html`
          <tr>
            <td><button class="patient-link" data-action="open-patient" data-id="${r.p.id}">${r.p.name || 'بدون اسم'}</button>
              ${r.hasIssue ? html` <span class="chip amber" title="توجد ملاحظات على بيانات هذا المريض">${icon('alert', 12)} تصحيح</span>` : ''}</td>
            <td class="mrn">${r.p.mrn || '—'}</td>
            <td>${telLink(r.p.phone)}</td>
            <td>${r.p.physician || html`<span class="muted">—</span>`}</td>
            <td class="nowrap">${r.lastVisit ? fmtDate(r.lastVisit) : html`<span class="muted">—</span>`}</td>
            <td class="nowrap">${r.lastCase ? html`<span class="chip ${CASE_STATUS[r.lastCase.status]?.chip || ''}">${CASE_STATUS[r.lastCase.status]?.l || 'مُدرج'} ${fmtDate(r.lastCase.sessionDate)}</span>` : html`<span class="muted">—</span>`}</td>
            <td>${r.openFu ? html`<span class="chip amber">${r.openFu}</span>` : html`<span class="muted">—</span>`}</td>
          </tr>`)}</tbody>
      </table></div>
      ${rows.length > shown.length ? html`<div class="panel-body"><button class="btn" data-action="pt-more">عرض المزيد (${rows.length - shown.length} متبقٍ)</button></div>` : ''}`
      : html`<div class="empty"><strong>لا نتائج</strong>${ui.patientsQuery ? 'جرّب البحث برقم الملف أو جزء من الاسم.' : 'أضف مريضاً أو استورد قائمة من صفحة العيادة أو اللجنة.'}</div>`}
    </div>`;
}

registerActions({
  'pt-filter': (el) => { ui.patientsFilter = el.dataset.v; ui.patientsLimit = 200; },
  'pt-more': () => { ui.patientsLimit += 300; },
});
registerChanges({
  'pt-q': (el) => { ui.patientsQuery = el.value; ui.patientsLimit = 200; },
});
