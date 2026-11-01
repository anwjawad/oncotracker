/**
 * منسّق الأورام — Google Apps Script backend (v2)
 *
 * الإعداد (مرة واحدة):
 * 1) افتح ملف Google Sheets الحالي ← Extensions ← Apps Script.
 * 2) استبدل محتوى Code.gs بهذا الملف واحفظ.
 * 3) اختر الدالة setup من القائمة واضغط Run (ووافق على الصلاحيات).
 * 4) Deploy ← New deployment ← Web app: Execute as = Me، Who has access = Anyone.
 *    (إذا كان عندك نشر سابق: Manage deployments ← Edit ← Version: New version، فيبقى نفس الرابط.)
 * 5) الصق الرابط في صفحة الإعدادات داخل التطبيق، ثم اضغط «ترحيل بيانات النسخة القديمة».
 *
 * الأوراق القديمة (PostClinicBookings, NewCasesMeeting, ...) لا تُعدَّل ولا تُحذف.
 */

var SCHEMA = {
  Patients: ['id', 'mrn', 'name', 'phone', 'phone2', 'age', 'gender', 'physician', 'diagnosis', 'notes', 'phoneFlag', 'ignoredIssues', 'mergedInto', 'createdAt', 'updatedAt', 'deleted'],
  ClinicVisits: ['id', 'patientId', 'sessionDate', 'physician', 'plan', 'opcDate', 'permit', 'referral', 'notified', 'noteUrl', 'autoClosed', 'custom', 'createdAt', 'updatedAt', 'deleted'],
  CommitteeCases: ['id', 'patientId', 'sessionDate', 'physician', 'briefHistory', 'question', 'plan', 'decision', 'status', 'notes', 'sourceVisitId', 'carriedFromId', 'deferredToId', 'decidedAt', 'addenda', 'createdAt', 'updatedAt', 'deleted'],
  FollowUps: ['id', 'patientId', 'sourceType', 'sourceId', 'type', 'title', 'dueDate', 'status', 'outcome', 'attempts', 'createdAt', 'closedAt', 'updatedAt', 'deleted'],
  Activity: ['id', 'at', 'by', 'table', 'rowId', 'patientId', 'action', 'summary', 'changes']
};
var TABLES = { patients: 'Patients', visits: 'ClinicVisits', committee: 'CommitteeCases', followups: 'FollowUps', activity: 'Activity' };
var ACTIVITY_RETURN = 3000;

// ---------- setup ----------
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) { ensureSheet_(ss, name); });
  return 'OK';
}

function ensureSheet_(ss, name) {
  var headers = SCHEMA[name];
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#ECEDF3');
    sh.setFrozenRows(1);
  } else {
    var current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    headers.forEach(function (h) {
      if (current.indexOf(h) === -1) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold').setBackground('#ECEDF3');
        current.push(h);
      }
    });
  }
  // Plain text everywhere: keeps leading zeros in phone numbers and file numbers,
  // and stops Sheets from turning dates and numbers into other types.
  sh.getRange(1, 1, sh.getMaxRows(), sh.getLastColumn()).setNumberFormat('@');
  return sh;
}

// ---------- HTTP ----------
function doGet() {
  return json_({ success: true, data: { status: 'Onco Tracker API v2 — use POST' } });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var p = req.payload || {};
    switch (req.action) {
      case 'PING': return ok_({ ok: true, mode: 'remote', sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
      case 'SYNC': return ok_(sync_());
      case 'APPLY': return ok_(apply_(p.ops || []));
      case 'UPLOAD_FILE': return ok_(upload_(p.dataUrl, p.filename));
      case 'MIGRATE_V1': return ok_(migrateFromV1());
      default: return json_({ success: false, message: 'Unknown action: ' + req.action });
    }
  } catch (err) {
    return json_({ success: false, message: String(err && err.message || err) });
  }
}

function ok_(data) { return json_({ success: true, data: data }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- read ----------
function readTable_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var o = {};
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      var v = row[j];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[headers[j]] = v === null || v === undefined ? '' : String(v);
    }
    out.push(o);
  }
  return out;
}

function isDeleted_(r) { return r.deleted === '1' || String(r.deleted).toUpperCase() === 'TRUE'; }

function sync_() {
  var tables = {};
  ['patients', 'visits', 'committee', 'followups'].forEach(function (t) {
    tables[t] = readTable_(TABLES[t]).filter(function (r) { return !isDeleted_(r); });
  });
  var activity = readTable_('Activity');
  return { tables: tables, activity: activity.slice(-ACTIVITY_RETURN), serverTime: new Date().toISOString() };
}

// ---------- write ----------
// ops: [{ op: 'upsert'|'append', table, row }] — rows hold strings only (JSON already encoded).
function apply_(ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var byTable = {};
    ops.forEach(function (op) {
      var name = TABLES[op.table];
      if (!name) throw new Error('Unknown table: ' + op.table);
      (byTable[name] = byTable[name] || []).push(op);
    });
    Object.keys(byTable).forEach(function (name) {
      var sh = ss.getSheetByName(name) || ensureSheet_(ss, name);
      var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      // Add any column the client sends that the sheet doesn't have yet.
      byTable[name].forEach(function (op) {
        Object.keys(op.row).forEach(function (k) {
          if (headers.indexOf(k) === -1) { sh.getRange(1, headers.length + 1).setValue(k).setFontWeight('bold'); headers.push(k); }
        });
      });
      var lastRow = sh.getLastRow();
      var ids = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 1).getValues() : [];
      var rowOf = {};
      for (var i = 0; i < ids.length; i++) rowOf[String(ids[i][0])] = i + 2;

      var appends = [];
      var appendIndex = {};
      var updates = byTable[name].filter(function (op) { return op.op === 'upsert' && rowOf[String(op.row.id)]; }).length;
      // Many updates: read the sheet once, change rows in memory, write once.
      var bulk = updates > 10 ? sh.getRange(2, 1, lastRow - 1, headers.length).getValues() : null;
      byTable[name].forEach(function (op) {
        var r = op.row;
        var at = rowOf[String(r.id)];
        if (op.op === 'upsert' && at) {
          var existing = bulk ? bulk[at - 2] : sh.getRange(at, 1, 1, headers.length).getValues()[0];
          var merged = headers.map(function (h, j) { return r.hasOwnProperty(h) ? String(r[h]) : existing[j]; });
          if (bulk) bulk[at - 2] = merged; else sh.getRange(at, 1, 1, headers.length).setValues([merged]);
        } else if (op.op === 'upsert' && appendIndex.hasOwnProperty(r.id)) {
          appends[appendIndex[r.id]] = headers.map(function (h) { return r.hasOwnProperty(h) ? String(r[h]) : ''; });
        } else {
          appendIndex[r.id] = appends.length;
          appends.push(headers.map(function (h) { return r.hasOwnProperty(h) ? String(r[h]) : ''; }));
        }
      });
      if (bulk) sh.getRange(2, 1, bulk.length, headers.length).setValues(bulk);
      if (appends.length) {
        var start = sh.getLastRow() + 1;
        var target = sh.getRange(start, 1, appends.length, headers.length);
        target.setNumberFormat('@');
        target.setValues(appends);
      }
    });
    return { applied: ops.length };
  } finally {
    lock.releaseLock();
  }
}

// ---------- files ----------
function upload_(dataUrl, filename) {
  var m = String(dataUrl || '').match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Invalid file data');
  var folder = getFolder_();
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], filename || 'attachment');
  var file = folder.createFile(blob);
  // Anyone with the link can view, so the image can be shown inside the app.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: 'https://drive.google.com/thumbnail?sz=w1600&id=' + file.getId(), fileId: file.getId() };
}

function getFolder_() {
  var name = 'Onco Tracker Attachments';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

// ---------- migration from v1 ----------
// Builds Patients / ClinicVisits / CommitteeCases / FollowUps from the old
// PostClinicBookings and NewCasesMeeting sheets. Safe to run more than once:
// rows whose id already exists are skipped. Old sheets are left untouched.
function migrateFromV1() {
  setup();
  var now = new Date().toISOString();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var pc = readTable_('PostClinicBookings');
  var nc = readTable_('NewCasesMeeting');

  var existing = {};
  ['Patients', 'ClinicVisits', 'CommitteeCases', 'FollowUps'].forEach(function (n) {
    existing[n] = {};
    readTable_(n).forEach(function (r) { existing[n][r.id] = r; });
  });

  var patientsByKey = {};
  Object.keys(existing.Patients).forEach(function (id) {
    var p = existing.Patients[id];
    var k = p.mrn ? 'M:' + p.mrn : 'N:' + normName_(p.name);
    patientsByKey[k] = p;
  });
  var newPatients = [];
  function patientFor(name, code, phone, age, physician) {
    var mrn = normMrn_(code);
    var key = mrn ? 'M:' + mrn : 'N:' + normName_(name);
    var p = patientsByKey[key];
    if (!mrn && !p) {
      // A name-only row may belong to a patient already keyed by file number.
      for (var k in patientsByKey) if (normName_(patientsByKey[k].name) === normName_(name)) { p = patientsByKey[k]; break; }
    }
    if (!p) {
      p = { id: 'P_m' + (newPatients.length + 1).toString(36) + Utilities.getUuid().slice(0, 6), mrn: mrn, name: cleanName_(name), phone: cleanPhone_(phone),
        phone2: '', age: digits_(age), gender: '', physician: physician || '', diagnosis: '', notes: '', phoneFlag: '', ignoredIssues: '[]', mergedInto: '',
        createdAt: now, updatedAt: now, deleted: '' };
      patientsByKey[key] = p;
      newPatients.push(p);
    } else if (newPatients.indexOf(p) > -1) {
      // Keep the most complete values seen across old rows.
      if (cleanName_(name).length > p.name.length) p.name = cleanName_(name);
      if (!p.phone && phone) p.phone = cleanPhone_(phone);
      if (!p.age && age) p.age = digits_(age);
      if (physician) p.physician = physician;
    }
    return p;
  }

  var visits = [], cases = [], fus = [];
  pc.forEach(function (b) {
    if (!b.id || !String(b.patientName || '').trim()) return;
    var p = patientFor(b.patientName, b.patientCode, b.phoneNumber, b.patientAge, b.providerName);
    if (!existing.ClinicVisits[b.id]) {
      visits.push({ id: b.id, patientId: p.id, sessionDate: b.sessionDate || '', physician: cleanName_(b.providerName), plan: stripFinishBlocks_(b.treatmentPlan),
        opcDate: b.opcDate || '', permit: b.permit || '', referral: b.referral || '', notified: b.notifiedPatient === 'Y' ? 'Y' : 'N',
        noteUrl: b.specialistNoteUrl || '', autoClosed: '', custom: b.customData || '{}', createdAt: createdFromId_(b.id) || now, updatedAt: now, deleted: '' });
    }
    entriesV1_(b.followUpsData, b).forEach(function (e, i) { fus.push(fuFromV1_(e, i, p.id, 'visit', b.id, now)); });
  });
  nc.forEach(function (m) {
    if (!m.id || !String(m.patientName || '').trim()) return;
    var p = patientFor(m.patientName, m.patientId, '', '', m.primaryPhysician);
    var custom = {};
    try { custom = m.customData ? JSON.parse(m.customData) : {}; } catch (x) { custom = {}; }
    if (!existing.CommitteeCases[m.id]) {
      var past = m.sessionDate && m.sessionDate < today;
      cases.push({ id: m.id, patientId: p.id, sessionDate: m.sessionDate || '', physician: cleanName_(m.primaryPhysician), briefHistory: m.briefHistory || '',
        question: stripFinishBlocks_(m.treatmentPlan), plan: '', decision: '', status: past ? 'presented' : 'listed',
        notes: [m.notes, past ? 'مُرحّلة من النسخة السابقة — نص القرار غير مسجّل' : ''].filter(String).join('\n'),
        sourceVisitId: '', carriedFromId: '', deferredToId: '', decidedAt: '', addenda: '[]', createdAt: createdFromId_(m.id) || now, updatedAt: now, deleted: '' });
    }
    entriesV1_(custom.followUpsData, custom).forEach(function (e, i) { fus.push(fuFromV1_(e, i, p.id, 'committee', m.id, now)); });
  });
  fus = fus.filter(function (f) { return !existing.FollowUps[f.id]; });

  var ops = [];
  newPatients.forEach(function (r) { ops.push({ op: 'upsert', table: 'patients', row: r }); });
  visits.forEach(function (r) { ops.push({ op: 'upsert', table: 'visits', row: r }); });
  cases.forEach(function (r) { ops.push({ op: 'upsert', table: 'committee', row: r }); });
  fus.forEach(function (r) { ops.push({ op: 'upsert', table: 'followups', row: r }); });
  if (ops.length) ops.push({ op: 'append', table: 'activity', row: { id: 'A_mig' + Date.now(), at: now, by: 'ترحيل', table: '', rowId: '', patientId: '', action: 'note',
    summary: 'ترحيل من النسخة السابقة: ' + newPatients.length + ' مريض، ' + visits.length + ' زيارة، ' + cases.length + ' حالة لجنة، ' + fus.length + ' متابعة', changes: '[]' } });
  if (ops.length) apply_(ops);
  return { patients: newPatients.length, visits: visits.length, committee: cases.length, followups: fus.length };
}

function entriesV1_(raw, legacy) {
  var arr = [];
  if (raw) { try { arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (x) { arr = []; } }
  if (!Array.isArray(arr)) arr = [];
  if (!arr.length && legacy && legacy.followUpStatus === 'ACTIVE') {
    arr = [{ id: '', type: legacy.followUpType || 'OTHER', notes: legacy.followUpNotes || '', status: 'ACTIVE' }];
  }
  return arr;
}

function fuFromV1_(e, i, patientId, sourceType, sourceId, now) {
  var done = e.status === 'FINISHED';
  var created = e.createdAt || now;
  return { id: 'F_' + (e.id || sourceId + '_' + i), patientId: patientId, sourceType: sourceType, sourceId: sourceId, type: e.type || 'OTHER',
    title: e.notes || 'متابعة', dueDate: String(created).slice(0, 10), status: done ? 'done' : 'open', outcome: e.finishedNote || '',
    attempts: '[]', createdAt: created, closedAt: done ? (e.finishedAt || now) : '', updatedAt: now, deleted: '' };
}

// v1 appended "✅ تم إنهاء المهمة" HTML blocks to the plan; those now live in follow-ups.
function stripFinishBlocks_(s) {
  s = String(s || '');
  var i = s.indexOf('<div style="color:#0369a1');
  if (i > -1) s = s.slice(0, i);
  return s.replace(/<[^>]+>/g, '').trim();
}

function createdFromId_(id) {
  var m = String(id).match(/(\d{13})/);
  return m ? new Date(Number(m[1])).toISOString() : '';
}

// ---------- normalisation (mirrors frontend util.js) ----------
function latin_(s) {
  return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
}
function normMrn_(v) { return latin_(v).toUpperCase().replace(/\s+/g, '').replace(/^PAT[-_]?/, '').replace(/[^0-9A-Z\-\/]/g, ''); }
function cleanName_(v) { return latin_(v).replace(/\s+/g, ' ').trim(); }
function normName_(v) {
  return cleanName_(v).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
}
function digits_(v) { var m = latin_(v).match(/\d+/); return m ? m[0] : ''; }
function cleanPhone_(v) {
  var d = latin_(v).replace(/[^\d+]/g, '');
  return /^5\d{8}$/.test(d) ? '0' + d : d;
}
