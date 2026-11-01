// Printable lists: committee agenda and minutes, clinic lists, follow-up lists.
import { esc, fmtDate, todayISO } from './util.js';
import { settings } from './settings.js';
import { toast } from './ui.js';

const cell = (v) => esc(v ?? '').replace(/\n/g, '<br>');

// columns: [{ label, width? }]; rows: arrays of plain strings (escaped here).
export function printTable({ title, subtitle = '', columns, rows, landscape = true, footer = '' }) {
  const s = settings.all();
  const head = `
    <header>
      <div class="org">
        ${s.logo ? `<img src="${esc(s.logo)}" alt="">` : ''}
        <div>${s.hospital ? `<strong>${esc(s.hospital)}</strong>` : ''}${s.department ? `<span>${esc(s.department)}</span>` : ''}</div>
      </div>
      <div class="ttl"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      <div class="date">طُبع ${esc(fmtDate(todayISO(), 'long'))}</div>
    </header>`;
  const doc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title>
    <style>
      @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
      body { font-family: "IBM Plex Sans Arabic", Tahoma, sans-serif; color: #111; margin: 0; font-size: 12px; }
      header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; border-bottom: 2px solid #1C2541; padding-bottom: 8px; margin-bottom: 10px; }
      .org { display: flex; gap: 10px; align-items: center; } .org img { max-height: 54px; max-width: 150px; }
      .org strong { display: block; font-size: 14px; } .org span { color: #444; }
      .ttl { text-align: center; } .ttl h1 { margin: 0; font-size: 17px; } .ttl p { margin: 2px 0 0; color: #444; }
      .date { text-align: left; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #555; padding: 6px 7px; text-align: right; vertical-align: top; }
      th { background: #ECEDF3; font-size: 11.5px; }
      tr { page-break-inside: avoid; }
      td.n { text-align: center; color: #555; width: 22px; }
      footer { margin-top: 14px; color: #444; }
    </style></head><body>
    ${head}
    <table><thead><tr><th>#</th>${columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="n">${i + 1}</td>${r.map((v) => `<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${footer ? `<footer>${cell(footer)}</footer>` : ''}
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };<\/script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('اسمح للمتصفح بفتح النوافذ المنبثقة لهذا الموقع حتى تعمل الطباعة.', { type: 'error' }); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
}
