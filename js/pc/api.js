// Port Cath data lives in MedSched's (jk) Google Sheet, so both apps show one list.
// This talks to MedSched's Apps Script (v2 "applyBatch"), or to a demo database in
// this browser when OncoTracker is in demo mode.
import { settings } from '../settings.js';

// MedSched's web app and key (the same values its own settings use by default).
export const MEDSCHED_API_URL = 'https://script.google.com/macros/s/AKfycbw0K-FmJxZKhWhzQnGZQ_BLA7wRBtt70i2YadtaE9A6AgElnlXeTE8G7ZxkhXeHV-Vq/exec';
const MEDSCHED_API_KEY = 'medsched-2026-key-abc123';

// store table → MedSched sheet "type", and its key in getAll.
export const TABLES = {
  portcath: { type: 'portcath', key: 'portcath' },
  sessions: { type: 'portcath-session-config', key: 'portcathSessionConfig' },
  history: { type: 'portcath-history', key: 'portcathHistory', appendOnly: true },
};

const LOCAL_DB = 'onco.pc.localdb';

export const api = {
  mode: () => (settings.get('localMode') ? 'local' : 'remote'),
  url: () => settings.get('pcApiUrl') || MEDSCHED_API_URL,

  async load() {
    if (this.mode() === 'local') return localLoad();
    const json = await request(`${this.url()}?${new URLSearchParams({ action: 'getAll', key: MEDSCHED_API_KEY })}`, { method: 'GET' });
    if (!(Number(json.version) >= 2)) throw new Error('MedSched’s Apps Script is on an old version.');
    const tables = {};
    for (const [t, def] of Object.entries(TABLES)) tables[t] = Array.isArray(json[def.key]) ? json[def.key] : [];
    return { tables };
  },

  // ops: [{ kind: 'upsert'|'delete', table, record?, id? }] → number applied.
  async apply(ops) {
    if (this.mode() === 'local') return localApply(ops);
    const res = await request(this.url(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: no CORS preflight
      body: JSON.stringify({
        action: 'applyBatch',
        key: MEDSCHED_API_KEY,
        displayName: settings.get('userName') || 'OncoTracker',
        ops: ops.map((o) => ({ op: o.kind, type: TABLES[o.table].type, record: o.record, id: o.id })),
      }),
    });
    return Number(res.applied ?? ops.length);
  },
};

async function request(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`MedSched answered ${res.status}.`);
    let json;
    try { json = await res.json(); } catch { throw new Error('MedSched sent back something unexpected.'); }
    if (json.status && json.status !== 'ok') throw new Error(json.message || 'MedSched refused the change.');
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('MedSched took too long to answer.');
    if (e instanceof TypeError) throw new Error(navigator.onLine ? 'Could not reach MedSched’s sheet. The change is kept and will be sent again.' : 'Offline. Changes are kept on this device.');
    throw e;
  } finally { clearTimeout(timer); }
}

// ---------- demo database ----------
function readLocal() {
  try { const db = JSON.parse(localStorage.getItem(LOCAL_DB) || 'null'); if (db) return db; } catch { /* fall through */ }
  return null;
}
export const writeLocal = (db) => (db ? localStorage.setItem(LOCAL_DB, JSON.stringify(db)) : localStorage.removeItem(LOCAL_DB));
export const hasLocal = () => !!readLocal();

async function localLoad() {
  await new Promise((r) => setTimeout(r, 40));
  const db = readLocal() || {};
  const tables = {};
  for (const t of Object.keys(TABLES)) tables[t] = Object.values(db[t] || {}).filter((r) => !r.deletedAt);
  return { tables };
}
async function localApply(ops) {
  await new Promise((r) => setTimeout(r, 40));
  const db = readLocal() || {};
  for (const o of ops) {
    db[o.table] ||= {};
    if (o.kind === 'delete') { if (db[o.table][o.id]) db[o.table][o.id].deletedAt = new Date().toISOString(); }
    else db[o.table][o.record.id] = { ...(db[o.table][o.record.id] || {}), ...o.record };
  }
  writeLocal(db);
  return ops.length;
}
