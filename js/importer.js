// Excel import with a review step: editable column mapping, matching every row to
// an existing patient by file number, and explicit handling of conflicts — so a
// bad sheet can't silently create duplicate or truncated patient records.
import { html, esc, loadXLSX, readFileAs, normMrn, normName, cleanName, cleanPhysician, wordCount, latinDigits, todayISO, isISODate, fmtDate, uniq, byText } from './util.js';
import { idx, create, upsert, batch, note } from './store.js';
import { fixPhone } from './rules.js';
import { modal, toast } from './ui.js';
import { tr } from './i18n.js';

const FIELDS = {
  name: { l: () => tr('اسم المريض', 'Patient name'), k: ['patient name', 'patient', 'name', 'اسم المريض', 'الاسم', 'اسم', 'المريض'] },
  mrn: { l: () => tr('رقم الملف', 'File number'), k: ['mrn', 'file', 'fn', 'code', 'id', 'رقم الملف', 'الملف', 'كود', 'رقم'] },
  age: { l: () => tr('العمر', 'Age'), k: ['age', 'العمر', 'عمر'] },
  phone: { l: () => tr('الهاتف', 'Phone'), k: ['phone', 'mobile', 'tel', 'هاتف', 'جوال', 'موبايل'] },
  physician: { l: () => tr('الطبيب', 'Doctor'), k: ['provider', 'physician', 'doctor', 'consultant', 'طبيب', 'دكتور'] },
  plan: { l: () => tr('خطة العلاج', 'Treatment plan'), k: ['plan', 'treatment', 'خطة', 'الخطة'] },
  opcDate: { l: () => tr('موعد العيادة', 'Clinic appointment'), k: ['opc', 'appointment', 'next visit', 'موعد'] },
  history: { l: () => tr('القصة المرضية', 'Brief history'), k: ['history', 'brief', 'قصة', 'تاريخ مرضي'] },
  question: { l: () => tr('السؤال / الخطة المقترحة', 'Question / proposed plan'), k: ['question', 'plan', 'سؤال', 'خطة'] },
  notes: { l: () => tr('ملاحظات', 'Notes'), k: ['note', 'remark', 'ملاحظ'] },
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

const STATUS_LABEL = () => ({
  match: ['green', tr('مريض موجود', 'Existing patient')],
  upgrade: ['blue', tr('موجود — سيُكمَّل اسمه', 'Existing — name will be completed')],
  'name-match': ['amber', tr('مطابق بالاسم فقط', 'Matched by name only')],
  conflict: ['red', tr('نفس الرقم باسم مختلف', 'Same number, different name')],
  new: ['', tr('مريض جديد', 'New patient')],
  'new-nomrn': ['amber', tr('جديد بدون رقم ملف', 'New, no file number')],
  exists: ['', tr('موجود في القائمة — سيُتخطّى', 'Already on the list — skipped')],
  dup: ['', tr('مكرر في الملف — سيُتخطّى', 'Repeated in file — skipped')],
  excluded: ['', tr('طبيب مستثنى', 'Doctor excluded')],
});

export async function openImport(target = 'clinic', date = todayISO()) {
  let XLSX;
  try { XLSX = await loadXLSX(); } catch (e) { toast(e.message, { type: 'error' }); return; }
  pickFile = null;

  const pick = await modal({
    title: tr('استيراد من Excel', 'Import from Excel'),
    body: html`
      <div class="grid-2">
        <label class="field"><span>${tr('الوجهة', 'Import into')}</span><select name="target">
          <option value="clinic" ${target === 'clinic' ? 'selected' : ''}>${tr('حجوزات ما بعد العيادة', 'Post-clinic bookings')}</option>
          <option value="committee" ${target === 'committee' ? 'selected' : ''}>${tr('لجنة الحالات الجديدة', 'New cases committee')}</option></select></label>
        <label class="field"><span>${tr('تاريخ الجلسة', 'Session date')}</span><input type="date" name="date" value="${date}"></label>
      </div>
      <label class="field"><span>${tr('الملف', 'File')}</span><input type="file" name="file" accept=".xlsx,.xls,.csv" class="input"></label>`,
    primary: tr('التالي', 'Next'),
    onMount: (dlg) => {
      const f = dlg.querySelector('[name=file]');
      f.addEventListener('change', () => { pickFile = f.files[0] || null; });
    },
    validate: (d) => (!pickFile ? tr('اختر ملف Excel.', 'Choose an Excel file.') : !d.date ? tr('اختر تاريخ الجلسة.', 'Choose the session date.') : null),
  });
  const file = pickFile; pickFile = null;
  if (!pick || !file) return;

  let rows;
  try {
    const wb = XLSX.read(await readFileAs(file), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  } catch (e) {
    toast(tr('تعذّرت قراءة الملف: ', 'Could not read the file: ') + e.message, { type: 'error' }); return;
  }
  if (!rows.length) { toast(tr('الملف فارغ.', 'The file is empty.'), { type: 'error' }); return; }
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
      if (excluded.has(row.physician || '-')) return { ...row, status: 'excluded' };
      const c = classify(row, { byMrn, byName });
      if (c.patient && existingIn.has(c.patient.id)) return { ...row, status: 'exists', patient: c.patient };
      return { ...row, ...c };
    }).filter(Boolean);
  };

  const doctorsOf = (list) => {
    const m = new Map();
    for (const r of list) { const d = r.physician || '-'; m.set(d, (m.get(d) || 0) + 1); }
    return [...m].sort((a, b) => byText(a[0], b[0]));
  };

  const mappingHTML = () => fields.map((f) => html`
    <label class="field"><span>${FIELDS[f].l()}${f === 'name' ? ' *' : ''}</span>
      <select data-map="${f}"><option value="">${tr('— لا يوجد —', '— none —')}</option>${header.map((h, i) => html`<option value="${i}" ${mapping[f] === i ? 'selected' : ''}>${h || `${tr('عمود', 'Column')} ${i + 1}`}</option>`)}</select></label>`);

  const previewHTML = (list, conflictPolicy) => {
    const labels = STATUS_LABEL();
    const count = (s) => list.filter((r) => r.status === s).length;
    const willImport = list.filter((r) => !['exists', 'dup', 'excluded'].includes(r.status) && !(r.status === 'conflict' && conflictPolicy === 'skip')).length;
    return String(html`
      <div class="row small">
        <span class="chip accent">${tr('سيُستورد', 'Will import')} ${willImport}</span>
        ${Object.entries(labels).filter(([s]) => count(s)).map(([s, [c, l]]) => html`<span class="chip ${c}">${l}: ${count(s)}</span>`)}
      </div>
      ${count('conflict') ? html`<p class="warn-text">${tr(`يوجد ${count('conflict')} صف رقم ملفه مسجّل لمريض باسم مختلف. راجعها في الجدول؛ اختر أدناه كيف تُعامَل.`, `${count('conflict')} rows have a file number that belongs to a patient with a different name. Review them in the table and choose below how to handle them.`)}</p>` : ''}
      <div class="preview"><table class="data">
        <thead><tr><th>${tr('الحالة', 'Status')}</th><th>${tr('الاسم في الملف', 'Name in file')}</th><th>${tr('رقم الملف', 'File no.')}</th><th>${tr('الطبيب', 'Doctor')}</th><th>${tr('الهاتف', 'Phone')}</th><th>${tr('في النظام', 'In the system')}</th></tr></thead>
        <tbody>${list.slice(0, 150).map((r) => { const [c, l] = labels[r.status]; return html`
          <tr><td><span class="chip ${c}">${l}</span></td><td>${r.name}${wordCount(r.name) < 3 ? html` <span class="chip outline">${tr('اسم مختصر', 'short name')}</span>` : ''}</td>
          <td class="ltr">${r.mrn || '—'}</td><td>${r.physician || '—'}</td><td class="ltr">${r.phone || '—'}</td>
          <td class="small">${r.patient ? html`${r.patient.name} <span class="mrn">${r.patient.mrn}</span>` : ''}</td></tr>`; })}</tbody>
      </table></div>
      ${list.length > 150 ? html`<p class="small muted">${tr(`يُعرض أول 150 صفاً من ${list.length}.`, `Showing the first 150 of ${list.length} rows.`)}</p>` : ''}`);
  };

  let current = build();
  const data = await modal({
    title: `${tr('مراجعة الاستيراد', 'Review import')} — ${target === 'clinic' ? tr('حجوزات العيادة', 'Post-clinic') : tr('لجنة الحالات', 'Committee')} ${fmtDate(date, 'med')}`,
    size: 'xl',
    primary: tr('استيراد', 'Import'),
    body: html`
      <p class="small muted">${tr('الملف', 'File')}: ${fileName} — ${tr('صف العناوين رقم', 'header row')} ${headerIdx + 1}. ${tr('تأكّد من ربط الأعمدة؛ تتحدّث المعاينة فوراً.', 'Check the column matching; the preview updates as you change it.')}</p>
      <div class="grid-3" data-mapping>${mappingHTML()}</div>
      <div class="field"><span class="field-label">${tr('الأطباء في الملف (أزل العلامة لاستثناء طبيب)', 'Doctors in the file (untick to exclude)')}</span><div class="row" data-docs></div></div>
      <div class="grid-2">
        <label class="check"><input type="checkbox" name="fillMissing" checked> ${tr('إكمال الهاتف والعمر الناقصين في ملفات المرضى الموجودين', 'Fill missing phone and age on existing patients')}</label>
        <label class="check"><input type="checkbox" name="upgradeNames" checked> ${tr('استبدال الأسماء المختصرة بالاسم الكامل من الملف', 'Replace shortened names with the full name from the file')}</label>
        <label class="field span-2"><span>${tr('صفوف «نفس الرقم باسم مختلف»', 'Rows with the same number but a different name')}</span><select name="conflict">
          <option value="skip">${tr('تخطّيها لمراجعتها يدوياً (موصى به)', 'Skip them for manual review (recommended)')}</option>
          <option value="link">${tr('ربطها بالمريض الموجود وإبقاء اسمه', 'Link to the existing patient, keep their name')}</option>
          <option value="rename">${tr('ربطها بالمريض الموجود وتغيير اسمه لاسم الملف', 'Link to the existing patient, use the name from the file')}</option></select></label>
      </div>
      <div data-preview></div>`,
    onMount: (dlg) => {
      const docsBox = dlg.querySelector('[data-docs]');
      const prev = dlg.querySelector('[data-preview]');
      const excluded = new Set();
      const renderDocs = () => {
        docsBox.innerHTML = doctorsOf(build()).map(([d, n]) => `<label class="check chip outline" style="padding:4px 10px"><input type="checkbox" data-doc="${esc(d)}" ${excluded.has(d) ? '' : 'checked'}> ${esc(d === '-' ? tr('بدون طبيب', 'No doctor') : d)} (${n})</label>`).join('');
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
    validate: () => (mapping.name === undefined ? tr('اربط عمود «اسم المريض» أولاً.', 'Match the patient name column first.') : !current.some((r) => !['exists', 'dup', 'excluded'].includes(r.status)) ? tr('لا توجد صفوف جديدة للاستيراد.', 'There are no new rows to import.') : null),
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
        if (Object.keys(patch).length) upsert('patients', { id: pid, ...patch }, { summary: `${tr('من ملف الاستيراد', 'From import file')} ${opts.fileName}` });
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
    note(tr(`استيراد ${opts.fileName} إلى ${opts.target === 'clinic' ? 'حجوزات العيادة' : 'لجنة الحالات'} ${opts.date}: ${records} سجل، ${created} مريض جديد، ${linked} مريض موجود، ${skipped} متخطّى`, `Imported ${opts.fileName} into ${opts.target === 'clinic' ? 'post-clinic' : 'committee'} ${opts.date}: ${records} records, ${created} new patients, ${linked} existing, ${skipped} skipped`));
  });
  toast(tr(`استُورد ${records} سجل (${created} مريض جديد، ${linked} موجود)${skipped ? `، وتُخطّي ${skipped}` : ''}`, `Imported ${records} records (${created} new patients, ${linked} existing)${skipped ? `, ${skipped} skipped` : ''}`));
}
