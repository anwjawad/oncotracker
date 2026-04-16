import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\backend\code.gs'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

new_func = """

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
"""

content += new_func

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
