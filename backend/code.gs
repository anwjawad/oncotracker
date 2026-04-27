/**
 * Oncology Coordinator System - Google Apps Script Backend
 * 
 * INSTRUCTIONS:
 * 1. Open Google Sheets.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this entire code, overwriting the default Code.gs.
 * 4. Select the 'setupDatabase' function from the dropdown at the top and press 'Run'.
 *    - (You will be prompted to authorize the script; proceed to allow).
 * 5. Click 'Deploy' > 'New Deployment'.
 * 6. Type: 'Web App', Access: 'Anyone'.
 * 7. Copy the Web App URL and paste it into 'api.js' in the VSCode frontend.
 */

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const tables = {
    "Patients": ["id", "name", "mrn", "doctor", "status", "createdAt", "source"],
    "Cases": ["id", "patientName", "type", "status", "dueDate", "priority"],
    "Tasks": ["id", "caseId", "taskName", "status", "dueDate"],
    "Admissions": ["patientName", "mrn", "date", "type", "location"],
    "PortCath": ["patientName", "status", "date"],
    "Communications": ["caseId", "type", "to", "date", "outcome"],
    "PostClinicBookings": ["id", "patientName", "patientCode", "patientAge", "providerName", "treatmentPlan", "opcDate", "phoneNumber", "permit", "referral", "notifiedPatient", "sessionDate", "customData", "followUpStatus", "followUpNotes"],
    "NewCasesMeeting": ["id", "patientName", "patientId", "briefHistory", "treatmentPlan", "primaryPhysician", "notes", "sessionDate", "customData"]
  };
  
  for (const [sheetName, headers] of Object.entries(tables)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
      
      // Auto-resize columns
      sheet.autoResizeColumns(1, headers.length);
    } else {
      // Migration: Ensure new columns exist for existing sheets
      let currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      headers.forEach(h => {
        if (!currentHeaders.includes(h)) {
          sheet.insertColumnAfter(sheet.getLastColumn());
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h)
            .setFontWeight("bold").setBackground("#e2e8f0");
        }
      });
    }
  }
}

function doPost(e) {
  let response = { success: false, message: 'Invalid Request', data: null };
  
  try {
    let requestBody = JSON.parse(e.postData.contents);
    let action = requestBody.action;
    let payload = requestBody.payload || {};
    
    switch(action) {
      case 'SYNC_ALL':
        response.data = getSyncAllData();
        response.success = true;
        break;
      case 'GET_DASHBOARD':
        response.data = getDashboardData();
        response.success = true;
        break;
      case 'GET_PATIENTS':
        response.data = getTableData("Patients");
        response.success = true;
        break;
      case 'CREATE_PATIENT':
        response.data = addRowToTable("Patients", payload.data);
        response.success = true;
        break;
      case 'GET_CASES':
        response.data = getTableData("Cases");
        response.success = true;
        break;
      case 'CREATE_CASE':
        let createdCase = addRowToTable("Cases", payload.caseData);
        let createdTasks = [];
        if (payload.tasksData && Array.isArray(payload.tasksData)) {
            payload.tasksData.forEach(task => {
               createdTasks.push(addRowToTable("Tasks", task));
            });
        }
        response.data = { case: createdCase, tasks: createdTasks };
        response.success = true;
        break;
      case 'GET_ADMISSIONS':
        response.data = getTableData("Admissions");
        response.success = true;
        break;
      case 'CREATE_ADMISSION':
        response.data = addRowToTable("Admissions", payload.data);
        response.success = true;
        break;
      case 'GET_TASKS':
        let allTasks = getTableData("Tasks");
        response.data = payload.caseId ? allTasks.filter(t => t.caseId === payload.caseId) : allTasks;
        response.success = true;
        break;
      case 'UPDATE_TASK':
        let updatedTask = updateRowInTable("Tasks", payload.taskData);
        checkAndCompleteCase(updatedTask.caseId);
        response.data = updatedTask;
        response.success = true;
        break;
      case 'GET_PORTCATH':
        response.data = getTableData("PortCath");
        response.success = true;
        break;
      case 'CREATE_PORTCATH':
        response.data = addRowToTable("PortCath", payload.data);
        response.success = true;
        break;
      case 'GET_COMMUNICATIONS':
        response.data = getTableData("Communications");
        response.success = true;
        break;
      case 'CREATE_COMMUNICATION':
        response.data = addRowToTable("Communications", payload.data);
        response.success = true;
        break;
      case 'GET_POSTCLINIC':
        response.data = getTableData("PostClinicBookings");
        response.success = true;
        break;
      case 'GET_NEW_CASES':
        response.data = getTableData("NewCasesMeeting");
        response.success = true;
        break;
      case 'CREATE_NEW_CASE':
        response.data = addRowToTable("NewCasesMeeting", payload.data);
        response.success = true;
        break;
      case 'BATCH_ADD_NEW_CASES':
        response.data = batchAddRows("NewCasesMeeting", payload.data);
        response.success = true;
        break;
      case 'UPDATE_NEW_CASE':
        response.data = updateRowInTable("NewCasesMeeting", payload.data);
        response.success = true;
        break;
      case 'DELETE_PROVIDER_NEW_CASES':
        deleteProviderFromTable("NewCasesMeeting", payload.providerName, payload.sessionDate);
        response.data = { deleted: true };
        response.success = true;
        break;
      case 'CREATE_POSTCLINIC':
        response.data = addRowToTable("PostClinicBookings", payload.data);
        response.success = true;
        break;
      case 'BATCH_ADD_POSTCLINIC':
        response.data = batchAddRows("PostClinicBookings", payload.data);
        response.success = true;
        break;
      case 'DELETE_PROVIDER_POSTCLINIC':
        deleteProviderFromTable("PostClinicBookings", payload.providerName, payload.sessionDate);
        response.data = { deleted: true };
        response.success = true;
        break;
      case 'UPDATE_POSTCLINIC':
        response.data = updateRowInTable("PostClinicBookings", payload.data);
        response.success = true;
        break;
      case 'DELETE_ROW':
        deleteRowFromTable(payload.sheetName, payload.id);
        response.data = { deleted: true };
        response.success = true;
        break;
      default:
        response.message = 'Unknown Action: ' + action;
    }
  } catch(error) {
    response.message = error.toString();
  }
  
  // Return JSON response allowing cross-origin requests
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // Simple health check when opening URL directly in browser
  return ContentService.createTextOutput(JSON.stringify({
    status: "Oncology API Running - POST requests required.",
    timestamp: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- Helper Functions ---

function getTableData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only headers or empty
  
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      // Basic formatting for dates if present
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      }
      obj[h.trim()] = val;
    });
    return obj;
  });
}

function addRowToTable(sheetName, obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!obj.id) obj.id = "ID-" + new Date().getTime(); // Simple auto ID
  
  const newRow = headers.map(h => obj[h.trim()] !== undefined ? obj[h.trim()] : "");
  sheet.appendRow(newRow);
  return obj;
}

function updateRowInTable(sheetName, obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found");
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  let idIndex = headers.indexOf("id");
  
  if(idIndex === -1) throw new Error("No id column found in " + sheetName);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === obj.id) {
       let updatedRow = headers.map(h => obj[h.trim()] !== undefined ? obj[h.trim()] : data[i][headers.indexOf(h)]);
       sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
       return obj;
    }
  }
  throw new Error("Row not found with ID: " + obj.id);
}

function deleteRowFromTable(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  let idIndex = headers.findIndex(h => String(h).trim().toLowerCase() === "id");
  
  if(idIndex === -1) throw new Error("No id column found in " + sheetName);
  
  // Normalize target id to string for safe comparison
  const targetId = String(id).trim();
  
  // Iterate in REVERSE so row deletion doesn't shift indices
  for (let i = data.length - 1; i >= 1; i--) {
    const cellId = String(data[i][idIndex]).trim();
    if (cellId === targetId) {
       sheet.deleteRow(i + 1);
       return; // Found and deleted
    }
  }
  // Don't throw — if row not found it may have already been deleted; treat as success
  Logger.log("deleteRowFromTable: Row not found with ID: " + targetId + " in " + sheetName + " (may already be deleted)");
}

function checkAndCompleteCase(caseId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName("Tasks");
  const data = tasksSheet.getDataRange().getValues();
  if (data.length <= 1) return;
  const headers = data[0];
  let cIndex = headers.indexOf("caseId");
  let sIndex = headers.indexOf("status");
  
  let allTasksCompleted = true;
  let hasTasks = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][cIndex] === caseId) {
       hasTasks = true;
       if (data[i][sIndex] !== 'Completed') {
           allTasksCompleted = false;
           break;
       }
    }
  }
  
  if (hasTasks && allTasksCompleted) {
      const casesSheet = ss.getSheetByName("Cases");
      const cData = casesSheet.getDataRange().getValues();
      const cHeaders = cData[0];
      let caseIdIndex = cHeaders.indexOf("id");
      let caseStatusIndex = cHeaders.indexOf("status");
      for (let j = 1; j < cData.length; j++) {
          if (cData[j][caseIdIndex] === caseId && cData[j][caseStatusIndex] !== 'Completed') {
              casesSheet.getRange(j + 1, caseStatusIndex + 1).setValue('Completed');
              break;
          }
      }
  }
}

function getSyncAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Fetch all tables once
  const patients = getTableData("Patients");
  const cases = getTableData("Cases");
  const admissions = getTableData("Admissions");
  const portCath = getTableData("PortCath");
  const communications = getTableData("Communications");
  const tasks = getTableData("Tasks");
  const postClinicBookings = getTableData("PostClinicBookings");
  const newCasesMeeting = getTableData("NewCasesMeeting");

  return {
      dashboard: calculateDashboardStats(patients, cases, tasks, communications),
      patients: patients,
      cases: cases,
      admissions: admissions,
      portCath: portCath,
      communications: communications,
      tasks: tasks,
      postClinicBookings: postClinicBookings,
      newCasesMeeting: newCasesMeeting
  };
}

// Renamed and refactored to accept data
function calculateDashboardStats(patients, cases, tasks, communications) {
  const overdueCount = cases.filter(c => String(c.status).toLowerCase() === 'overdue').length;
  const pendingTasks = tasks.filter(t => String(t.status).toLowerCase() === 'pending').length;
  const waitingReply = communications.filter(c => String(c.outcome).toLowerCase().includes('waiting')).length;
  
  let overdueTasksArray = tasks.filter(t => {
      if(!t.dueDate || t.status === 'Completed') return false;
      return new Date(t.dueDate) < new Date();
  });
  
  return {
    patientsToday: patients.length || 0,
    pendingTasks: pendingTasks || 0,
    waitingReply: waitingReply || 0,
    overdue: overdueCount || 0,
    overdueTasksCount: overdueTasksArray.length
  };
}


function batchAddRows(sheetName, arr) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let rowsToAppend = [];
    arr.forEach(obj => {
       if(!obj.id) obj.id = "ID-" + new Date().getTime() + "-" + Math.floor(Math.random()*10000);
       let newRow = headers.map(h => obj[h.trim()] !== undefined ? obj[h.trim()] : "");
       rowsToAppend.push(newRow);
    });
    if(rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow()+1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }
    return true;
  } catch(e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function deleteProviderFromTable(sheetName, providerName, sessionDate) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getDataRange().getValues();
    
    // Use case-insensitive, trimmed header search
    let pIndex = headers.findIndex(h => String(h).trim().toLowerCase() === "providername");
    let sIndex = headers.findIndex(h => String(h).trim().toLowerCase() === "sessiondate");
    
    // Also try primaryphysician for NewCasesMeeting sheet
    if (pIndex === -1) {
      pIndex = headers.findIndex(h => String(h).trim().toLowerCase() === "primaryphysician");
    }
    
    if(pIndex === -1) throw new Error("No providerName/primaryPhysician column found in " + sheetName);
    
    // Normalize the target values to strings for safe comparison
    const targetProvider = String(providerName || '').trim();
    const hasSession = (sIndex !== -1 && sessionDate != null && sessionDate !== '');
    
    // Normalize sessionDate — Sheets may store as Date object
    const normalizeDate = (val) => {
      if (!val) return '';
      if (val instanceof Date) {
        // Format as yyyy-MM-dd matching the frontend format
        return Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      }
      return String(val).trim();
    };
    
    const targetDate = normalizeDate(sessionDate);

    let keepRows = [data[0]]; // always keep the header row
    for (let i = 1; i < data.length; i++) {
        const rowProvider = String(data[i][pIndex] || '').trim();
        const rowDate = hasSession ? normalizeDate(data[i][sIndex]) : '';
        
        const matchingProvider = rowProvider === targetProvider;
        const matchingSession = hasSession ? (rowDate === targetDate) : true;
        
        // Only delete if BOTH provider AND sessionDate match
        if (matchingProvider && matchingSession) {
            // Drop row (do not push to keepRows)
            Logger.log("Deleting row: provider=" + rowProvider + ", date=" + rowDate);
        } else {
            keepRows.push(data[i]);
        }
    }
    
    sheet.clearContents();
    if (keepRows.length > 0) {
        sheet.getRange(1, 1, keepRows.length, headers.length).setValues(keepRows);
    }
    Logger.log("deleteProviderFromTable done. Kept " + (keepRows.length - 1) + " rows from " + sheetName);
    return true;
  } catch(e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}
