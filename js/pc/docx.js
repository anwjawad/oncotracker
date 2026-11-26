// Real Word documents (.docx), built in the browser with no library:
// Office Open XML parts packed into an uncompressed ZIP.
// Takes the same report object as print.js (title, sections of tables, …).

const enc = new TextEncoder();
const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hasArabic = (s) => /[؀-ۿ]/.test(String(s ?? ''));

// ---------- ZIP (store, no compression) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, bytes.length, true); local.setUint32(22, bytes.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, bytes);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, bytes.length, true); cen.setUint32(24, bytes.length, true);
    cen.setUint16(28, nameBytes.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + bytes.length;
  }
  const cenSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// A table cell is a string (lines split on \n) or a list of lines: 'text' or { t, b, muted, gap }.
export const cellLines = (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((l) => (l && typeof l === 'object' ? { ...l, t: String(l.t ?? '') } : { t: String(l ?? '') }));

// ---------- WordprocessingML ----------
const TEAL = '0F766E';
const INK = '0F172A';

function run(text, { bold = false, size = 20, color = INK, italic = false } = {}) {
  const rtl = hasArabic(text);
  const lines = String(text ?? '').split('\n');
  const rPr = `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/>${bold ? '<w:b/><w:bCs/>' : ''}${italic ? '<w:i/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${rtl ? '<w:rtl/>' : ''}</w:rPr>`;
  return lines.map((l, i) => `<w:r>${rPr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(l)}</w:t></w:r>`).join('');
}

function para(content, { align = '', text = '', spacingAfter = 0, shade = '', borderLeft = '', borderBottom = '', bottomSize = 18, keepNext = false, pageBreakBefore = false } = {}) {
  const bidi = hasArabic(text);
  const pPr = [
    keepNext ? '<w:keepNext/>' : '',
    pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    borderLeft || borderBottom ? `<w:pBdr>${borderLeft ? `<w:left w:val="single" w:sz="24" w:space="6" w:color="${borderLeft}"/>` : ''}${borderBottom ? `<w:bottom w:val="single" w:sz="${bottomSize}" w:space="4" w:color="${borderBottom}"/>` : ''}</w:pBdr>` : '',
    shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '',
    bidi ? '<w:bidi/>' : '',
    `<w:spacing w:before="0" w:after="${spacingAfter}"/>`,
    align ? `<w:jc w:val="${bidi && align === 'left' ? 'right' : align}"/>` : bidi ? '<w:jc w:val="right"/>' : '',
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${content}</w:p>`;
}

function cell(inner, { width, shade = '', borders = true, vAlign = 'top' } = {}) {
  const b = borders ? '' : '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>';
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${b}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}<w:vAlign w:val="${vAlign}"/></w:tcPr>${inner}</w:tc>`;
}

function table(rows, widths, { borders = true } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const brd = borders
    ? '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="94A3B8"/><w:left w:val="single" w:sz="4" w:color="94A3B8"/><w:bottom w:val="single" w:sz="4" w:color="94A3B8"/><w:right w:val="single" w:sz="4" w:color="94A3B8"/><w:insideH w:val="single" w:sz="4" w:color="94A3B8"/><w:insideV w:val="single" w:sz="4" w:color="94A3B8"/></w:tblBorders>'
    : '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${brd}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

const tr = (cells, { header = false } = {}) => `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells}</w:tr>`;

// Splits the usable width across columns: "#" is narrow, the rest by % or evenly.
function columnWidths(columns, usable) {
  const num = 420;
  const rest = usable - num;
  const fixed = columns.map((c) => (c.width && /%$/.test(c.width) ? (parseFloat(c.width) / 100) * usable : 0));
  const used = fixed.reduce((a, b) => a + b, 0);
  const free = columns.filter((_, i) => !fixed[i]).length || 1;
  const each = Math.max(700, (rest - used) / free);
  const widths = columns.map((_, i) => Math.round(fixed[i] || each));
  const scale = rest / widths.reduce((a, b) => a + b, 0);
  return [num, ...widths.map((w) => Math.round(w * scale))];
}

function imageXML(rid, cx, cy) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/>
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
    <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>
    <pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
    <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>
    </a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// logo: { bytes: Uint8Array, width, height } (pixels) or null.
export function buildDocx(doc, { logo = null, hospital = '' } = {}) {
  const landscape = !!doc.landscape;
  const pageW = landscape ? 16838 : 11906;
  const pageH = landscape ? 11906 : 16838;
  const margin = 680;
  const usable = pageW - margin * 2;
  const body = [];

  // Header: logo | title | date
  const third = Math.round(usable * 0.28);
  const mid = usable - third * 2;
  let logoRun = '';
  if (logo) {
    const h = 52 * 9525 * 1.3;
    const w = h * (logo.width / logo.height);
    logoRun = imageXML('rIdLogo', Math.round(w), Math.round(h));
  }
  body.push(table([tr(
    cell(para(logo ? logoRun : run(hospital, { bold: true, size: 22 }), { align: 'left' }), { width: third, borders: false, vAlign: 'center' })
    + cell(para(run(String(doc.title).toUpperCase(), { bold: true, size: 30 }), { align: 'center' })
      + (doc.subtitle ? para(run(doc.subtitle, { bold: true, size: 19, color: TEAL }), { align: 'center', text: doc.subtitle }) : ''), { width: mid, borders: false, vAlign: 'center' })
    + cell(para(run(doc.when || '', { bold: true, size: 23 }), { align: 'right' }) + (doc.whenSub ? para(run(doc.whenSub, { size: 18, color: '475569' }), { align: 'right' }) : ''), { width: third, borders: false, vAlign: 'center' }),
  )], [third, mid, third], { borders: false }));
  body.push(para('', { borderBottom: TEAL, spacingAfter: 160 }));

  if (doc.summary?.length) {
    body.push(para(doc.summary.map((s) => run(`${s.value} `, { bold: true, size: 22 }) + run(`${s.label}     `, { size: 19, color: '334155' })).join(''), { spacingAfter: 120, text: doc.summary.map((s) => s.value).join(' ') }));
  }

  doc.sections.forEach((s, si) => {
    if (s.heading) {
      body.push(para(run(s.heading, { bold: true, size: 22 }) + (s.badge ? run(`   ·   ${s.badge}`, { bold: true, size: 19, color: TEAL }) : ''),
        { shade: 'F0FDFA', borderLeft: TEAL, keepNext: true, spacingAfter: 80, text: s.heading, pageBreakBefore: !!doc.pageBreaks && si > 0 }));
    } else if (doc.pageBreaks && si > 0) body.push(para('', { pageBreakBefore: true }));
    const widths = columnWidths(s.columns, usable);
    const head = tr(cell(para(run('#', { bold: true, size: 17 }), { align: 'center' }), { width: widths[0], shade: 'E2E8F0' })
      + s.columns.map((c, i) => cell(para(run(c.label.toUpperCase(), { bold: true, size: 17 }), { align: c.align === 'c' ? 'center' : 'left' }), { width: widths[i + 1], shade: 'E2E8F0' })).join(''), { header: true });
    const rows = s.rows.length
      ? s.rows.map((r, ri) => tr(cell(para(run(ri + 1, { size: 18, color: '475569' }), { align: 'center' }), { width: widths[0], shade: ri % 2 ? 'F8FAFC' : '' })
        + r.map((v, ci) => cell(cellLines(v).map((l) => para(run(l.t, { size: l.muted ? 17 : 19, bold: l.b ?? (ci === 0 && !l.muted), color: l.muted ? '475569' : INK }), { align: s.columns[ci]?.align === 'c' ? 'center' : 'left', text: l.t, spacingAfter: l.gap ? 60 : 0 })).join(''), { width: widths[ci + 1], shade: ri % 2 ? 'F8FAFC' : '' })).join('')))
      : [tr(`<w:tc><w:tcPr><w:tcW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:gridSpan w:val="${widths.length}"/></w:tcPr>${para(run(s.empty || 'No patients.', { italic: true, size: 18, color: '64748B' }), { align: 'center' })}</w:tc>`)];
    body.push(table([head, ...rows], widths));
    body.push(para('', { spacingAfter: 160 }));
  });

  if (doc.signature !== false) {
    body.push(para('', { spacingAfter: 400 }));
    body.push(table([
      tr(cell(para(run(doc.preparedBy || ' ', { bold: true, size: 21 }), { align: 'center', text: doc.preparedBy }), { width: 3400, borders: false })),
      tr(cell(para('', { borderBottom: '000000', bottomSize: 6 }), { width: 3400, borders: false })),
      tr(cell(para(run('Prepared by', { bold: true, size: 18, color: '475569' }), { align: 'center' }), { width: 3400, borders: false })),
    ], [3400], { borders: false }));
  }
  const printed = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  body.push(para(run(`Printed ${printed}${doc.preparedBy ? ` · Prepared by ${doc.preparedBy}` : ''}`, { size: 15, color: '64748B' }), { spacingAfter: 0 }));

  const sect = `<w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>`;
  const documentXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body.join('')}${sect}</w:body></w:document>`;

  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(doc.title)}</dc:title><dc:creator>${x(doc.preparedBy || 'MedSched')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ''}</Relationships>` },
    { name: 'word/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial" w:eastAsia="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-GB" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>` },
    { name: 'word/document.xml', data: documentXML },
  ];
  if (logo) files.push({ name: 'word/media/logo.png', data: logo.bytes });
  return zip(files);
}
