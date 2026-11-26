// CVAD insertion coordination checklist: a copy of the hospital form
// ("CVAD insertion coordination checklist-final.docx"), one page per patient,
// filled with the patient's details and every item ticked "Yes".
import { esc, html, fmtDateEn as fmtDate, todayISO } from './util.js';
import { settings } from '../settings.js';
import { modal, toast } from '../ui.js';
import { icon } from './ui.js';
import { tr } from '../i18n.js';

export const DEFAULT_COORDINATOR = 'Jawad A. Sabha';

// [section, shading] or [number, text with **bold** parts], as in the form.
const ROWS = [
  ['A. Coordination and Referral', '#E2EFD9'],
  [1, 'A documented medical **indication for CVAD insertion**, including the need for long-term central venous access, is available.'],
  [2, 'The case has been **communicated** to the involved professionals **via email for review and approval by** appropriate specialist (surgeon/interventional radiologist).'],
  [3, 'The **procedure date, time**, and location have been confirmed, and the patient/legal guardian has received an appointment and preparation instructions.'],
  ['B. Coordination of Fitness and communication to responsible physician', '#FFF2CC'],
  [4, '**Ensure that Complete blood count (CBC),** was done (one to two days before the procedure)'],
  [5, 'Check if the patient has active infection or **fever.**'],
  [6, '**Fasting** requirements have been confirmed according to the approved recommendations.'],
  ['C. Patient and Family Education and Preparation', '#DEEAF6'],
  [7, 'The **procedure has been explained** to the patient and/or legal guardian including potential risks and complications.'],
  [8, 'Instructions regarding **fasting**, and **shower** have been provided.'],
  [9, 'The **patient and/or family have received written instructions** regarding CVAD care indication, maintenance, and warning signs requiring medical attention.'],
  [10, '**Arrival time, required documents**, and other practical instructions have been communicated.'],
  [11, 'The patient\'s and/or family\'s **questions and concerns** have been addressed.'],
];

const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const box = (on) => `<span class="bx${on ? ' on' : ''}">${on ? '&#10003;' : ''}</span>`;

// Column widths of the form's table, in twips (total 10768 = 190 mm).
const W = [419, 7607, 485, 456, 547, 1254].map((w) => `${(w / 10768 * 100).toFixed(2)}%`);

const CSS = `
  @page { size: A4 portrait; margin: 6.5mm 10mm 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10pt; color: #000; line-height: 1.2;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { page-break-after: always; break-after: page; padding: 0 9.5mm; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .logo { height: 15.7mm; display: block; margin-bottom: 5mm; }
  h1 { font-size: 12pt; font-weight: 700; text-align: center; margin: 0 0 12pt; }
  .purpose { font-weight: 700; text-align: center; margin: 0 0 10pt; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 0 5.4pt; vertical-align: top; font-size: 10pt; }
  .info { width: 171.7mm; margin-bottom: 10pt; }
  .info td { width: 50%; }
  .info td.open { border-top: none; border-right: none; }
  .info .v { font-weight: 400; }
  .crit { width: 190mm; margin-left: -9.5mm; table-layout: fixed; }
  .crit th { font-weight: 700; text-align: left; }
  .crit th.c, .crit td.c { text-align: center; }
  .crit td.n { font-weight: 700; }
  .crit tr.sec td { font-weight: 700; }
  .crit tr { page-break-inside: avoid; }
  .bx { display: inline-block; width: 9pt; height: 9pt; border: 1.8px solid #000; margin-top: 2pt;
        font-size: 9pt; line-height: 7pt; font-weight: 700; text-align: center; vertical-align: top; }
  .sign { margin-top: 18pt; font-weight: 700; }
  .sign p { margin: 0 0 14pt; }
  .sign .val { font-weight: 700; text-decoration: underline; }
  .sign .stamp-row { display: flex; align-items: center; margin: -2mm 0 8pt; }
  .sign .stamp { height: 13mm; margin-left: 2mm; }
`;

function patientPage(p, coordinator, logo, stamp) {
  const rows = ROWS.map(([a, b]) => (typeof a === 'string'
    ? `<tr class="sec"><td colspan="2" style="background:${b}">${esc(a)}</td>${'<td></td>'.repeat(4).replace(/<td>/g, `<td style="background:${b}">`)}</tr>`
    : `<tr><td class="n">${a}</td><td>${bold(b)}</td><td class="c">${box(true)}</td><td class="c">${box(false)}</td><td class="c">${box(false)}</td><td></td></tr>`)).join('');
  const field = (label, value) => `<b>${label}</b> <span class="v">${esc(value || '')}</span>`;
  return `
    <section class="page">
      <img class="logo" src="${logo}" alt="Augusta Victoria Hospital · The Lutheran World Federation">
      <h1>Coordination and Preoperative Readiness for Central Venous Access Device (CVAD) Insertion</h1>
      <p class="purpose">Purpose: To assess and document the patient's readiness before undergoing an implanted CVAD insertion procedure.</p>
      <table class="info">
        <tr><td>${field('Patient Name:', p.name)}</td><td class="open"></td></tr>
        <tr><td>${field('File Number:', p.fileNumber)}</td><td>${field('Diagnosis:', p.diagnosis)}</td></tr>
        <tr><td>${field('Date:', p.date ? fmtDate(p.date, 'full') : '')}</td><td>${field('Patient Mobile Number:', p.phone)}</td></tr>
      </table>
      <table class="crit">
        <colgroup>${W.map((w) => `<col style="width:${w}">`).join('')}</colgroup>
        <thead><tr><th>#</th><th>Assessment criteria</th><th class="c">Yes</th><th class="c">No</th><th class="c">N/A</th><th class="c">Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sign">
        <p>Case Coordinator: ${coordinator ? `<span class="val">${esc(coordinator)}</span>` : '____________________'}</p>
        ${stamp ? `<p class="stamp-row">Signature: <img class="stamp" src="${stamp}" alt="Stamp of ${esc(coordinator)}"></p>` : '<p>Signature: ____________________</p>'}
        <p>Date: <span class="val">${esc(fmtDate(todayISO(), 'full'))}</span></p>
      </div>
    </section>`;
}

export function checklistHTML(patients, coordinator, { autoPrint = true } = {}) {
  const logo = new URL('icons/cvad-header.png', location.href).href;
  // Jawad's stamp goes in place of the signature; anyone else signs by hand.
  const stamp = coordinator === DEFAULT_COORDINATOR ? new URL('icons/stamp-jawad.png', location.href).href : '';
  const title = patients.length === 1 ? `CVAD checklist — ${patients[0].name}` : `CVAD checklists — ${patients.length} patients`;
  return `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head>
    <body>${patients.map((p) => patientPage(p, coordinator, logo, stamp)).join('')}
    ${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>' : ''}</body></html>`;
}

function open(patients, coordinator) {
  const w = window.open('', '_blank');
  if (!w) { toast(tr('اسمح للمتصفح بفتح النوافذ المنبثقة لهذا الموقع حتى تعمل الطباعة.', 'Allow pop-ups for this site so the print window can open.'), { type: 'error' }); return; }
  w.document.open();
  w.document.write(checklistHTML(patients, coordinator));
  w.document.close();
}

// Asks who the case coordinator is (Jawad A. Sabha by default), then prints one page per patient.
export async function printChecklists(patients, { subtitle = '' } = {}) {
  if (!patients.length) { toast(tr('لا يوجد مرضى محجوزون لطباعة الـ checklist.', 'No booked patients to print a checklist for.'), { type: 'error' }); return; }
  const last = settings.get('checklistCoordinator') || DEFAULT_COORDINATOR;
  const other = last !== DEFAULT_COORDINATOR;
  const r = await modal({
    title: tr('طباعة الـ Checklist', 'Print checklist'),
    size: 's',
    body: html`
      <p class="muted small">${subtitle || (patients.length === 1 ? patients[0].name : tr(`${patients.length} مرضى · صفحة لكل مريض`, `${patients.length} patients · one page each`))}</p>
      <div class="field"><span>Case Coordinator</span>
        <div class="choice-list">
          <label class="choice"><input type="radio" name="who" value="default" ${other ? '' : 'checked'}><strong>${DEFAULT_COORDINATOR}</strong><small>${tr('يُطبع ختمه مكان التوقيع', 'His stamp is printed as the signature')}</small></label>
          <label class="choice"><input type="radio" name="who" value="other" ${other ? 'checked' : ''}><strong>${tr('شخص آخر', 'Someone else')}</strong>
            <input name="otherName" class="input" value="${other ? last : ''}" placeholder="${tr('اسم المنسّق…', 'Coordinator name…')}" autocomplete="name" style="margin-top:6px;grid-column:2"></label>
        </div>
      </div>
      <p class="hint">${icon('check', 14)} ${tr('كل البنود عليها صح على Yes. لحفظ PDF اختر «Save as PDF» في نافذة الطباعة.', 'Every item is ticked “Yes”. To save a PDF, choose “Save as PDF” in the print window.')}</p>`,
    primary: tr('طباعة', 'Print'),
    onMount: (dlg) => {
      const name = dlg.querySelector('[name=otherName]');
      const pickOther = () => { dlg.querySelector('[name=who][value=other]').checked = true; };
      name.addEventListener('focus', pickOther);
      name.addEventListener('click', pickOther);
      name.addEventListener('input', pickOther);
      dlg.querySelector('[name=who][value=default]').focus();
    },
    validate: (d) => (d.who === 'other' && !String(d.otherName || '').trim() ? tr('اكتب اسم المنسّق، أو اختر ' + DEFAULT_COORDINATOR + '.', 'Write the coordinator’s name, or choose ' + DEFAULT_COORDINATOR + '.') : null),
  });
  if (!r) return;
  const coordinator = r.who === 'other' ? String(r.otherName).trim() : DEFAULT_COORDINATOR;
  settings.set({ checklistCoordinator: coordinator });
  open(patients, coordinator);
}
