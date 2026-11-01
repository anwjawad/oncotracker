// Single source of truth in the browser.
// - Every change is applied locally first, written to an outbox, and sent to the
//   server in batches; failed batches stay queued and retry with back-off.
// - Every change also writes an activity (audit) entry: who, when, which fields.
// - A sync replaces local rows with the server's, then re-applies the outbox so
//   unsent edits are never lost.
import { api } from './api.js';
import { settings } from './settings.js';
import { uid, nowISO, normMrn } from './util.js';

export const TABLES = ['patients', 'visits', 'committee', 'followups'];
const PREFIX = { patients: 'P', visits: 'V', committee: 'C', followups: 'F', activity: 'A' };
const JSON_FIELDS = {
  patients: { ignoredIssues: [] },
  visits: { custom: {} },
  committee: { addenda: [] },
  followups: { attempts: [] },
  activity: { changes: [] },
};
const CACHE_KEY = 'onco.v2.cache';
const ACTIVITY_KEEP = 3000;
const SKIP_DIFF = new Set(['updatedAt', 'createdAt', 'id']);

export const store = {
  data: emptyData(),
  version: 0,
  status: { state: 'idle', pending: 0, lastSync: null, error: '', oldBackend: false },
};

let outbox = [];
let inflight = [];
let flushTimer = null;
let retryDelay = 0;
let batchDepth = 0;
let batchDirty = false;
const listeners = new Set();

function emptyData() {
  return { patients: {}, visits: {}, committee: {}, followups: {}, activity: [] };
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function changed() {
  if (batchDepth > 0) { batchDirty = true; return; }
  store.version++;
  persistSoon();
  listeners.forEach((fn) => fn());
}

// Groups many writes into one re-render.
export function batch(fn) {
  batchDepth++;
  try { return fn(); } finally {
    batchDepth--;
    if (batchDepth === 0 && batchDirty) { batchDirty = false; changed(); }
  }
}

function setStatus(patch) {
  Object.assign(store.status, patch, { pending: outbox.length + inflight.length });
  listeners.forEach((fn) => fn({ statusOnly: true }));
}

// ---------- row encoding ----------
const isTrue = (v) => v === true || v === 1 || v === '1' || String(v).toUpperCase() === 'TRUE';

function decodeRow(table, r) {
  const out = {};
  const jf = JSON_FIELDS[table] || {};
  for (const [k, v] of Object.entries(r || {})) {
    if (k in jf) {
      if (v && typeof v === 'object') out[k] = v;
      else { try { out[k] = v ? JSON.parse(v) : structuredClone(jf[k]); } catch { out[k] = structuredClone(jf[k]); } }
    } else if (k === 'deleted') out[k] = isTrue(v);
    else out[k] = v == null ? '' : String(v);
  }
  for (const k in jf) if (!(k in out)) out[k] = structuredClone(jf[k]);
  if (!('deleted' in out)) out.deleted = false;
  return out;
}

function encodeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object') out[k] = JSON.stringify(v);
    else if (typeof v === 'boolean') out[k] = v ? '1' : '';
    else out[k] = v ?? '';
  }
  return out;
}

// ---------- persistence ----------
let persistTimer;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 250);
}
function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: store.data,
      outbox: [...inflight, ...outbox],
      lastSync: store.status.lastSync,
      mode: api.mode(),
    }));
  } catch (e) {
    console.warn('Cache write failed', e);
  }
}

export function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!c || c.mode !== api.mode()) return false;
    store.data = { ...emptyData(), ...c.data };
    outbox = c.outbox || [];
    store.status.lastSync = c.lastSync;
    store.status.pending = outbox.length;
    store.version++;
    if (outbox.length) scheduleFlush(50);
    return true;
  } catch { return false; }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  store.data = emptyData();
  outbox = []; inflight = [];
  changed();
}

// ---------- mutations ----------
function enqueue(op) {
  if (op.op === 'upsert') {
    const i = outbox.findIndex((o) => o.op === 'upsert' && o.table === op.table && o.row.id === op.row.id);
    if (i > -1) outbox[i] = op; else outbox.push(op);
  } else outbox.push(op);
  setStatus({ state: 'saving' });
  scheduleFlush();
}

function short(v) {
  if (v && typeof v === 'object') v = JSON.stringify(v);
  v = String(v ?? '');
  return v.length > 400 ? v.slice(0, 400) + '…' : v;
}

function logActivity(table, prev, row, audit = {}) {
  const action = audit.action || (prev ? (row.deleted && !prev.deleted ? 'delete' : 'update') : 'create');
  const changes = [];
  if (prev && action !== 'delete' && action !== 'restore') {
    for (const k of new Set([...Object.keys(prev || {}), ...Object.keys(row)])) {
      if (SKIP_DIFF.has(k)) continue;
      const a = short(prev?.[k]); const b = short(row[k]);
      if (a !== b) changes.push({ f: k, from: a, to: b });
    }
    if (action === 'update' && !changes.length && !audit.summary) return;
  }
  const entry = {
    id: uid('A'),
    at: nowISO(),
    by: settings.get('userName') || '',
    table,
    rowId: row.id,
    patientId: table === 'patients' ? row.id : (row.patientId || ''),
    action,
    summary: audit.summary || '',
    changes,
  };
  store.data.activity.unshift(entry);
  if (store.data.activity.length > ACTIVITY_KEEP) store.data.activity.length = ACTIVITY_KEEP;
  enqueue({ op: 'append', table: 'activity', row: entry });
}

// audit: false → no activity entry (used inside imports that log one summary entry).
export function upsert(table, patch, audit) {
  const prev = store.data[table][patch.id];
  const at = nowISO();
  const row = { ...(prev ? structuredClone(prev) : {}), ...patch, updatedAt: at };
  if (!prev) {
    row.createdAt = row.createdAt || at;
    row.deleted = !!row.deleted;
    for (const [k, d] of Object.entries(JSON_FIELDS[table] || {})) if (!(k in row)) row[k] = structuredClone(d);
  }
  store.data[table][row.id] = row;
  enqueue({ op: 'upsert', table, row });
  if (audit !== false) logActivity(table, prev, row, audit || {});
  changed();
  return row;
}

export const create = (table, fields, audit) => upsert(table, { id: uid(PREFIX[table]), ...fields }, audit === false ? false : { action: 'create', ...(audit || {}) });
export const remove = (table, id, audit) => upsert(table, { id, deleted: true }, { action: 'delete', ...(audit || {}) });
export const restore = (table, id) => upsert(table, { id, deleted: false }, { action: 'restore', summary: 'تراجع عن الحذف' });

export function note(summary, patientId = '', table = '', rowId = '') {
  const entry = { id: uid('A'), at: nowISO(), by: settings.get('userName') || '', table, rowId, patientId, action: 'note', summary, changes: [] };
  store.data.activity.unshift(entry);
  enqueue({ op: 'append', table: 'activity', row: entry });
  changed();
}

// ---------- server I/O ----------
function scheduleFlush(ms = 500) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

export async function flush() {
  if (inflight.length || !outbox.length) return;
  inflight = outbox.splice(0, 250);
  setStatus({ state: 'saving' });
  try {
    await api.call('APPLY', { ops: inflight.map((o) => ({ op: o.op, table: o.table, row: encodeRow(o.row) })) });
    inflight = [];
    retryDelay = 0;
    persist();
    if (outbox.length) { scheduleFlush(50); return; }
    setStatus({ state: 'saved', error: '' });
  } catch (e) {
    // Put failed ops back unless a newer edit of the same row is already queued.
    const back = inflight.filter((o) => !(o.op === 'upsert' && outbox.some((q) => q.op === 'upsert' && q.table === o.table && q.row.id === o.row.id)));
    outbox = [...back, ...outbox];
    inflight = [];
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 3000, 60000);
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message, oldBackend: !!e.oldBackend });
    persist();
    scheduleFlush(retryDelay);
  }
}

let syncing = false;
export async function sync() {
  if (syncing) return;
  syncing = true;
  setStatus({ state: 'syncing' });
  try {
    if (outbox.length) await flush();
    const res = await api.call('SYNC');
    const next = emptyData();
    for (const t of TABLES) {
      for (const r of res.tables?.[t] || []) {
        const d = decodeRow(t, r);
        if (d.id) next[t][d.id] = d;
      }
    }
    next.activity = (res.activity || []).map((r) => decodeRow('activity', r)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const seen = new Set(next.activity.map((a) => a.id));
    for (const op of [...inflight, ...outbox]) {
      if (op.op === 'upsert') next[op.table][op.row.id] = op.row;
      else if (!seen.has(op.row.id)) next.activity.unshift(op.row);
    }
    store.data = next;
    setStatus({ state: outbox.length ? 'saving' : 'saved', lastSync: nowISO(), error: '', oldBackend: false });
    changed();
  } catch (e) {
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message, oldBackend: !!e.oldBackend });
    throw e;
  } finally {
    syncing = false;
  }
}

// ---------- selectors ----------
let memo = { v: -1 };
export function idx() {
  if (memo.v === store.version) return memo;
  const lists = {};
  for (const t of TABLES) lists[t] = Object.values(store.data[t]).filter((r) => !r.deleted);
  const group = (rows) => {
    const m = new Map();
    for (const r of rows) { if (!m.has(r.patientId)) m.set(r.patientId, []); m.get(r.patientId).push(r); }
    return m;
  };
  const byMrn = new Map();
  for (const p of lists.patients) {
    const k = normMrn(p.mrn);
    if (!k) continue;
    if (!byMrn.has(k)) byMrn.set(k, []);
    byMrn.get(k).push(p);
  }
  const physicians = new Set();
  for (const r of [...lists.visits, ...lists.committee, ...lists.patients]) if (r.physician) physicians.add(r.physician);
  memo = {
    v: store.version,
    lists,
    visitsBy: group(lists.visits),
    committeeBy: group(lists.committee),
    followupsBy: group(lists.followups),
    byMrn,
    physicians: [...physicians].sort((a, b) => a.localeCompare(b, 'ar')),
  };
  return memo;
}

export const list = (t) => idx().lists[t];
export const get = (t, id) => store.data[t][id];
export const patient = (id) => store.data.patients[id];
export const pendingCount = () => outbox.length + inflight.length;
