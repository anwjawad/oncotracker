// Transport. Remote = Google Apps Script web app; local = a browser-only
// database used for trying the app before connecting the Google Sheet.
import { settings, DEFAULT_API_URL } from './settings.js';
import { tr } from './i18n.js';

const LOCAL_DB = 'onco.v2.localdb';
const TABLES = ['patients', 'visits', 'committee', 'followups'];

export const api = {
  mode() { return settings.get('localMode') ? 'local' : 'remote'; },
  url() { return settings.get('apiUrl') || DEFAULT_API_URL; },
  call(action, payload = {}) {
    return this.mode() === 'remote' ? remote(action, payload) : local(action, payload);
  },
};

async function remote(action, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    // text/plain body keeps this a "simple" request, so Apps Script needs no CORS preflight.
    const res = await fetch(api.url(), {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(tr(`الخادم ردّ بالرمز ${res.status}`, `Server responded with ${res.status}`));
    const json = await res.json();
    if (!json.success && /^Unknown Action/i.test(json.message || '')) {
      // The v1 backend answers v2 actions with "Unknown Action".
      const err = new Error(tr('الخادم ما زال على النسخة القديمة: انشر ملف backend/Code.gs الجديد على Apps Script.', 'The server still runs the old script: deploy the new backend/Code.gs to Apps Script.'));
      err.oldBackend = true;
      throw err;
    }
    if (!json.success) throw new Error(json.message || tr('خطأ غير معروف من الخادم', 'Unknown server error'));
    return json.data;
  } catch (e) {
    if (e.oldBackend) throw e;
    if (e.name === 'AbortError') throw new Error(tr('انتهت مهلة الاتصال بالخادم', 'The server took too long to respond'));
    if (e instanceof TypeError) throw new Error(tr('تعذّر الوصول للخادم — تحقّق من الإنترنت ومن رابط Apps Script', 'Could not reach the server. Check the internet connection and the Apps Script link.'));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- local database ----------
function readLocal() {
  try {
    const db = JSON.parse(localStorage.getItem(LOCAL_DB) || 'null');
    if (db) return db;
  } catch { /* fall through */ }
  return { patients: {}, visits: {}, committee: {}, followups: {}, activity: [] };
}
function writeLocal(db) {
  localStorage.setItem(LOCAL_DB, JSON.stringify(db));
}
export function resetLocal(db) {
  if (db) writeLocal(db); else localStorage.removeItem(LOCAL_DB);
}

async function local(action, payload) {
  await new Promise((r) => setTimeout(r, 120));
  const db = readLocal();
  switch (action) {
    case 'PING':
      return { ok: true, mode: 'local' };
    case 'SYNC': {
      const tables = {};
      for (const t of TABLES) tables[t] = Object.values(db[t]).filter((r) => !r.deleted);
      return { tables, activity: db.activity.slice(-3000), serverTime: new Date().toISOString() };
    }
    case 'APPLY': {
      for (const op of payload.ops || []) {
        if (op.op === 'upsert') db[op.table][op.row.id] = { ...(db[op.table][op.row.id] || {}), ...op.row };
        else if (op.op === 'append') db.activity.push(op.row);
      }
      if (db.activity.length > 20000) db.activity = db.activity.slice(-20000);
      writeLocal(db);
      return { applied: (payload.ops || []).length };
    }
    case 'UPLOAD_FILE':
      return { url: payload.dataUrl };
    case 'MIGRATE_V1':
      throw new Error(tr('الترحيل متاح فقط عند الاتصال بملف Google Sheets.', 'Migration only works when connected to the Google Sheet.'));
    default:
      throw new Error(tr('إجراء غير معروف: ', 'Unknown action: ') + action);
  }
}
