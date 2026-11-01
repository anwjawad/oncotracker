// Reports: activity per period, per physician, and how quickly follow-ups close.
import { html, todayISO, addDays, diffDays, monthKey, fmtMonth, median, byText, loadXLSX, fmtDate } from '../util.js';
import { idx, patient } from '../store.js';
import { FU_TYPES, fuLabel, CASE_STATUS, openTasks } from '../rules.js';
import { icon, toast } from '../ui.js';
import { registerActions, registerChanges, ui } from '../registry.js';
import { tr, dr } from '../i18n.js';

export const title = () => tr('التقارير', 'Reports');

const RANGES = () => ({ '1m': [tr('آخر 30 يوماً', 'Last 30 days'), 30], '3m': [tr('آخر 3 أشهر', 'Last 3 months'), 91], '12m': [tr('آخر 12 شهراً', 'Last 12 months'), 365], all: [tr('كل الفترات', 'All time'), 100000] });

function bars(items) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return html`<div class="bars">${items.map((i) => html`
    <div class="bar-row"><span>${i.l}</span><div class="bar-track" role="img" aria-label="${i.l}: ${i.n}"><div class="bar-fill" style="width:${(i.n / max) * 100}%"></div></div><b>${i.n}</b></div>`)}</div>`;
}

export function render() {
  const ranges = RANGES();
  const [, days] = ranges[ui.reportsRange];
  const from = addDays(todayISO(), -days);
  const { lists } = idx();
  const inRange = (d) => d && d >= from;
  const visits = lists.visits.filter((v) => inRange(v.sessionDate));
  const cases = lists.committee.filter((c) => inRange(c.sessionDate));
  const fuOpened = lists.followups.filter((f) => inRange(String(f.createdAt).slice(0, 10)));
  const fuClosed = lists.followups.filter((f) => f.status === 'done' && inRange(String(f.closedAt).slice(0, 10)));
  const closeDays = fuClosed.map((f) => diffDays(String(f.createdAt).slice(0, 10), String(f.closedAt).slice(0, 10))).filter((n) => n >= 0);
  const med = median(closeDays);
  const overdueNow = openTasks().filter((t) => t.dueDate && t.dueDate < todayISO()).length;
  const notifiedPct = visits.length ? Math.round((visits.filter((v) => v.notified === 'Y').length / visits.length) * 100) : 0;

  const months = new Map();
  for (const v of visits) { const k = monthKey(v.sessionDate); months.set(k, { v: (months.get(k)?.v || 0) + 1, c: months.get(k)?.c || 0 }); }
  for (const c of cases) { const k = monthKey(c.sessionDate); months.set(k, { v: months.get(k)?.v || 0, c: (months.get(k)?.c || 0) + 1 }); }
  const monthRows = [...months].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

  const docs = new Map();
  const doc = (d) => { if (!docs.has(d)) docs.set(d, { visits: 0, notified: 0, cases: 0, decided: 0 }); return docs.get(d); };
  for (const v of visits) { const r = doc(v.physician || ''); r.visits++; if (v.notified === 'Y') r.notified++; }
  for (const c of cases) { const r = doc(c.physician || ''); r.cases++; if (c.status === 'presented') r.decided++; }

  const byType = FU_TYPES.map((t) => ({ l: t.l, n: fuOpened.filter((f) => f.type === t.v).length })).filter((x) => x.n);
  const caseStatus = Object.entries(CASE_STATUS).filter(([k]) => k !== 'ready').map(([k, s]) => ({ l: s.l, n: cases.filter((c) => (c.status || 'listed') === k).length })).filter((x) => x.n);

  return html`
    <div class="toolbar">
      <select class="input" style="width:auto" data-change="rp-range" aria-label="${tr('الفترة', 'Period')}">
        ${Object.entries(ranges).map(([k, [l]]) => html`<option value="${k}" ${ui.reportsRange === k ? 'selected' : ''}>${l}</option>`)}
      </select>
      <span class="muted small">${ui.reportsRange === 'all' ? '' : tr(`من ${fmtDate(from, 'med')} حتى اليوم`, `From ${fmtDate(from, 'med')} to today`)}</span>
      <span class="spacer"></span>
      <button class="btn" data-action="rp-export">${icon('download')} ${tr('تصدير كل البيانات إلى Excel', 'Export all data to Excel')}</button>
    </div>

    <div class="kpis">
      <div class="kpi"><b>${visits.length}</b><span>${tr('زيارات عيادة', 'Clinic visits')}</span></div>
      <div class="kpi"><b>${notifiedPct}%</b><span>${tr('نسبة التبليغ', 'Notified')}</span></div>
      <div class="kpi"><b>${cases.length}</b><span>${tr('حالات على اللجنة', 'Committee cases')}</span></div>
      <div class="kpi"><b>${cases.filter((c) => c.status === 'presented').length}</b><span>${tr('قرارات مسجّلة', 'Decisions recorded')}</span></div>
      <div class="kpi"><b>${fuOpened.length}</b><span>${tr('متابعات فُتحت', 'Follow-ups opened')}</span></div>
      <div class="kpi"><b>${fuClosed.length}</b><span>${tr('متابعات أُنجزت', 'Follow-ups completed')}</span></div>
      <div class="kpi"><b>${med === null ? '—' : Math.round(med * 10) / 10}</b><span>${tr('وسيط أيام الإنجاز', 'Median days to complete')}</span></div>
      <div class="kpi"><b style="color:${overdueNow ? 'var(--red)' : 'inherit'}">${overdueNow}</b><span>${tr('متأخرة الآن', 'Overdue now')}</span></div>
    </div>

    <div class="cols-2">
      <section class="panel">
        <div class="panel-head"><h3>${tr('شهرياً', 'By month')}</h3><span class="small muted">${tr('زيارات / حالات لجنة', 'visits / committee cases')}</span></div>
        <div class="panel-body">${monthRows.length ? html`<div class="table-wrap"><table class="data">
          <thead><tr><th>${tr('الشهر', 'Month')}</th><th>${tr('زيارات العيادة', 'Clinic visits')}</th><th>${tr('حالات اللجنة', 'Committee cases')}</th></tr></thead>
          <tbody>${monthRows.map(([k, r]) => html`<tr><td>${fmtMonth(k)}</td><td>${r.v}</td><td>${r.c}</td></tr>`)}</tbody></table></div>`
          : html`<div class="empty">${tr('لا بيانات في هذه الفترة.', 'No data in this period.')}</div>`}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>${tr('المتابعات حسب النوع', 'Follow-ups by type')}</h3></div>
        <div class="panel-body">${byType.length ? bars(byType) : html`<div class="empty">${tr('لا متابعات في هذه الفترة.', 'No follow-ups in this period.')}</div>`}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>${tr('حسب الطبيب', 'By doctor')}</h3></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>${tr('الطبيب', 'Doctor')}</th><th>${tr('زيارات', 'Visits')}</th><th>${tr('تبليغ', 'Notified')}</th><th>${tr('حالات لجنة', 'Committee')}</th><th>${tr('قرارات', 'Decisions')}</th></tr></thead>
          <tbody>${[...docs].sort((a, b) => b[1].visits + b[1].cases - (a[1].visits + a[1].cases) || byText(a[0], b[0])).map(([d, r]) => html`
            <tr><td>${dr(d)}</td><td>${r.visits}</td><td>${r.visits ? Math.round((r.notified / r.visits) * 100) + '%' : '—'}</td><td>${r.cases}</td><td>${r.decided}</td></tr>`)}</tbody>
        </table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>${tr('حالات اللجنة حسب النتيجة', 'Committee cases by outcome')}</h3></div>
        <div class="panel-body">${caseStatus.length ? bars(caseStatus) : html`<div class="empty">${tr('لا حالات في هذه الفترة.', 'No cases in this period.')}</div>`}</div>
      </section>
    </div>`;
}

async function exportAll() {
  let XLSX;
  try { XLSX = await loadXLSX(); } catch (e) { toast(e.message, { type: 'error' }); return; }
  const { lists } = idx();
  const P = (id) => patient(id) || {};
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  add(tr('المرضى', 'Patients'), lists.patients.map((p) => ({ [tr('الاسم', 'Name')]: p.name, [tr('رقم الملف', 'File no.')]: p.mrn, [tr('الهاتف', 'Phone')]: p.phone, [tr('هاتف آخر', 'Phone 2')]: p.phone2, [tr('العمر', 'Age')]: p.age, [tr('الطبيب', 'Doctor')]: p.physician, [tr('التشخيص', 'Diagnosis')]: p.diagnosis, [tr('ملاحظات', 'Notes')]: p.notes })));
  add(tr('زيارات العيادة', 'Clinic visits'), lists.visits.map((v) => ({ [tr('التاريخ', 'Date')]: v.sessionDate, [tr('المريض', 'Patient')]: P(v.patientId).name, [tr('رقم الملف', 'File no.')]: P(v.patientId).mrn, [tr('الطبيب', 'Doctor')]: v.physician, [tr('الخطة', 'Plan')]: v.plan, [tr('الموعد القادم', 'Next appointment')]: v.opcDate, [tr('تصريح', 'Permit')]: v.permit, [tr('تحويل', 'Referral')]: v.referral, [tr('تبليغ', 'Notified')]: v.notified })));
  add(tr('اللجنة', 'Committee'), lists.committee.map((c) => ({ [tr('الجلسة', 'Session')]: c.sessionDate, [tr('المريض', 'Patient')]: P(c.patientId).name, [tr('رقم الملف', 'File no.')]: P(c.patientId).mrn, [tr('الطبيب', 'Doctor')]: c.physician, [tr('القصة', 'History')]: c.briefHistory, [tr('السؤال', 'Question')]: c.question, [tr('جاهز', 'Ready')]: c.ready === '1' ? '✓' : '', [tr('الحالة', 'Status')]: (CASE_STATUS[c.status] || CASE_STATUS.listed).l, [tr('القرار', 'Decision')]: c.decision, [tr('الملاحق', 'Addenda')]: (c.addenda || []).map((a) => a.text).join(' | ') })));
  add(tr('المتابعات', 'Follow-ups'), lists.followups.map((f) => ({ [tr('المريض', 'Patient')]: P(f.patientId).name, [tr('رقم الملف', 'File no.')]: P(f.patientId).mrn, [tr('النوع', 'Type')]: fuLabel(f.type), [tr('المطلوب', 'Task')]: f.title, [tr('الاستحقاق', 'Due')]: f.dueDate, [tr('الحالة', 'Status')]: f.status, [tr('النتيجة', 'Outcome')]: f.outcome, [tr('فُتحت', 'Opened')]: String(f.createdAt).slice(0, 10), [tr('أُغلقت', 'Closed')]: String(f.closedAt).slice(0, 10), [tr('المحاولات', 'Attempts')]: (f.attempts || []).length })));
  XLSX.writeFile(wb, `onco-tracker-${todayISO()}.xlsx`);
}

registerActions({ 'rp-export': () => exportAll() });
registerChanges({ 'rp-range': (el) => { ui.reportsRange = el.value; } });
