// Excel import with a review step: editable column mapping, matching every row to
// an existing patient by file number, and explicit handling of conflicts — so a
// bad sheet can't silently create duplicate or truncated patient records.
import { html, esc, loadXLSX, readFileAs, normMrn, normName, cleanName, cleanPhysician, wordCount, latinDigits, todayISO, isISODate, fmtDate, uniq, byText } from './util.js';
import { idx, create, upsert, batch, note } from './store.js';
import { fixPhone } from './rules.js';
import { modal, toast } from './ui.js';

const FIELDS = {
  name: { l: 'اسم المريض', k: ['patient name', 'patient', 'name', 'اسم المريض', 'الاسم', 'اسم', 'المريض'] },
  mrn: { l: 'رقم الملف', k: ['mrn', 'file', 'fn', 'code', 'id', 'رقم الملف', 'الملف', 'كود', 'رقم'] },
  age: { l: 'العمر', k: ['age', 'العمر', 'عمر'] },
  phone: { l: 'الهاتف', k: ['phone', 'mobile', 'tel', 'هاتف', 'جوال', 'موبايل'] },
  physician: { l: 'الطبيب', k: ['provider', 'physician', 'doctor', 'consultant', 'طبيب', 'دكتور'] },
  plan: { l: 'خطة العلاج', k: ['plan', 'treatment', 'خطة', 'الخطة'] },
  opcDate: { l: 'موعد العيادة', k: ['opc', 'appointment', 'next visit', 'موعد'] },
  history: { l: 'القصة المرضية', k: ['history', 'brief', 'قصة', 'تاريخ مرضي'] },
  question: { l: 'السؤال / الخطة المقترحة', k: ['question', 'plan', 'سؤال', 'خطة'] },
  notes: { l: 'ملاحظات', k: ['note', 'remark', 'ملاحظ'] },
};
const TARGET_FIELDS = {
  clinic: ['name', 'mrn', 'age', 'phone', 'physician', 'plan', 'opcDate'],
  committee: ['name', 'mrn', 'age', 'phone', 'physician', 'history', 'question', 'notes'],
};
// Specific fields claim a header before generic ones ("provider name" → physician, not name).
const PRIORITY = ['phone', 'age', 'physician', 'opcDate', 'history', 'question', 'plan', 'notes', 'mrn', 'name'];

const norm = (s) => latinDigits(s).toLowerCase().replace(/[_\-.:]/g, ' ').replace(/\s+/g, ' ').trim();

function guessMapping(header, target) {
  const fields = PRIORITY.filter((f) => TARGET_FIELDS[target].includes(f));
  const map = {};
  header.forEach((h, col) => {
    const n = norm(h);
    if (!n) return;
    for (const f of fields) {
      if (f in map) continue;
      if (FIELDS[f].k.some((k) => n === k || n.includes(k))) { map[f] = col; break; }
    }
  });
  return map;
}

function findHeaderRow(rows) {
  let best = { i: -1, score: 0 };
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const score = (rows[i] || []).filter((c) => { const n = norm(c); return n && Object.values(FIELDS).some((f) => f.k.some((k) => n.includes(k))); }).length;
    if (score > best.score) best = { i, score };
  }
  return best.score >= 1 ? best.i : 0;
}

const pad = (n) => String(n).padStart(2, '0');
function cellDate(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = latinDigits(v).trim();
  if (isISODate(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);   // d/m/y
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  return '';
}
const cellText = (v) => (v instanceof Date ? cellDate(v) : String(v ?? '').trim());

// Patient-level decision for one row.
function classify(row, ctx) {
  const { byMrn, byName } = ctx;
  if (row.mrn) {
    const p = byMrn.get(row.mrn)?.[0];
    if (p) {
      const a = normName(p.name); const b = normName(row.name);
      if (a === b) return { status: 'match', patient: p };
      const aw = a.split(' '); const bw = b.split(' ');
      const subset = (x, y) => x.every((w) => y.includes(w));
      if (subset(aw, bw) && bw.length > aw.length) return { status: 'upgrade', patient: p };       // stored name was truncated
      if (subset(bw, aw)) return { status: 'match', patient: p };                                   // file has the short version
      return { status: 'conflict', patient: p };
    }
    return { status: 'new' };
  }
  const p = byName.get(normName(row.name));
  return p ? { status: 'name-match', patient: p } : { status: 'new-nomrn' };
}

const STATUS_LABEL = {
  match: ['green', 'مريض موجود'],
  upgrade: ['blue', 'موجود — سيُكمَّل اسمه'],
  'name-match': ['amber', 'مطابق بالاسم فقط'],
  conflict: ['red', 'نفس الرقم باسم مختلف'],
  new: ['', 'مريض جديد'],
  'new-nomrn': ['amber', 'جديد بدون رقم ملف'],
  exists: ['', 'موجود في القائمة — سيُتخطّى'],
  dup: ['', 'مكرر في الملف — سيُتخطّى'],
  excluded: ['', 'طبيب مستثنى'],
};

export async function openImport(target = 'clinic', date = todayISO()) {
  let XLSX;
  try { XLSX = await loadXLSX(); } catch (e) { toast(e.message, { type: 'error' }); return; }
  pickFile = null;

  const pick = await modal({
    title: 'استيراد من Excel',
    body: html`
      <div class="grid-2">
        <label class="field"><span>الوجهة</span><select name="target">
          <option value="clinic" ${target === 'clinic' ? 'selected' : ''}>حجوزات ما بعد العيادة</option>
          <option value="committee" ${target === 'committee' ? 'selected' : ''}>لجنة الحالات الجديدة</option></select></label>
        <label class="field"><span>تاريخ الجلسة</span><input type="date" name="date" value="${date}"></label>
      </div>
      <label class="field"><span>الملف</span><input type="file" name="file" accept=".xlsx,.xls,.csv" class="input"></label>`,
    primary: 'التالي',
    onMount: (dlg) => {
      const f = dlg.querySelector('[name=file]');
      f.addEventListener('change', () => { pickFile = f.files[0] || null; });
    },
    validate: (d) => (!pickFile ? 'اختر ملف Excel.' : !d.date ? 'اختر تاريخ الجلسة.' : null),
  });
  const file = pickFile; pickFile = null;
  if (!pick || !file) return;

  let rows;
  try {
    const wb = XLSX.read(await readFileAs(file), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  } catch (e) {
    toast('تعذّرت قراءة الملف: ' + e.message, { type: 'error' }); return;
  }
  if (!rows.length) { toast('الملف فارغ.', { type: 'error' }); return; }
  await reviewStep({ rows, target: pick.target, date: pick.date, fileName: file.name });
}
let pickFile = null;

async function reviewStep({ rows, target, date, fileName }) {
  const headerIdx = findHeaderRow(rows);
  const header = rows[headerIdx].map(cellText);
  const body = rows.slice(headerIdx + 1).filter((r) => r.some((c) => String(c).trim()));
  let mapping = guessMapping(header, target);
  const fields = TARGET_FIELDS[target];
  const { lists, byMrn } = idx();
  const byName = new Map(lists.patients.map((p) => [normName(p.name), p]));
  const existingIn = new Set((target === 'clinic' ? lists.visits : lists.committee).filter((r) => r.sessionDate === date).map((r) => r.patientId));

  const build = (excluded = new Set()) => {
    const seen = new Set();
    return body.map((r) => {
      const get = (f) => (mapping[f] === undefined ? '' : cellText(r[mapping[f]]));
      const row = {
        name: cleanName(get('name')),
        mrn: normMrn(get('mrn')),
        age: (latinDigits(get('age')).match(/\d+/) || [''])[0],
        phone: get('phone') ? fixPhone(get('phone')) : '',
        physician: cleanPhysician(get('physician')),
        plan: get('plan'), history: get('history'), question: get('question'), notes: get('notes'),
        opcDate: mapping.opcDate !== undefined ? cellDate(r[mapping.opcDate]) : '',
      };
      if (!row.name) return null;
      const key = row.mrn || normName(row.name);
      if (seen.has(key)) return { ...row, status: 'dup' };
      seen.add(key);
      if (excluded.has(row.physician || 'بدون طبيب')) return { ...row, status: 'excluded' };
      const c = classify(row, { byMrn, byName });
      if (c.patient && existingIn.has(c.patient.id)) return { ...row, status: 'exists', patient: c.patient };
      return { ...row, ...c };
    }).filter(Boolean);
  };

  const doctorsOf = (list) => {
    const m = new Map();
    for (const r of list) { const d = r.physician || 'بدون طبيب'; m.set(d, (m.get(d) || 0) + 1); }
    return [...m].sort((a, b) => byText(a[0], b[0]));
  };

  const mappingHTML = () => fields.map((f) => html`
    <label class="field"><span>${FIELDS[f].l}${f === 'name' ? ' *' : ''}</span>
      <select data-map="${f}"><option value="">— لا يوجد —</option>${header.map((h, i) => html`<option value="${i}" ${mapping[f] === i ? 'selected' : ''}>${h || `عمود ${i + 1}`}</option>`)}</select></label>`);

  const previewHTML = (list, conflictPolicy) => {
    const count = (s) => list.filter((r) => r.status === s).length;
    const willImport = list.filter((r) => !['exists', 'dup', 'excluded'].includes(r.status) && !(r.status === 'conflict' && conflictPolicy === 'skip')).length;
    return String(html`
      <div class="row small">
        <span class="chip accent">سيُستورد ${willImport}</span>
        ${Object.entries(STATUS_LABEL).filter(([s]) => count(s)).map(([s, [c, l]]) => html`<span class="chip ${c}">${l}: ${count(s)}</span>`)}
      </div>
      ${count('conflict') ? html`<p class="warn-text">يوجد ${count('conflict')} صف رقم ملفه مسجّل لمريض باسم مختلف. راجعها في الجدول؛ اختر أدناه كيف تُعامَل.</p>` : ''}
      <div class="preview"><table class="data">
        <thead><tr><th>الحالة</th><th>الاسم في الملف</th><th>رقم الملف</th><th>الطبيب</th><th>الهاتف</th><th>في النظام</th></tr></thead>
        <tbody>${list.slice(0, 150).map((r) => { const [c, l] = STATUS_LABEL[r.status]; return html`
          <tr><td><span class="chip ${c}">${l}</span></td><td>${r.name}${wordCount(r.name) < 3 ? html` <span class="chip outline">اسم مختصر</span>` : ''}</td>
          <td class="ltr">${r.mrn || '—'}</td><td>${r.physician || '—'}</td><td class="ltr">${r.phone || '—'}</td>
          <td class="small">${r.patient ? html`${r.patient.name} <span class="mrn">${r.patient.mrn}</span>` : ''}</td></tr>`; })}</tbody>
      </table></div>
      ${list.length > 150 ? html`<p class="small muted">يُعرض أول 150 صفاً من ${list.length}.</p>` : ''}`);
  };

  let current = build();
  const data = await modal({
    title: `مراجعة الاستيراد — ${target === 'clinic' ? 'حجوزات العيادة' : 'لجنة الحالات'} ${fmtDate(date, 'med')}`,
    size: 'xl',
    primary: 'استيراد',
    body: html`
      <p class="small muted">الملف: ${fileName} — صف العناوين رقم ${headerIdx + 1}. تأكّد من ربط الأعمدة؛ تتحدّث المعاينة فوراً.</p>
      <div class="grid-3" data-mapping>${mappingHTML()}</div>
      <div class="field"><span class="field-label">الأطباء في الملف (أزل العلامة لاستثناء طبيب)</span><div class="row" data-docs></div></div>
      <div class="grid-2">
        <label class="check"><input type="checkbox" name="fillMissing" checked> إكمال الهاتف والعمر الناقصين في ملفات المرضى الموجودين</label>
        <label class="check"><input type="checkbox" name="upgradeNames" checked> استبدال الأسماء المختصرة بالاسم الكامل من الملف</label>
        <label class="field span-2"><span>صفوف «نفس الرقم باسم مختلف»</span><select name="conflict">
          <option value="skip">تخطّيها لمراجعتها يدوياً (موصى به)</option>
          <option value="link">ربطها بالمريض الموجود وإبقاء اسمه</option>
          <option value="rename">ربطها بالمريض الموجود وتغيير اسمه لاسم الملف</option></select></label>
      </div>
      <div data-preview></div>`,
    onMount: (dlg) => {
      const docsBox = dlg.querySelector('[data-docs]');
      const prev = dlg.querySelector('[data-preview]');
      const excluded = new Set();
      const renderDocs = () => {
        docsBox.innerHTML = doctorsOf(build()).map(([d, n]) => `<label class="check chip outline" style="padding:4px 10px"><input type="checkbox" data-doc="${esc(d)}" ${excluded.has(d) ? '' : 'checked'}> ${esc(d)} (${n})</label>`).join('');
      };
      const refresh = () => { current = build(excluded); prev.innerHTML = previewHTML(current, dlg.querySelector('[name=conflict]').value); };
      dlg.querySelector('[name=conflict]').addEventListener('change', refresh);
      dlg.querySelector('[data-mapping]').addEventListener('change', (e) => {
        const f = e.target.dataset.map; if (!f) return;
        if (e.target.value === '') delete mapping[f]; else mapping[f] = Number(e.target.value);
        renderDocs(); refresh();
      });
      docsBox.addEventListener('change', (e) => { const d = e.target.dataset.doc; if (d === undefined) return; e.target.checked ? excluded.delete(d) : excluded.add(d); refresh(); });
      renderDocs(); refresh();
    },
    validate: () => (mapping.name === undefined ? 'اربط عمود «اسم المريض» أولاً.' : !current.some((r) => !['exists', 'dup', 'excluded'].includes(r.status)) ? 'لا توجد صفوف جديدة للاستيراد.' : null),
  });
  if (!data) return;
  apply(current, { target, date, fileName, ...data });
}

function apply(list, opts) {
  let created = 0; let linked = 0; let records = 0; let skipped = 0;
  batch(() => {
    for (const r of list) {
      if (['exists', 'dup', 'excluded'].includes(r.status)) { skipped++; continue; }
      if (r.status === 'conflict' && opts.conflict === 'skip') { skipped++; continue; }
      let pid;
      if (r.patient) {
        pid = r.patient.id; linked++;
        const patch = {};
        if (opts.fillMissing && r.phone && !r.patient.phone) patch.phone = r.phone;
        if (opts.fillMissing && r.age && !r.patient.age) patch.age = r.age;
        if ((r.status === 'upgrade' && opts.upgradeNames) || (r.status === 'conflict' && opts.conflict === 'rename')) patch.name = r.name;
        if (r.physician && !r.patient.physician) patch.physician = r.physician;
        if (Object.keys(patch).length) upsert('patients', { id: pid, ...patch }, { summary: `من ملف الاستيراد ${opts.fileName}` });
      } else {
        pid = create('patients', { name: r.name, mrn: r.mrn, phone: r.phone, age: r.age, physician: r.physician }, false).id; created++;
      }
      if (opts.target === 'clinic') {
        create('visits', { patientId: pid, sessionDate: opts.date, physician: r.physician, plan: r.plan, opcDate: r.opcDate, permit: '', referral: '', notified: 'N', noteUrl: '', autoClosed: '' }, false);
      } else {
        create('committee', { patientId: pid, sessionDate: opts.date, physician: r.physician, briefHistory: r.history, question: r.question, plan: '', decision: '', status: 'listed', notes: r.notes, sourceVisitId: '', carriedFromId: '', deferredToId: '', decidedAt: '' }, false);
      }
      records++;
    }
    note(`استيراد ${opts.fileName} إلى ${opts.target === 'clinic' ? 'حجوزات العيادة' : 'لجنة الحالات'} ${opts.date}: ${records} سجل، ${created} مريض جديد، ${linked} مريض موجود، ${skipped} متخطّى`);
  });
  toast(`استُورد ${records} سجل (${created} مريض جديد، ${linked} موجود)${skipped ? `، وتُخطّي ${skipped}` : ''}`);
}
