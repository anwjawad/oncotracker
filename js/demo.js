// Fictional sample data for trying the app in local mode. Includes deliberate
// data-entry problems so the correction centre has something to show.
import { todayISO, addDays, nextWeekday, weekday } from './util.js';
import { settings } from './settings.js';

const FIRST = ['محمد', 'أحمد', 'خالد', 'سامي', 'يوسف', 'إبراهيم', 'عمر', 'فاطمة', 'مريم', 'سعاد', 'هدى', 'نور', 'ليلى', 'رنا', 'منى', 'عبد الله', 'حسن', 'سلمى', 'آمنة', 'زينب'];
const MID = ['علي', 'محمود', 'سليم', 'جميل', 'عادل', 'فؤاد', 'ناصر', 'كمال', 'رشيد', 'وليد'];
const LAST = ['الخطيب', 'النجار', 'الحسيني', 'العمري', 'البرغوثي', 'الشريف', 'القاسم', 'الزعبي', 'حمدان', 'عيسى', 'منصور', 'سلامة'];
const DOCS = ['Wasim', 'Bashir', 'Farah', 'Hanna', 'Amer'];
const PLANS = [
  'Continue FOLFOX cycle 4, CBC before next cycle',
  'CT chest/abdomen/pelvis then OPC with results',
  'Refer to radiotherapy, PET-CT needed',
  'Start tamoxifen, follow up 3 months',
  'New case — present on tumor board لجنة',
  'Biopsy review, MRI pelvis',
  'Supportive care, pain clinic referral',
  '',
];
const HIST = [
  'سيدة 52 سنة، كتلة في الثدي الأيسر، خزعة: IDC grade 2, ER+/PR+/HER2-',
  'رجل 64 سنة، نزيف شرجي، تنظير: كتلة في المستقيم، CT بدون انتشار بعيد',
  'رجل 58 سنة، سعال ونقص وزن، CT: كتلة في الرئة اليمنى 4 سم',
  'سيدة 45 سنة، تضخم غدد رقبية، خزعة: Hodgkin lymphoma',
  '',
];
const QUESTIONS = ['جراحة أولاً أم علاج كيماوي قبل الجراحة؟', 'هل يحتاج علاج إشعاعي مساعد؟', 'تأكيد المرحلة وخطة العلاج', ''];

let seed = 7;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = () => new Date().toISOString();
let n = 0;
const id = (p) => `${p}_demo${(++n).toString(36)}`;

export function seedDemo() {
  seed = 7; n = 0;
  const today = todayISO();
  const db = { patients: {}, visits: {}, committee: {}, followups: {}, activity: [] };
  const put = (t, r) => { db[t][r.id] = { createdAt: iso(), updatedAt: iso(), deleted: '', ...r }; return r; };

  const pts = [];
  for (let i = 0; i < 70; i++) {
    const full = `${pick(FIRST)} ${pick(MID)} ${pick(MID)} ${pick(LAST)}`;
    const parts = full.split(' ');
    const p = put('patients', {
      id: id('P'),
      name: i % 5 === 0 ? `${parts[0]} ${parts[3]}` : full,                         // truncated by old imports
      mrn: i % 17 === 3 ? '' : i % 9 === 0 ? `PAT${100200 + i}` : String(100200 + i),
      phone: i % 7 === 0 ? '' : i % 6 === 0 ? `59${String(1000000 + i * 37).slice(0, 7)}` : i % 11 === 0 ? '٠٥٩٩١٢٣٤٥٦' : `059${String(1000000 + i * 53).slice(0, 7)}`,
      age: String(30 + Math.floor(rnd() * 45)),
      physician: pick(DOCS), diagnosis: '', notes: '', ignoredIssues: '[]',
    });
    pts.push(p);
  }
  // A duplicate created by re-typing a patient with a different spelling.
  put('patients', { id: id('P'), name: pts[1].name.replace('أ', 'ا'), mrn: pts[1].mrn, phone: '', age: pts[1].age, physician: pts[1].physician, ignoredIssues: '[]' });

  for (let d = -9; d <= 0; d++) {
    const date = addDays(today, d);
    if ([5, 6].includes(weekday(date))) continue;
    for (let k = 0; k < 7; k++) {
      const p = pick(pts);
      const plan = pick(PLANS);
      const hasOpc = plan && rnd() > 0.35;
      put('visits', {
        id: id('V'), patientId: p.id, sessionDate: date, physician: p.physician, plan,
        opcDate: hasOpc ? addDays(date, 7 + Math.floor(rnd() * 21)) : '',
        permit: rnd() > 0.6 ? 'Y' : '', referral: rnd() > 0.7 ? 'Y' : '',
        notified: hasOpc && d < -2 && rnd() > 0.3 ? 'Y' : 'N', noteUrl: '', autoClosed: '', custom: '{}',
      });
    }
  }

  const day = settings.get('committeeDay');
  const next = nextWeekday(day, today);
  const prev = nextWeekday(day, addDays(today, -7));
  for (let k = 0; k < 6; k++) {
    const p = pts[10 + k];
    const decided = k < 4;
    const c = put('committee', {
      id: id('C'), patientId: p.id, sessionDate: prev, physician: p.physician, briefHistory: pick(HIST.filter(Boolean)), question: pick(QUESTIONS.filter(Boolean)),
      plan: '', decision: decided ? 'تحويل للجراحة ثم إعادة العرض مع الباثولوجي النهائي' : k === 4 ? 'بانتظار نتيجة PET-CT' : '',
      status: decided ? 'presented' : k === 4 ? 'deferred' : 'listed', notes: '', sourceVisitId: '', carriedFromId: '', deferredToId: '', decidedAt: decided ? iso() : '', addenda: '[]',
    });
    if (decided) {
      put('followups', { id: id('F'), patientId: p.id, sourceType: 'committee', sourceId: c.id, type: 'REFERRAL', title: 'تحويل لقسم الجراحة حسب قرار اللجنة', dueDate: addDays(today, k - 2), status: k === 0 ? 'done' : 'open', outcome: k === 0 ? 'أُرسل التحويل وحُدد موعد' : '', closedAt: k === 0 ? iso() : '', attempts: '[]' });
      put('followups', { id: id('F'), patientId: p.id, sourceType: 'committee', sourceId: c.id, type: 'NOTIFY', title: 'إبلاغ المريض بقرار اللجنة', dueDate: addDays(prev, 1), status: k < 2 ? 'done' : 'open', outcome: k < 2 ? 'تم الاتصال وإبلاغه' : '', closedAt: k < 2 ? iso() : '',
        attempts: k === 3 ? JSON.stringify([{ at: iso(), result: 'NO_ANSWER', note: '' }]) : '[]' });
    }
  }
  for (let k = 0; k < 7; k++) {
    const p = pts[20 + k];
    put('committee', {
      id: id('C'), patientId: p.id, sessionDate: next, physician: k === 6 ? '' : p.physician, briefHistory: HIST[k % HIST.length], question: QUESTIONS[k % QUESTIONS.length],
      plan: '', decision: '', status: 'listed', notes: '', sourceVisitId: '', carriedFromId: '', deferredToId: '', decidedAt: '', addenda: '[]',
    });
  }
  put('followups', { id: id('F'), patientId: pts[30].id, sourceType: 'manual', sourceId: '', type: 'PERMIT', title: 'استصدار تصريح دخول لموعد العلاج الإشعاعي', dueDate: addDays(today, -1), status: 'waiting', outcome: '', closedAt: '', attempts: '[]' });
  put('followups', { id: id('F'), patientId: pts[31].id, sourceType: 'manual', sourceId: '', type: 'RESULTS', title: 'متابعة نتيجة الباثولوجي', dueDate: today, status: 'open', outcome: '', closedAt: '', attempts: '[]' });
  return db;
}
