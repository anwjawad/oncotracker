// UI building blocks: icons, dialogs, toasts, menus, the doctor field and the patient picker.
import { html, raw, esc, $, $$, normMrn, normName, cleanName, cleanPhysician, matchesQuery, relDay, todayISO, diffDays, daysText, phoneDigits } from './util.js';
import { idx, create, upsert } from './store.js';
import { fixPhone } from './rules.js';
import { settings, DEFAULT_PHYSICIANS } from './settings.js';
import { tr } from './i18n.js';

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17v.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  chevL: '<path d="m14 6-6 6 6 6"/>',
  chevR: '<path d="m10 6 6 6-6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  merge: '<path d="M7 4v5a5 5 0 0 0 5 5h0a5 5 0 0 1 5 5v1M17 4v5a5 5 0 0 1-5 5"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  wand: '<path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"/><path d="M19 12l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5Z"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
};
export const icon = (name, size = 18) => raw(`<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`);

// Previous / next arrows that point the right way in both reading directions.
export const prevIcon = () => icon(document.documentElement.dir === 'ltr' ? 'chevL' : 'chevR');
export const nextIcon = () => icon(document.documentElement.dir === 'ltr' ? 'chevR' : 'chevL');

// ---------- toasts ----------
export function toast(message, { type = 'ok', undo, timeout = 5000 } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.innerHTML = `<span>${esc(message)}</span>${undo ? `<button type="button">${esc(tr('تراجع', 'Undo'))}</button>` : ''}`;
  const kill = () => el.remove();
  if (undo) el.querySelector('button').onclick = () => { undo(); kill(); };
  $('#toasts').append(el);
  setTimeout(kill, type === 'error' ? 9000 : timeout);
}

// ---------- dialogs ----------
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi !== undefined) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); }
      else o[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; }
    else o[el.name] = String(el.value).trim();
  }
  return o;
}

// Resolves with the form's values, or null when cancelled.
// validate(data, form) may return an error string to keep the dialog open.
export function modal({ title, body, primary, secondary, danger = false, size = 'm', onMount, validate }) {
  primary = primary === undefined ? tr('حفظ', 'Save') : primary;
  secondary = secondary === undefined ? tr('إلغاء', 'Cancel') : secondary;
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = `modal modal-${size}`;
    dlg.innerHTML = `
      <form class="modal-form" novalidate>
        <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(tr('إغلاق', 'Close'))}">${icon('x')}</button></header>
        <div class="modal-body"><div class="form-error" hidden></div>${String(body)}</div>
        <footer>
          ${primary ? `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(primary)}</button>` : ''}
          ${secondary ? `<button type="button" class="btn" data-close>${esc(secondary)}</button>` : ''}
        </footer>
      </form>`;
    document.body.append(dlg);
    const form = dlg.querySelector('form');
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    $$('[data-close]', dlg).forEach((b) => (b.onclick = () => done(null)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = formData(form);
      const err = validate ? await validate(data, form) : null;
      if (err) {
        const box = $('.form-error', form);
        box.textContent = err; box.hidden = false;
        box.scrollIntoView({ block: 'nearest' });
        return;
      }
      done(data);
    });
    dlg.showModal();
    const first = form.querySelector('[autofocus], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
    first?.focus();
    onMount?.(dlg, done);
  });
}

export async function confirmBox(message, { title, confirm, danger = false } = {}) {
  const r = await modal({ title: title || tr('تأكيد', 'Confirm'), body: html`<p>${message}</p>`, primary: confirm || tr('متابعة', 'Continue'), danger });
  return r !== null;
}

// ---------- menus ----------
export function closeMenus() { $$('.menu').forEach((m) => (m.hidden = true)); }
export function toggleMenu(btn) {
  const menu = btn.parentElement.querySelector('.menu');
  const wasHidden = menu.hidden;
  closeMenus();
  menu.hidden = !wasHidden;
}
export const menu = (items) => html`
  <div class="menu-wrap">
    <button type="button" class="icon-btn" data-action="menu" aria-label="${tr('المزيد', 'More')}">${icon('more')}</button>
    <div class="menu" hidden>${items}</div>
  </div>`;

// ---------- small renderers ----------
export function dueChip(due, status) {
  if (!due) return html`<span class="task-due muted">${tr('بدون تاريخ', 'No date')}</span>`;
  const n = diffDays(todayISO(), due);
  const cls = n < 0 ? 'over' : n === 0 ? 'today' : '';
  const label = n < 0 ? tr(`متأخرة ${daysText(-n)}`, `${daysText(-n)} overdue`) : relDay(due);
  return html`<span class="task-due ${cls}">${n < 0 ? icon('alert', 14) : icon('clock', 14)} ${label}${status === 'waiting' ? tr(' · بانتظار رد', ' · waiting') : ''}</span>`;
}

export const telLink = (phone) => phone ? html`<a class="ltr" href="tel:${phoneDigits(phone)}">${phone}</a>` : html`<span class="muted">—</span>`;

// ---------- doctor field ----------
// A dropdown of the department's doctors plus "Other" with free text.
// Defaults to the doctor used for the previous patient, to speed up entry.
export function physicianList() {
  const list = settings.get('physicians');
  return Array.isArray(list) && list.length ? list : DEFAULT_PHYSICIANS;
}

export function physicianFieldHTML({ value, label, name = 'physician' } = {}) {
  const list = physicianList();
  const v = value === undefined ? settings.get('lastPhysician') || '' : cleanPhysician(value);
  const known = list.find((d) => d.toLowerCase() === v.toLowerCase());
  const other = v && !known;
  return html`
    <div class="field" data-physician-field>
      <span>${label || tr('الطبيب', 'Doctor')}</span>
      <select name="${name}">
        <option value="" ${!v ? 'selected' : ''}>${tr('اختر الطبيب…', 'Choose doctor…')}</option>
        ${list.map((d) => html`<option value="${d}" ${known === d ? 'selected' : ''}>Dr. ${d}</option>`)}
        <option value="__other" ${other ? 'selected' : ''}>${tr('آخر (اكتب الاسم)', 'Other (type name)')}</option>
      </select>
      <input name="${name}Other" placeholder="${tr('اسم الطبيب', 'Doctor name')}" value="${other ? v : ''}" ${other ? '' : 'hidden'}>
    </div>`;
}

export function mountPhysicianField(root) {
  for (const box of $$('[data-physician-field]', root)) {
    const sel = $('select', box);
    const other = $('input', box);
    sel.addEventListener('change', () => { other.hidden = sel.value !== '__other'; if (!other.hidden) other.focus(); });
  }
}

// Reads the doctor from form data and remembers it as the default for next time.
export function readPhysician(data, name = 'physician') {
  const v = data[name] === '__other' ? data[name + 'Other'] : data[name];
  const doc = cleanPhysician(v || '');
  if (doc) settings.set({ lastPhysician: doc });
  return doc;
}

// ---------- patient picker ----------
// Renders search-or-create fields inside a dialog form. Fields produced:
// patientId (existing) or newName/newMrn/newPhone (new patient).
export function patientPickerHTML({ label, patientId = '' } = {}) {
  return html`
    <div class="picker field" data-picker>
      <span>${label || tr('المريض', 'Patient')}</span>
      <input type="hidden" name="patientId" value="${patientId}">
      <div class="picked" ${patientId ? '' : 'hidden'}></div>
      <div class="pick-search" ${patientId ? 'hidden' : ''}>
        <input class="input" type="search" data-pick-q placeholder="${tr('اكتب الاسم أو رقم الملف…', 'Type name or file number…')}" autocomplete="off">
        <div class="results" data-pick-results hidden style="position:static; box-shadow:none; margin-top:6px;"></div>
      </div>
      <div class="pick-new stack" hidden>
        <div class="grid-2">
          <label class="field span-2"><span>${tr('الاسم الكامل (رباعي)', 'Full name')}</span><input name="newName" autocomplete="off"></label>
          <label class="field"><span>${tr('رقم الملف', 'File number')}</span><input name="newMrn" class="ltr" autocomplete="off"></label>
          <label class="field"><span>${tr('الهاتف', 'Phone')}</span><input name="newPhone" class="ltr" inputmode="tel" autocomplete="off"></label>
        </div>
        <div class="warn-text" data-pick-dup hidden></div>
        <button type="button" class="btn btn-ghost btn-sm" data-pick-cancel-new>${tr('رجوع للبحث', 'Back to search')}</button>
      </div>
    </div>`;
}

function pickedHTML(p) {
  return `<div class="row-between panel" style="padding:10px 12px;">
    <div><strong>${esc(p.name)}</strong> <span class="mrn">${esc(p.mrn || tr('بدون رقم', 'no number'))}</span>
    ${p.phone ? `<span class="muted small ltr" style="margin-inline-start:8px">${esc(p.phone)}</span>` : ''}</div>
    <button type="button" class="btn btn-ghost btn-sm" data-pick-change>${esc(tr('تغيير', 'Change'))}</button></div>`;
}

export function mountPatientPicker(root) {
  const box = $('[data-picker]', root);
  if (!box) return;
  const idInput = $('input[name=patientId]', box);
  const picked = $('.picked', box);
  const search = $('.pick-search', box);
  const q = $('[data-pick-q]', box);
  const results = $('[data-pick-results]', box);
  const fresh = $('.pick-new', box);
  const dup = $('[data-pick-dup]', box);
  const pts = () => idx().lists.patients;

  const choose = (p) => {
    idInput.value = p.id;
    picked.innerHTML = pickedHTML(p);
    picked.hidden = false; search.hidden = true; fresh.hidden = true;
    box.dispatchEvent(new CustomEvent('picked', { bubbles: true, detail: p }));
  };
  if (idInput.value) { const p = pts().find((x) => x.id === idInput.value); if (p) picked.innerHTML = pickedHTML(p); }

  const renderResults = () => {
    const term = q.value.trim();
    if (!term) { results.hidden = true; return; }
    const nm = normMrn(term);
    const found = pts().filter((p) => (nm && normMrn(p.mrn).includes(nm)) || matchesQuery(term, p.name)).slice(0, 8);
    results.innerHTML = found.map((p) => `<button type="button" class="result" data-id="${esc(p.id)}"><span>${esc(p.name)}</span><span class="meta ltr">${esc(p.mrn || '—')}</span></button>`).join('')
      + `<button type="button" class="result" data-new><span>${icon('plus', 16)} ${esc(tr('إضافة مريض جديد', 'Add new patient'))}${term ? `: «${esc(term)}»` : ''}</span></button>`;
    results.hidden = false;
  };
  q.addEventListener('input', renderResults);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); results.querySelector('.result')?.click(); } });
  results.addEventListener('click', (e) => {
    const b = e.target.closest('.result');
    if (!b) return;
    if (b.dataset.new !== undefined) {
      const term = q.value.trim();
      search.hidden = true; fresh.hidden = false;
      const looksLikeMrn = /\d{3,}/.test(term) && !/[؀-ۿa-z]{2,}/i.test(term.replace(/^pat/i, ''));
      $('[name=newName]', fresh).value = looksLikeMrn ? '' : term;
      $('[name=newMrn]', fresh).value = looksLikeMrn ? term : '';
      ($(looksLikeMrn ? '[name=newName]' : '[name=newMrn]', fresh)).focus();
      checkDup();
    } else choose(pts().find((p) => p.id === b.dataset.id));
  });
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-pick-change]')) { idInput.value = ''; picked.hidden = true; search.hidden = false; q.focus(); }
    if (e.target.closest('[data-pick-cancel-new]')) { fresh.hidden = true; search.hidden = false; q.focus(); }
    const useBtn = e.target.closest('[data-use]');
    if (useBtn) choose(pts().find((p) => p.id === useBtn.dataset.use));
  });

  const checkDup = () => {
    const m = normMrn($('[name=newMrn]', fresh).value);
    const n = normName($('[name=newName]', fresh).value);
    const hit = (m && idx().byMrn.get(m)?.[0]) || (n.split(' ').length >= 3 && pts().find((p) => normName(p.name) === n));
    if (hit) {
      const sameMrn = hit.mrn && normMrn(hit.mrn) === m;
      dup.innerHTML = `${esc(sameMrn ? tr('رقم الملف مسجّل مسبقاً لـ', 'This file number already belongs to') : tr('يوجد مريض بنفس الاسم:', 'A patient with this name exists:'))} <strong>${esc(hit.name)}</strong> (${esc(hit.mrn || tr('بدون رقم', 'no number'))}) <button type="button" class="btn btn-sm" data-use="${esc(hit.id)}">${esc(tr('استخدم هذا المريض', 'Use this patient'))}</button>`;
      dup.hidden = false;
    } else dup.hidden = true;
  };
  fresh.addEventListener('input', checkDup);
}

// Turns picker output into a patient id, creating the patient when needed.
// Returns { id } or { error }.
export function resolvePatient(data, extra = {}) {
  if (data.patientId) return { id: data.patientId };
  const name = cleanName(data.newName);
  if (!name) return { error: tr('اختر مريضاً موجوداً أو أدخل اسم المريض الجديد.', 'Choose an existing patient or enter the new patient\'s name.') };
  const mrn = normMrn(data.newMrn);
  if (mrn) {
    const hit = idx().byMrn.get(mrn)?.[0];
    if (hit) return { error: tr(`رقم الملف ${mrn} مسجّل لـ ${hit.name}. استخدم المريض الموجود بدل إنشاء ملف جديد.`, `File number ${mrn} belongs to ${hit.name}. Use the existing patient instead of creating a new record.`) };
  }
  const p = create('patients', { name, mrn, phone: data.newPhone ? fixPhone(data.newPhone) : '', ...extra });
  return { id: p.id, created: true };
}

export const validatePicker = (data) => (!data.patientId && !cleanName(data.newName) ? tr('اختر المريض أو أضف مريضاً جديداً.', 'Choose the patient or add a new one.') : null);

// Writes a phone number to a patient record (used by inline cells).
export function setPatientField(patientId, field, value) {
  const patch = { id: patientId, [field]: value };
  if (field === 'phone') { patch.phone = value ? fixPhone(value) : ''; patch.phoneFlag = ''; }
  upsert('patients', patch);
}
