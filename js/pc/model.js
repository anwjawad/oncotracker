// Port Cath rules, the same as MedSched's: statuses, session days, "awaiting outcome",
// and the history row written with every status change.
import { store, upsert, create, all } from './store.js';
import { todayISO, monthKey, dayName, byText, normFile } from './util.js';
import { tr } from '../i18n.js';

let memo = { v: -1 };
export function lists() {
  if (memo.v === store.version) return memo;
  const today = todayISO();
  const pc = all('portcath');
  const sessionsByDate = new Map();
  for (const s of all('sessions')) {
    if (!s.date) continue;
    const cur = sessionsByDate.get(s.date);
    if (!cur || String(s.updatedAt || s.createdAt || '') > String(cur.updatedAt || cur.createdAt || '')) sessionsByDate.set(s.date, s);
  }
  const pcByDate = new Map();
  for (const p of pc) {
    if (!p.date || p.status === 'waiting') continue;
    if (!pcByDate.has(p.date)) pcByDate.set(p.date, []);
    pcByDate.get(p.date).push(p);
  }
  memo = {
    v: store.version,
    today,
    portcath: pc,
    waiting: pc.filter((p) => p.status === 'waiting' || (!p.date && p.status !== 'cancelled' && p.status !== 'done')).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    awaiting: pc.filter((p) => isBooked(p) && p.date < today).sort((a, b) => a.date.localeCompare(b.date) || byText(a.name, b.name)),
    pcByDate,
    sessionsByDate,
    history: all('history').sort((a, b) => b.timestamp - a.timestamp),
  };
  return memo;
}

export const PC_STATUS = {
  waiting: { label: ['قائمة الانتظار', 'Waiting list'], tone: 'amber' },
  confirmed: { label: ['محجوز', 'Booked'], tone: 'blue' },
  scheduled: { label: ['محجوز', 'Booked'], tone: 'blue' },
  done: { label: ['تم التركيب', 'Port done'], tone: 'green' },
  cancelled: { label: ['ملغى', 'Cancelled'], tone: 'grey' },
};
export function pcStatus(p) {
  const s = PC_STATUS[p.status];
  return s ? { label: tr(...s.label), tone: s.tone } : { label: p.status || tr('محجوز', 'Booked'), tone: 'blue' };
}
export const isBooked = (p) => (p.status === 'confirmed' || p.status === 'scheduled' || !PC_STATUS[p.status]) && !!p.date && p.status !== 'waiting';
// Has an appointment (booked or already done) → gets a CVAD checklist.
export const hasAppt = (p) => !!p.date && p.status !== 'cancelled' && p.status !== 'waiting';

export function isSessionDay(date) {
  const L = lists();
  const s = L.sessionsByDate.get(date);
  if (s) return s.isActive;
  return (L.pcByDate.get(date) || []).some((p) => p.status !== 'cancelled');
}
export function sessionDaysInMonth(key) {
  const L = lists();
  const days = new Set();
  for (const [d, s] of L.sessionsByDate) if (s.isActive && monthKey(d) === key) days.add(d);
  for (const d of L.pcByDate.keys()) if (monthKey(d) === key && isSessionDay(d)) days.add(d);
  return [...days].sort();
}
export function upcomingSessions(from = todayISO(), n = 8) {
  const L = lists();
  const days = new Set();
  for (const [d, s] of L.sessionsByDate) if (s.isActive && d >= from) days.add(d);
  for (const d of L.pcByDate.keys()) if (d >= from && isSessionDay(d)) days.add(d);
  return [...days].sort().slice(0, n);
}
const order = (p) => ({ done: 2, cancelled: 3 }[p.status] ?? 1);
export const patientsOn = (date) => (lists().pcByDate.get(date) || []).slice().sort((a, b) => order(a) - order(b) || byText(a.name, b.name));

export function setSessionDay(date, active) {
  const existing = lists().sessionsByDate.get(date);
  const d = new Date(date + 'T00:00:00');
  if (existing) upsert('sessions', { id: existing.id, isActive: active });
  else create('sessions', { date, year: d.getFullYear(), month: d.getMonth(), dayOfWeek: dayName(date), isActive: active, syncStatus: '' });
}

function log(p, action, extra = {}) {
  create('history', {
    patientId: p.id, patientName: p.name, fileNumber: p.fileNumber, action,
    fromDate: extra.fromDate ?? p.date ?? '', toDate: extra.toDate ?? '', reason: extra.reason || '', note: extra.note || '',
    timestamp: Date.now(), syncStatus: '',
  });
}

// Reasons are stored in English, as MedSched writes them, so both apps read the same log.
export const pc = {
  done(p, note = '') {
    upsert('portcath', { id: p.id, status: 'done', doneAt: p.date || todayISO(), outcomeNote: note });
    log(p, 'done', { note });
  },
  undoDone(p) {
    upsert('portcath', { id: p.id, status: 'confirmed', doneAt: '', outcomeNote: '' });
    log(p, 'restore', { reason: 'Port-done mark removed' });
  },
  move(p, toDate, reason) {
    const fromDate = p.date;
    upsert('portcath', { id: p.id, date: toDate, day: dayName(toDate), status: 'confirmed', doneAt: '' });
    log(p, 'move', { fromDate, toDate, reason });
  },
  toWaiting(p, reason) {
    const fromDate = p.date;
    upsert('portcath', { id: p.id, date: '', day: '', status: 'waiting', doneAt: '' });
    log(p, 'move', { fromDate, toDate: '', reason: reason || 'Moved to waiting list' });
  },
  cancel(p, reason) {
    upsert('portcath', { id: p.id, status: 'cancelled' });
    log(p, 'cancel', { reason });
  },
  restore(p, reason) {
    upsert('portcath', { id: p.id, status: p.date ? 'confirmed' : 'waiting' });
    log(p, 'restore', { reason });
  },
  add(fields) {
    const row = create('portcath', { ...fields, day: dayName(fields.date), status: fields.date ? 'confirmed' : 'waiting' });
    log(row, 'add', { fromDate: '', toDate: row.date, reason: row.date ? 'Booked' : 'Added to waiting list' });
    return row;
  },
};

export const historyOf = (id) => lists().history.filter((h) => h.patientId === id);
export const HISTORY_LABEL = {
  move: ['نُقل', 'Moved'], cancel: ['أُلغي', 'Cancelled'], restore: ['أُعيد', 'Restored'], noshow: ['لم يحضر', 'No-show'],
  apologize: ['اعتذر', 'Apologised'], done: ['تم التركيب', 'Port done'], add: ['أُضيف', 'Added'], edit: ['عُدّل', 'Edited'], notdone: ['لم يتم', 'Not done'],
};

// Port cath records of the same person (by file number).
export function samePatient(fileNumber, exceptId) {
  const k = normFile(fileNumber);
  if (!k) return [];
  return lists().portcath.filter((p) => p.id !== exceptId && normFile(p.fileNumber) === k);
}
