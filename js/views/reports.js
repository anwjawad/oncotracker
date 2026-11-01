// Reports: activity per period, per physician, and how quickly follow-ups close.
import { html, todayISO, addDays, diffDays, monthKey, fmtMonth, median, byText, loadXLSX, fmtDate } from '../util.js';
import { idx, patient } from '../store.js';
import { FU_TYPES, fuLabel, CASE_STATUS, openTasks } from '../rules.js';
import { icon, toast } from '../ui.js';
import { registerActions, registerChanges, ui } from '../registry.js';

export const title = 'التقارير';

const RANGES = { '1m': ['آخر 30 يوماً', 30], '3m': ['آخر 3 أشهر', 91], '12m': ['آخر 12 شهراً', 365], all: ['كل الفترات', 100000] };

function bars(items) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return html`<div class="bars">${items.map((i) => html`
    <div class="bar-row"><span>${i.l}</span><div class="bar-track" role="img" aria-label="${i.l}: ${i.n}"><div class="bar-fill" style="width:${(i.n / max) * 100}%"></div></div><b>${i.n}</b></div>`)}</div>`;
}

export function render() {
  const [label, days] = RANGES[ui.reportsRange];
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
  for (const v of visits) { const r = doc(v.physician || 'بدون طبيب'); r.visits++; if (v.notified === 'Y') r.notified++; }
  for (const c of cases) { const r = doc(c.physician || 'بدون طبيب'); r.cases++; if (c.status === 'presented') r.decided++; }

  const byType = FU_TYPES.map((t) => ({ l: t.l, n: fuOpened.filter((f) => f.type === t.v).length })).filter((x) => x.n);
  const caseStatus = Object.entries(CASE_STATUS).map(([k, s]) => ({ l: s.l, n: cases.filter((c) => (c.status || 'listed') === k).length })).filter((x) => x.n);

  return html`
    <div class="toolbar">
      <select class="input" style="width:auto" data-change="rp-range" aria-label="الفترة">
        ${Object.entries(RANGES).map(([k, [l]]) => html`<option value="${k}" ${ui.reportsRange === k ? 'selected' : ''}>${l}</option>`)}
      </select>
      <span class="muted small">${ui.reportsRange === 'all' ? '' : `من ${fmtDate(from, 'med')} حتى اليوم`}</span>
      <span class="spacer"></span>
      <button class="btn" data-action="rp-export">${icon('download')} تصدير كل البيانات إلى Excel</button>
    </div>

    <div class="kpis">
      <div class="kpi"><b>${visits.length}</b><span>زيارات عيادة</span></div>
      <div class="kpi"><b>${notifiedPct}%</b><span>نسبة التبليغ</span></div>
      <div class="kpi"><b>${cases.length}</b><span>حالات على اللجنة</span></div>
      <div class="kpi"><b>${cases.filter((c) => c.status === 'presented').length}</b><span>قرارات مسجّلة</span></div>
      <div class="kpi"><b>${fuOpened.length}</b><span>متابعات فُتحت</span></div>
      <div class="kpi"><b>${fuClosed.length}</b><span>متابعات أُنجزت</span></div>
      <div class="kpi"><b>${med === null ? '—' : Math.round(med * 10) / 10}</b><span>وسيط أيام الإنجاز</span></div>
      <div class="kpi"><b style="color:${overdueNow ? 'var(--red)' : 'inherit'}">${overdueNow}</b><span>متأخرة الآن</span></div>
    </div>

    <div class="cols-2">
      <section class="panel">
        <div class="panel-head"><h3>شهرياً</h3><span class="small muted">زيارات / حالات لجنة</span></div>
        <div class="panel-body">${monthRows.length ? html`<div class="table-wrap"><table class="data">
          <thead><tr><th>الشهر</th><th>زيارات العيادة</th><th>حالات اللجنة</th></tr></thead>
          <tbody>${monthRows.map(([k, r]) => html`<tr><td>${fmtMonth(k)}</td><td>${r.v}</td><td>${r.c}</td></tr>`)}</tbody></table></div>`
          : html`<div class="empty">لا بيانات في هذه الفترة.</div>`}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>المتابعات حسب النوع</h3></div>
        <div class="panel-body">${byType.length ? bars(byType) : html`<div class="empty">لا متابعات في هذه الفترة.</div>`}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>حسب الطبيب</h3></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الطبيب</th><th>زيارات</th><th>تبليغ</th><th>حالات لجنة</th><th>قرارات</th></tr></thead>
          <tbody>${[...docs].sort((a, b) => b[1].visits + b[1].cases - (a[1].visits + a[1].cases) || byText(a[0], b[0])).map(([d, r]) => html`
            <tr><td>${d}</td><td>${r.visits}</td><td>${r.visits ? Math.round((r.notified / r.visits) * 100) + '%' : '—'}</td><td>${r.cases}</td><td>${r.decided}</td></tr>`)}</tbody>
        </table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>حالات اللجنة حسب النتيجة</h3></div>
        <div class="panel-body">${caseStatus.length ? bars(caseStatus) : html`<div class="empty">لا حالات في هذه الفترة.</div>`}</div>
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
  add('المرضى', lists.patients.map((p) => ({ 'الاسم': p.name, 'رقم الملف': p.mrn, 'الهاتف': p.phone, 'هاتف آخر': p.phone2, 'العمر': p.age, 'الطبيب': p.physician, 'التشخيص': p.diagnosis, 'ملاحظات': p.notes })));
  add('زيارات العيادة', lists.visits.map((v) => ({ 'التاريخ': v.sessionDate, 'المريض': P(v.patientId).name, 'رقم الملف': P(v.patientId).mrn, 'الطبيب': v.physician, 'الخطة': v.plan, 'الموعد القادم': v.opcDate, 'تصريح': v.permit, 'تحويل': v.referral, 'تبليغ': v.notified })));
  add('اللجنة', lists.committee.map((c) => ({ 'الجلسة': c.sessionDate, 'المريض': P(c.patientId).name, 'رقم الملف': P(c.patientId).mrn, 'الطبيب': c.physician, 'القصة': c.briefHistory, 'السؤال': c.question, 'الحالة': CASE_STATUS[c.status]?.l || c.status, 'القرار': c.decision, 'الملاحق': (c.addenda || []).map((a) => a.text).join(' | ') })));
  add('المتابعات', lists.followups.map((f) => ({ 'المريض': P(f.patientId).name, 'رقم الملف': P(f.patientId).mrn, 'النوع': fuLabel(f.type), 'المطلوب': f.title, 'الاستحقاق': f.dueDate, 'الحالة': f.status, 'النتيجة': f.outcome, 'فُتحت': String(f.createdAt).slice(0, 10), 'أُغلقت': String(f.closedAt).slice(0, 10), 'المحاولات': (f.attempts || []).length })));
  XLSX.writeFile(wb, `onco-tracker-${todayISO()}.xlsx`);
}

registerActions({ 'rp-export': () => exportAll() });
registerChanges({ 'rp-range': (el) => { ui.reportsRange = el.value; } });
