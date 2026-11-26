// Demo-mode Port Cath data, built from the app's demo patients so the
// "pick an existing patient" flow has real matches.
import { todayISO, addDays, weekday, dayName, uid } from './util.js';
import { writeLocal } from './api.js';

export function seedDemo(patients) {
  const t = todayISO();
  const db = { portcath: {}, sessions: {}, history: {} };
  const put = (table, rec) => { const id = rec.id || uid(); db[table][id] = { ...rec, id, createdAt: rec.createdAt || new Date().toISOString() }; return db[table][id]; };
  const pts = patients.filter((p) => p.name).slice(0, 18);
  let n = 0;
  const next = () => pts[n++ % Math.max(pts.length, 1)] || { name: `Patient ${n}`, mrn: String(400000 + n) };
  // Session days: Wednesdays from three weeks ago to five weeks ahead.
  let d = addDays(t, -21);
  while (weekday(d) !== 3) d = addDays(d, 1);
  for (let i = 0; i < 9; i++, d = addDays(d, 7)) {
    put('sessions', { date: d, year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) - 1, dayOfWeek: dayName(d), isActive: true, syncStatus: '' });
    const count = d < t ? 3 : Math.max(0, 3 - (i % 3));
    for (let k = 0; k < count; k++) {
      const p = next();
      const status = d < t ? (k === 0 ? 'confirmed' : 'done') : 'confirmed';
      put('portcath', { name: p.name, fileNumber: p.mrn || '', phone: p.phone || '', diagnosis: p.diagnosis || '', date: d, day: dayName(d), weight: String(55 + ((n * 7) % 40)), notes: k === 1 ? 'FOLFOX' : '', status, doneAt: status === 'done' ? d : '', nextChemoAppt: addDays(d, 10), source: '' });
    }
  }
  for (let k = 0; k < 4; k++) {
    const p = next();
    put('portcath', { name: p.name, fileNumber: p.mrn || '', phone: p.phone || '', diagnosis: p.diagnosis || '', date: '', day: '', weight: String(60 + k * 3), notes: k === 0 ? 'Needs permit first' : '', status: 'waiting', createdAt: new Date(Date.now() - (k + 2) * 3 * 86400000).toISOString() });
  }
  writeLocal(db);
}
