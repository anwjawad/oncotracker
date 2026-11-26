// Port Cath store: the same local-first design as MedSched's.
// Changes apply here at once and wait in an outbox until MedSched's sheet confirms
// them; a failed send is retried, and loading re-applies whatever is still queued.
import { api, TABLES } from './api.js';
import { uid, nowISO, normDate, fixMojibake, cleanText } from './util.js';

export const TABLE_NAMES = Object.keys(TABLES);
const CACHE_KEY = 'onco.pc.cache';
const DATE_FIELDS = ['date', 'nextChemoAppt', 'doneAt', 'fromDate', 'toDate'];

export const store = {
  data: emptyData(),
  version: 0,
  loaded: false,
  status: { state: 'idle', pending: 0, lastSync: null, error: '' },
};

let outbox = [];
let inflight = [];
let flushTimer = null;
let retryDelay = 0;
const listeners = new Set();

function emptyData() { return Object.fromEntries(TABLE_NAMES.map((t) => [t, {}])); }

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let batchDepth = 0;
let batchDirty = false;
function changed() {
  if (batchDepth > 0) { batchDirty = true; return; }
  store.version++;
  persistSoon();
  listeners.forEach((fn) => fn({}));
}
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

const isTrue = (v) => v === true || v === 1 || /^(true|1|yes)$/i.test(String(v ?? ''));
export function decode(table, r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) out[k] = v == null ? '' : v;
  out.id = String(out.id ?? '').trim();
  for (const k of ['name', 'fileNumber', 'phone', 'patientName']) if (k in out) out[k] = cleanText(fixMojibake(out[k])).replace(/\.0$/, '');
  if (/^5\d{8}$/.test(out.phone || '')) out.phone = '0' + out.phone;
  for (const k of DATE_FIELDS) if (k in out) out[k] = normDate(out[k]);
  if (table === 'portcath') {
    out.status = String(out.status || '').trim().toLowerCase();
    if (!out.status) out.status = out.date ? 'confirmed' : 'waiting';
  }
  if (table === 'sessions') out.isActive = isTrue(out.isActive);
  if (table === 'history') { out.timestamp = Number(out.timestamp) || Date.parse(out.createdAt) || 0; out.patientId = String(out.patientId ?? ''); }
  return out;
}
const encode = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));

// ---------- persistence ----------
let persistTimer;
function persistSoon() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 250); }
function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ mode: api.mode(), data: store.data, outbox: [...inflight, ...outbox], lastSync: store.status.lastSync }));
  } catch (e) { console.warn('Port cath cache write failed', e); }
}
export function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!c || c.mode !== api.mode()) { store.data = emptyData(); outbox = []; return false; }
    store.data = { ...emptyData(), ...c.data };
    outbox = c.outbox || [];
    store.status.lastSync = c.lastSync;
    store.status.pending = outbox.length;
    store.loaded = true;
    store.version++;
    if (outbox.length) scheduleFlush(50);
    return true;
  } catch (e) { console.warn(e); return false; }
}
export function resetCache() {
  localStorage.removeItem(CACHE_KEY);
  store.data = emptyData();
  outbox = []; inflight = [];
  store.loaded = false;
  store.status.lastSync = null;
  changed();
}

// ---------- mutations ----------
function enqueue(op) {
  if (op.kind === 'upsert') {
    const i = outbox.findIndex((o) => o.kind === 'upsert' && o.table === op.table && o.record.id === op.record.id);
    if (i > -1) { outbox[i] = op; return; }
  }
  outbox.push(op);
}
function queued(op) { enqueue(op); setStatus({ state: 'saving' }); scheduleFlush(); }

export function upsert(table, patch) {
  const prev = store.data[table][patch.id];
  const row = { ...(prev || {}), ...patch, updatedAt: nowISO() };
  if (!prev) row.createdAt = row.createdAt || row.updatedAt;
  store.data[table][row.id] = row;
  queued({ kind: 'upsert', table, record: encode(row) });
  changed();
  return row;
}
export const create = (table, fields) => upsert(table, { id: uid(), ...fields });
export function remove(table, id) {
  const prev = store.data[table][id];
  if (!prev) return null;
  delete store.data[table][id];
  queued({ kind: 'delete', table, id });
  changed();
  return prev;
}
export const restore = (table, row) => upsert(table, { ...row, deletedAt: '' });

// ---------- server I/O ----------
function scheduleFlush(ms = 400) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms); }

export async function flush() {
  if (inflight.length || !outbox.length) return;
  inflight = outbox.splice(0, 150);
  setStatus({ state: 'saving' });
  try {
    const applied = await api.apply(inflight);
    outbox = [...inflight.slice(applied), ...outbox];
    inflight = [];
    retryDelay = 0;
    persist();
    if (outbox.length) { scheduleFlush(30); return; }
    setStatus({ state: 'saved', error: '' });
  } catch (e) {
    const back = inflight.filter((o) => !(o.kind === 'upsert' && outbox.some((q) => q.kind === 'upsert' && q.table === o.table && q.record.id === o.record.id)));
    outbox = [...back, ...outbox];
    inflight = [];
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 4000, 60000);
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message });
    persist();
    scheduleFlush(retryDelay);
  }
}

let syncing = null;
export function sync(opts) {
  syncing ||= doSync(opts).finally(() => { syncing = null; });
  return syncing;
}
async function doSync({ quiet = false } = {}) {
  if (!quiet) setStatus({ state: 'syncing' });
  try {
    if (outbox.length) await flush();
    const res = await api.load();
    const next = emptyData();
    for (const t of TABLE_NAMES) {
      for (const r of res.tables[t] || []) {
        const d = decode(t, r);
        if (d.id) next[t][d.id] = d;
      }
    }
    for (const op of [...inflight, ...outbox]) {
      if (op.kind === 'upsert') next[op.table][op.record.id] = decode(op.table, op.record);
      else delete next[op.table][op.id];
    }
    // Nothing new: leave the page alone (no re-render every poll).
    const same = store.loaded && JSON.stringify(next) === JSON.stringify(store.data);
    if (!same) store.data = next;
    store.loaded = true;
    setStatus({ state: outbox.length ? 'saving' : 'saved', lastSync: nowISO(), error: '' });
    if (!same) changed();
  } catch (e) {
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: e.message });
    throw e;
  }
}

export const pendingCount = () => outbox.length + inflight.length;
export const get = (t, id) => store.data[t][id];
export const all = (t) => Object.values(store.data[t]);
