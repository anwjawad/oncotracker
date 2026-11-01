// Domain rules: vocabularies, data-quality checks, and automatic follow-ups.
import { idx, store } from './store.js';
import { normMrn, normName, cleanName, phoneDigits, latinDigits, wordCount, todayISO, addDays } from './util.js';
import { tr, lang } from './i18n.js';

// Vocabulary entry with a .l getter that returns the label in the current language.
const term = (v, ar, en, extra = {}) => ({ v, ar, en, ...extra, get l() { return lang() === 'en' ? this.en : this.ar; } });

export const FU_TYPES = [
  term('NOTIFY', 'تبليغ المريض', 'Notify patient'),
  term('APPOINTMENT', 'حجز موعد', 'Book appointment'),
  term('REFERRAL', 'تحويل', 'Referral'),
  term('PERMIT', 'تصريح', 'Permit'),
  term('TESTS', 'فحوصات وصور', 'Tests & imaging'),
  term('RESULTS', 'متابعة نتيجة', 'Follow up result'),
  term('COMMUNICATE', 'تواصل مع المريض', 'Contact patient'),
  term('OTHER', 'أخرى', 'Other'),
];
export const fuLabel = (v) => (FU_TYPES.find((t) => t.v === v) || FU_TYPES.at(-1)).l;

export const ATTEMPT_RESULTS = [
  term('NO_ANSWER', 'لم يرد', 'No answer'),
  term('OFF', 'الهاتف مغلق', 'Phone off'),
  term('WRONG', 'رقم خاطئ', 'Wrong number'),
  term('REACHED', 'تم التواصل، ينتظر إجراء', 'Reached, action pending'),
  term('OTHER', 'أخرى', 'Other'),
];
export const attemptLabel = (v) => ATTEMPT_RESULTS.find((t) => t.v === v)?.l || v;

export const CASE_STATUS = {
  listed: term('listed', 'مُدرج', 'Listed', { chip: '' }),
  ready: term('ready', 'جاهز', 'Ready', { chip: 'blue' }),
  presented: term('presented', 'عُرض', 'Presented', { chip: 'accent' }),
  deferred: term('deferred', 'مؤجّل', 'Deferred', { chip: 'amber' }),
  withdrawn: term('withdrawn', 'مسحوب', 'Withdrawn', { chip: '' }),
};

// Words in a clinic plan that suggest the patient should go to the committee.
const COMMITTEE_HINTS = ['new case', 'meeting', 'mdt', 'tumor board', 'لجنة', 'عرض على', 'حالات جديدة'];
export const suggestsCommittee = (plan) => COMMITTEE_HINTS.some((k) => String(plan || '').toLowerCase().includes(k));

// ---------- committee readiness ----------
export function readiness(c, p) {
  const items = [
    { k: 'mrn', l: tr('رقم الملف', 'File number'), ok: !!normMrn(p?.mrn) },
    { k: 'history', l: tr('القصة المرضية', 'Brief history'), ok: !!String(c.briefHistory || '').trim() },
    { k: 'question', l: tr('السؤال أو الخطة', 'Question or plan'), ok: !!String(c.question || c.plan || '').trim() },
    { k: 'physician', l: tr('الطبيب', 'Doctor'), ok: !!String(c.physician || '').trim() },
  ];
  return { items, ready: items.every((i) => i.ok), missing: items.filter((i) => !i.ok) };
}

// The coordinator's "Ready" mark overrides the checklist.
export function caseStage(c, p) {
  if (c.status === 'presented' || c.status === 'deferred' || c.status === 'withdrawn') return c.status;
  return c.ready === '1' || readiness(c, p).ready ? 'ready' : 'listed';
}

// ---------- automatic follow-ups derived from clinic visits ----------
// Not stored: they appear while the condition holds and vanish once it is met
// (patient notified / appointment set), or when the coordinator closes them.
// Skipped: appointments already in the past (nothing left to notify), visits older
// than 60 days without an appointment, and visits that already have an open manual follow-up.
export function autoTasks() {
  const out = [];
  const { lists } = idx();
  const today = todayISO();
  const oldest = addDays(today, -60);
  const covered = new Set(lists.followups.filter((f) => f.status === 'open' || f.status === 'waiting').map((f) => f.sourceId));
  for (const v of lists.visits) {
    if (v.notified === 'Y' || v.autoClosed === '1' || covered.has(v.id)) continue;
    if (v.opcDate) {
      if (v.opcDate < today) continue;
      out.push({
        id: `auto:NOTIFY:${v.id}`, auto: 'NOTIFY', patientId: v.patientId, sourceType: 'visit', sourceId: v.id,
        type: 'NOTIFY', title: tr('تبليغ المريض بموعد العيادة', 'Notify patient of clinic appointment'), dueDate: addDays(v.sessionDate || todayISO(), 1),
        status: 'open', attempts: [], physician: v.physician, visit: v,
      });
    } else if (String(v.plan || '').trim() && v.sessionDate >= oldest) {
      out.push({
        id: `auto:BOOK:${v.id}`, auto: 'BOOK', patientId: v.patientId, sourceType: 'visit', sourceId: v.id,
        type: 'APPOINTMENT', title: tr('تحديد موعد العيادة القادم', 'Set next clinic appointment'), dueDate: addDays(v.sessionDate || todayISO(), 3),
        status: 'open', attempts: [], physician: v.physician, visit: v,
      });
    }
  }
  return out;
}

export function openTasks() {
  const manual = idx().lists.followups.filter((f) => f.status === 'open' || f.status === 'waiting');
  return [...manual, ...autoTasks()];
}

export function overdueCount() {
  const t = todayISO();
  return openTasks().filter((f) => f.dueDate && f.dueDate <= t).length;
}

// ---------- data quality ----------
export const ISSUE_DEFS = {
  DUP_MRN: term('DUP_MRN', 'رقم ملف مكرر لأكثر من مريض', 'File number used by more than one patient', { sev: 'high', fix: 'merge' }),
  DUP_NAME: term('DUP_NAME', 'اسم مكرر — قد يكون نفس المريض', 'Same name, possibly the same patient', { sev: 'mid', fix: 'merge' }),
  NO_MRN: term('NO_MRN', 'بدون رقم ملف', 'No file number', { sev: 'high', fix: 'edit', field: 'mrn' }),
  PHONE_WRONG: term('PHONE_WRONG', 'الرقم أُبلغ أنه خاطئ أثناء المتابعة', 'Phone reported wrong during follow-up', { sev: 'high', fix: 'edit', field: 'phone' }),
  NO_PHONE: term('NO_PHONE', 'بدون رقم هاتف', 'No phone number', { sev: 'mid', fix: 'edit', field: 'phone' }),
  PHONE_FORMAT: term('PHONE_FORMAT', 'رقم هاتف بصيغة غير صحيحة', 'Phone number in a wrong format', { sev: 'mid', fix: 'edit', field: 'phone' }),
  MRN_FORMAT: term('MRN_FORMAT', 'رقم الملف يحتاج تنسيق', 'File number needs formatting', { sev: 'low', fix: 'auto' }),
  NAME_FORMAT: term('NAME_FORMAT', 'مسافات أو أرقام عربية في الاسم', 'Extra spaces or Arabic digits in name', { sev: 'low', fix: 'auto' }),
  SHORT_NAME: term('SHORT_NAME', 'اسم مختصر (قد يكون مقطوعاً)', 'Short name (may be truncated)', { sev: 'low', fix: 'edit', field: 'name' }),
  NO_PHYSICIAN: term('NO_PHYSICIAN', 'زيارة أو حالة بدون طبيب', 'Visit or case without a doctor', { sev: 'mid', fix: 'record' }),
  OPC_BEFORE: term('OPC_BEFORE', 'موعد العيادة قبل تاريخ الجلسة', 'Clinic appointment before session date', { sev: 'mid', fix: 'record' }),
};

export function phoneProblem(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const d = phoneDigits(raw).replace(/^\+/, '');
  if (latinDigits(raw) !== raw) return { fixable: true, value: fixPhone(raw) };
  if (/[^\d+\s\-()]/.test(raw)) return { fixable: false };
  if (/^5\d{8}$/.test(d)) return { fixable: true, value: '0' + d };   // lost leading zero in Sheets
  if (d.length < 9 || d.length > 13) return { fixable: false };
  return null;
}
export function fixPhone(v) {
  const d = phoneDigits(v);
  return /^5\d{8}$/.test(d) ? '0' + d : d;
}

export function computeIssues() {
  const { lists, byMrn, visitsBy, followupsBy } = idx();
  const issues = [];
  const today = todayISO();
  const ignored = (p, key) => (p.ignoredIssues || []).includes(key);
  const push = (code, extra) => { const d = ISSUE_DEFS[code]; issues.push({ code, l: d.l, sev: d.sev, fix: d.fix, field: d.field, ...extra }); };

  const inDupMrn = new Set();
  for (const [mrn, ps] of byMrn) {
    if (ps.length < 2) continue;
    ps.forEach((p) => inDupMrn.add(p.id));
    push('DUP_MRN', { key: `DUP_MRN:${mrn}`, patients: ps, patientId: ps[0].id, detail: `${tr('رقم الملف', 'File no.')} ${mrn}` });
  }

  const byName = new Map();
  for (const p of lists.patients) {
    const n = normName(p.name);
    if (wordCount(n) < 2) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(p);
  }
  for (const [, ps] of byName) {
    if (ps.length < 2 || ps.every((p) => inDupMrn.has(p.id))) continue;
    const key = `DUP_NAME:${ps.map((p) => p.id).sort().join('+')}`;
    if (ps.some((p) => ignored(p, key))) continue;
    push('DUP_NAME', { key, patients: ps, patientId: ps[0].id, detail: ps.map((p) => p.mrn || tr('بدون رقم', 'no number')).join(' / ') });
  }

  for (const p of lists.patients) {
    const k = (c) => `${c}:${p.id}`;
    const hasFuture = (visitsBy.get(p.id) || []).some((v) => v.opcDate >= today) || (followupsBy.get(p.id) || []).some((f) => f.status === 'open');
    if (!normMrn(p.mrn)) { if (!ignored(p, k('NO_MRN'))) push('NO_MRN', { key: k('NO_MRN'), patientId: p.id }); }
    else if (normMrn(p.mrn) !== p.mrn) push('MRN_FORMAT', { key: k('MRN_FORMAT'), patientId: p.id, detail: `${p.mrn} ← ${normMrn(p.mrn)}`, autofix: { mrn: normMrn(p.mrn) } });

    if (p.phoneFlag === 'wrong') push('PHONE_WRONG', { key: k('PHONE_WRONG'), patientId: p.id, detail: p.phone });
    else if (!String(p.phone || '').trim()) {
      if (!ignored(p, k('NO_PHONE'))) push('NO_PHONE', { key: k('NO_PHONE'), patientId: p.id, sev: hasFuture ? 'high' : 'mid', detail: hasFuture ? tr('لديه موعد أو متابعة مفتوحة', 'Has an appointment or open follow-up') : '' });
    } else {
      const pp = phoneProblem(p.phone);
      if (pp && !ignored(p, k('PHONE_FORMAT'))) push('PHONE_FORMAT', { key: k('PHONE_FORMAT'), patientId: p.id, detail: pp.fixable ? `${p.phone} ← ${pp.value}` : p.phone, autofix: pp.fixable ? { phone: pp.value } : null });
    }

    if (cleanName(p.name) !== p.name) push('NAME_FORMAT', { key: k('NAME_FORMAT'), patientId: p.id, detail: p.name, autofix: { name: cleanName(p.name) } });
    else if (wordCount(p.name) < 3 && !ignored(p, k('SHORT_NAME'))) push('SHORT_NAME', { key: k('SHORT_NAME'), patientId: p.id, detail: p.name });
  }

  for (const v of lists.visits) {
    if (!String(v.physician || '').trim()) push('NO_PHYSICIAN', { key: `NO_PHYSICIAN:${v.id}`, patientId: v.patientId, record: { table: 'visits', id: v.id }, detail: `${tr('زيارة', 'Visit')} ${v.sessionDate}` });
    if (v.opcDate && v.sessionDate && v.opcDate < v.sessionDate) push('OPC_BEFORE', { key: `OPC_BEFORE:${v.id}`, patientId: v.patientId, record: { table: 'visits', id: v.id }, detail: `${tr('الجلسة', 'Session')} ${v.sessionDate} — ${tr('الموعد', 'Appointment')} ${v.opcDate}` });
  }
  for (const c of lists.committee) {
    if (!String(c.physician || '').trim() && c.status !== 'withdrawn') push('NO_PHYSICIAN', { key: `NO_PHYSICIAN:${c.id}`, patientId: c.patientId, record: { table: 'committee', id: c.id }, detail: `${tr('لجنة', 'Committee')} ${c.sessionDate}` });
  }

  const order = { high: 0, mid: 1, low: 2 };
  return issues.sort((a, b) => order[a.sev] - order[b.sev]);
}

let issueMemo = { v: -1, lang: '', list: [] };
export function issues() {
  if (issueMemo.v !== store.version || issueMemo.lang !== lang()) issueMemo = { v: store.version, lang: lang(), list: computeIssues() };
  return issueMemo.list;
}
export const issuesFor = (patientId) => issues().filter((i) => i.patientId === patientId || i.patients?.some((p) => p.id === patientId));
