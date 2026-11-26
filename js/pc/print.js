// Printable reports and Word (.doc) export, sharing one layout.
import { esc, html, fmtDateEn as fmtDate, todayISO, downloadFile } from './util.js';
import { settings } from '../settings.js';
import { modal, toast } from '../ui.js';
import { icon } from './ui.js';
import { buildDocx, cellLines } from './docx.js';
import { tr } from '../i18n.js';

// Reports print in English with the hospital's header, like MedSched's.
const hospitalName = () => settings.get('hospital') || 'Augusta Victoria Hospital';

const cell = (v) => (Array.isArray(v)
  ? cellLines(v).map((l) => `<div dir="auto" class="${l.b ? 'b' : ''} ${l.muted ? 'mu' : ''} ${l.gap ? 'gap' : ''}">${esc(l.t) || '&nbsp;'}</div>`).join('')
  : esc(v ?? '').replace(/\n/g, '<br>'));

const CSS = (landscape, word) => `
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 11mm; }
  * { box-sizing: border-box; }
  body { font-family: "Plus Jakarta Sans", "Segoe UI", Calibri, Arial, sans-serif; color: #0f172a; margin: ${word ? '0.5in' : '0'}; font-size: 10.5pt; }
  .hdr { display: table; width: 100%; border-bottom: 2.5px solid #0F766E; padding-bottom: 8px; margin-bottom: 12px; }
  .hdr > div { display: table-cell; vertical-align: middle; }
  .hdr .logo img { height: 46px; }
  .hdr .org { font-size: 9pt; color: #334155; padding-left: 10px; }
  .hdr .org b { display: block; font-size: 11pt; color: #0f172a; }
  .hdr .ttl { text-align: center; }
  .hdr .ttl h1 { margin: 0; font-size: 16pt; letter-spacing: .3px; text-transform: uppercase; }
  .hdr .ttl p { margin: 2px 0 0; color: #0F766E; font-weight: 700; font-size: 9.5pt; }
  .hdr .when { text-align: right; font-size: 9pt; color: #475569; }
  .hdr .when b { display: block; font-size: 12pt; color: #0f172a; }
  .summary { margin: 0 0 10px; font-size: 9.5pt; color: #334155; }
  .summary span { display: inline-block; margin-right: 18px; }
  .summary b { font-size: 12pt; color: #0f172a; margin-right: 3px; }
  h2 { font-size: 11.5pt; margin: 16px 0 6px; padding: 5px 9px; background: #F0FDFA; border-left: 4px solid #0F766E; }
  h2 small { float: right; font-weight: 600; color: #0F766E; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #94a3b8; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #E2E8F0; font-size: 9pt; text-transform: uppercase; letter-spacing: .2px; }
  td { font-size: 9.8pt; }
  tr { page-break-inside: avoid; }
  td.n, th.n { text-align: center; width: 26px; color: #475569; }
  td.c, th.c { text-align: center; }
  td .b { font-weight: 700; }
  td .mu { color: #475569; font-size: 8.8pt; }
  td .gap { margin-bottom: 4px; }
  .muted { color: #64748b; font-style: italic; text-align: center; }
  .sig { margin-top: 36px; width: 220px; text-align: center; font-size: 9.5pt; }
  .sig .name { font-weight: 700; min-height: 18px; }
  .sig .line { border-bottom: 1px solid #000; margin: 4px 0; }
  .sig .role { color: #475569; font-weight: 600; }
  .foot { margin-top: 18px; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 5px; }
  .pb { page-break-after: always; }
`;

function sectionHTML(s) {
  const cols = s.columns;
  const body = s.rows.length
    ? s.rows.map((r, i) => `<tr><td class="n">${i + 1}</td>${r.map((v, j) => `<td class="${cols[j]?.align || ''}">${cell(v)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length + 1}" class="muted">${esc(s.empty || 'No patients.')}</td></tr>`;
  return `
    ${s.heading ? `<h2>${esc(s.heading)}${s.badge ? `<small>${esc(s.badge)}</small>` : ''}</h2>` : ''}
    <table><thead><tr><th class="n">#</th>${cols.map((c) => `<th class="${c.align || ''}"${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody></table>`;
}

function docHTML({ title, subtitle = '', when = '', whenSub = '', summary = [], sections, preparedBy = '', signature = true, landscape = false, pageBreaks = false }, { word = false, logo = '' } = {}) {
  const hospital = hospitalName();
  const printed = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const header = `
    <div class="hdr">
      <div class="logo" style="width:28%">${logo ? `<img src="${logo}" alt="${esc(hospital)}">` : `<span class="org"><b>${esc(hospital)}</b></span>`}</div>
      <div class="ttl"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      <div class="when" style="width:28%"><b>${esc(when || fmtDate(todayISO(), 'full'))}</b>${esc(whenSub)}</div>
    </div>`;
  const sum = summary.length ? `<div class="summary">${summary.map((s) => `<span><b>${esc(s.value)}</b>${esc(s.label)}</span>`).join('')}</div>` : '';
  const secs = sections.map((s, i) => sectionHTML(s) + (pageBreaks && i < sections.length - 1 && !word ? '<div class="pb"></div>' : '')).join('');
  const sig = signature ? `<div class="sig"><div class="name">${esc(preparedBy) || '&nbsp;'}</div><div class="line"></div><div class="role">Prepared by</div></div>` : '';
  return `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS(landscape, word)}</style></head>
    <body>${header}${sum}${secs}${sig}<div class="foot">Printed ${esc(printed)}${preparedBy ? ` · Prepared by ${esc(preparedBy)}` : ''}</div>
    ${word ? '' : '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>'}</body></html>`;
}

let logoCache;
async function logoImage() {
  if (logoCache !== undefined) return logoCache;
  try {
    const bytes = new Uint8Array(await (await fetch('icons/cvad-header.png')).arrayBuffer());
    const size = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = rej;
      img.src = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    });
    logoCache = { bytes, ...size };
  } catch { logoCache = null; }
  return logoCache;
}

export async function output(doc, action) {
  if (action === 'word') {
    const blob = buildDocx(doc, { logo: await logoImage(), hospital: hospitalName() });
    const name = `${doc.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')}-${doc.fileDate || todayISO()}.docx`;
    downloadFile(name, blob);
    toast(`Saved ${name}`);
    return;
  }
  const w = window.open('', '_blank');
  if (!w) { toast(tr('اسمح للمتصفح بفتح النوافذ المنبثقة لهذا الموقع حتى تعمل الطباعة.', 'Allow pop-ups for this site so the print window can open.'), { type: 'error' }); return; }
  w.document.open();
  w.document.write(docHTML(doc, { logo: new URL('icons/cvad-header.png', location.href).href }));
  w.document.close();
}

// Asks who prepared the report and whether to print or export to Word. `extra` adds options above.
export async function printDialog(build, { title, extra = '', note = '' } = {}) {
  const r = await modal({
    title: title || tr('طباعة أو تصدير', 'Print or export'),
    size: 's',
    body: html`
      ${extra}
      <label class="field"><span>${tr('أعدّه', 'Prepared by')}</span><input name="preparedBy" value="${settings.get('userName') || ''}" autocomplete="name"></label>
      <div class="field"><span>${tr('الشكل', 'Output')}</span>
        <div class="pills">
          <label class="pill"><input type="radio" name="out" value="print" checked> ${icon('print', 15)} ${tr('طباعة / PDF', 'Print / PDF')}</label>
          <label class="pill"><input type="radio" name="out" value="word"> ${icon('word', 15)} Word (.docx)</label>
        </div></div>
      ${note ? html`<p class="hint">${note}</p>` : ''}`,
    primary: tr('متابعة', 'Continue'),
  });
  if (!r) return;
  if (r.preparedBy && !settings.get('userName')) settings.set({ userName: r.preparedBy });
  const doc = await build(r);
  if (!doc) return;
  await output({ ...doc, preparedBy: r.preparedBy }, r.out === 'word' ? 'word' : 'print');
}
