// Reads a tumor board list pasted from Word or uploaded as .docx (adapted from the department's
// earlier tumor board app). Expected columns (any order, detected from the header):
// #, MRN / file number, brief history / diagnosis, responsible physician, discussion points.
// Rows become { fileNumber, age, physician, diagnosis, discussion }.

const HEADER_HINTS = ['#', 'mrn', 'file', 'history', 'physician', 'points', 'discussion', 'رقم', 'الطبيب', 'القصة'];

function detectColumns(headerCells) {
  const cols = { index: 0, mrn: 1, diagnosis: 2, physician: 3, notes: 4 };
  headerCells.forEach((t, i) => {
    if (t.includes('#') || t === 'no' || t === 'index') cols.index = i;
    else if (t.includes('mrn') || t.includes('file') || t.includes('رقم الملف')) cols.mrn = i;
    else if (t.includes('history') || t.includes('brief') || t.includes('diagnosis') || t.includes('القصة') || t.includes('التشخيص')) cols.diagnosis = i;
    else if (t.includes('physician') || t.includes('doctor') || t.includes('responsible') || t === 'dr' || t.includes('الطبيب')) cols.physician = i;
    else if (t.includes('discussion') || t.includes('points') || t.includes('notes') || t.includes('follow') || t.includes('نقاش')) cols.notes = i;
  });
  return cols;
}

const looksLikeHeader = (cells) => cells.some((c) => HEADER_HINTS.some((h) => c.includes(h)));

function ageFrom(text) {
  const m = String(text).match(/A\s*(\d+)\s*(?:y\/o|year|yr)/i) || String(text).match(/(\d{1,3})\s*(?:y\/o|years?|yrs?|y)\b/i);
  return m ? m[1] : '';
}

function rowToEntry(cells, cols, fallbackIndex) {
  const index = (cells[cols.index] || String(fallbackIndex)).replace(/\.$/, '').trim();
  if (isNaN(parseInt(index, 10))) return null;
  let fileNumber = '';
  let diagnosis = '';
  let physician = '';
  let discussion = '';
  if (cells.length > Math.max(cols.mrn, cols.diagnosis, cols.physician, cols.notes)) {
    fileNumber = cells[cols.mrn] || '';
    diagnosis = cells[cols.diagnosis] || '';
    physician = cells[cols.physician] || '';
    discussion = cells[cols.notes] || '';
  } else {
    // Column count is off: guess each cell by its content.
    cells.forEach((text, c) => {
      if (c === cols.index || !text) return;
      if (/^\d{5,9}$/.test(text)) fileNumber = text;
      else if (/^Dr\.?\s*\w+/i.test(text) || /^dr /i.test(text) || /^د\./.test(text)) physician = text;
      else if (/A\s*\d+\s*(?:y\/o|year|yr)/i.test(text) || /patient|female|male/i.test(text)) diagnosis = text;
      else discussion = discussion ? `${discussion}\n${text}` : text;
    });
  }
  if (!diagnosis) diagnosis = cells.reduce((a, b) => (b.length > a.length ? b : a), '');
  return { fileNumber: fileNumber.trim(), age: ageFrom(diagnosis), physician: physician.trim(), diagnosis: diagnosis.trim(), discussion: discussion.trim() };
}

export function parseText(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines.some((l) => l.includes('\t'))) {
    // A table copied from Word: one row per line, cells split by tabs; a cell may wrap lines.
    const rows = [];
    let cur = '';
    for (const line of lines) {
      if (/^\s*\d+\.?\t/.test(line)) { if (cur) rows.push(cur); cur = line; }
      else cur = cur ? `${cur}\n${line}` : line;
    }
    if (cur) rows.push(cur);
    const first = (rows[0] || '').split('\t').map((c) => c.trim().toLowerCase());
    const header = looksLikeHeader(first) && !/^\s*\d+\.?$/.test(first[0] || '');
    const cols = header ? detectColumns(first) : detectColumns([]);
    return rows.slice(header ? 1 : 0).map((r, i) => {
      const cells = r.split('\t').map((c) => c.trim());
      return cells.length < 2 ? null : rowToEntry(cells, cols, i + 1);
    }).filter(Boolean);
  }
  // Plain text: a number on its own line starts a patient.
  const out = [];
  let p = null;
  let afterDoctor = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(\d+)\.?$/.test(line)) { if (p) out.push(p); p = { fileNumber: '', age: '', physician: '', diagnosis: '', discussion: '' }; afterDoctor = false; continue; }
    if (!p) continue;
    if (!p.fileNumber && /^\d{5,9}$/.test(line)) { p.fileNumber = line; continue; }
    if (/^Dr\.?\s*\w+/i.test(line) || /^dr /i.test(line)) { p.physician = line; afterDoctor = true; continue; }
    if (!p.age) p.age = ageFrom(line);
    if (afterDoctor) p.discussion = p.discussion ? `${p.discussion}\n${line}` : line;
    else p.diagnosis = p.diagnosis ? `${p.diagnosis} ${line}` : line;
  }
  if (p) out.push(p);
  return out;
}

export function parseHTML(markup) {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const table = doc.querySelector('table');
  const rows = table ? [...table.querySelectorAll('tr')] : [];
  if (rows.length < 2) return parseText(doc.body.innerText || doc.body.textContent || '');
  const cellText = (td) => {
    const d = document.createElement('div');
    d.innerHTML = td.innerHTML.replace(/<\/p>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/&nbsp;/g, ' ');
    return (d.textContent || '').trim();
  };
  const first = [...rows[0].querySelectorAll('td, th')].map((c) => c.textContent.trim().toLowerCase());
  const header = looksLikeHeader(first) && !/^\d+\.?$/.test(first[0] || '');
  const cols = header ? detectColumns(first) : detectColumns([]);
  const out = rows.slice(header ? 1 : 0).map((tr, i) => {
    const cells = [...tr.querySelectorAll('td')].map(cellText);
    return cells.length < 2 ? null : rowToEntry(cells, cols, i + 1);
  }).filter(Boolean);
  return out.length ? out : parseText(doc.body.textContent || '');
}

let mammothPromise = null;
export function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  mammothPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    s.onload = () => resolve(window.mammoth);
    s.onerror = () => { mammothPromise = null; reject(new Error('Could not load the Word reader. Check the internet connection.')); };
    document.head.append(s);
  });
  return mammothPromise;
}
