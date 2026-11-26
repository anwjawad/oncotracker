// Small renderers for the Port Cath screens (icons the main app lacks, chips, phone links).
import { html, raw, phoneDigits } from './util.js';
import { tr } from '../i18n.js';

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>',
  word: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M9.5 12l1 5 1.5-3.5 1.5 3.5 1-5"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17v.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2Z"/>',
  chevL: '<path d="m14 6-6 6 6 6"/>',
  chevR: '<path d="m10 6 6 6-6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.3 2.6 3.8 5.5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  calCheck: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
  forward: '<path d="M4 17V9a3 3 0 0 1 3-3h11M14 2l4 4-4 4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>',
  port: '<circle cx="12" cy="12" r="4"/><path d="M12 8V3M12 21v-5M8 12H3M21 12h-5"/>',
};
export const icon = (name, size = 18) => raw(`<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`);
// Arrows that point the right way in both reading directions.
export const prevIcon = () => icon(document.documentElement.dir === 'ltr' ? 'chevL' : 'chevR');
export const nextIcon = () => icon(document.documentElement.dir === 'ltr' ? 'chevR' : 'chevL');

export const chip = (text, tone = '') => html`<span class="pc-chip ${tone}">${text}</span>`;

export const empty = (title, text = '', action = '') => html`
  <div class="pc-empty"><div class="empty-ring">${icon('calendar', 22)}</div><strong>${title}</strong>${text ? html`<p>${text}</p>` : ''}${action}</div>`;

export function telLinks(phone) {
  if (!phone) return '';
  const d = phoneDigits(phone);
  // 059/056 are Palestinian networks (+970), other 05x are +972.
  const wa = /^0(59|56)/.test(d) ? '970' + d.slice(1) : d.startsWith('0') ? '972' + d.slice(1) : d.replace(/^\+/, '');
  return html`<span class="tel"><a class="ltr" href="tel:${d}" title="${tr('اتصال', 'Call')}">${icon('phone', 14)} ${phone}</a><a class="wa" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp ${phone}">${icon('whatsapp', 15)}</a></span>`;
}

export const datalist = (id, values) => html`<datalist id="${id}">${values.map((v) => html`<option value="${v}"></option>`)}</datalist>`;
