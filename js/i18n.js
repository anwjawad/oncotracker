// Interface language. Strings live next to the code that uses them as
// tr('عربي', 'English') pairs, so each screen stays readable in one place.
import { settings } from './settings.js';

export const lang = () => (settings.get('lang') === 'en' ? 'en' : 'ar');
export const tr = (ar, en) => (lang() === 'en' ? en : ar);

// Picks the label of a { ar, en } vocabulary entry.
export const L = (o) => (o ? (lang() === 'en' ? o.en : o.ar) : '');

// Physician display name with the title in the current language.
export const dr = (name) => (name ? `${tr('د.', 'Dr.')} ${name}` : tr('بدون طبيب', 'No doctor'));

export function applyLang() {
  const root = document.documentElement;
  root.lang = lang();
  root.dir = lang() === 'en' ? 'ltr' : 'rtl';
}
