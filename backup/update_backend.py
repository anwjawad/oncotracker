import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\backend\code.gs'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Add switch case
target = """      case 'UPDATE_POSTCLINIC':"""
replace = """      case 'DELETE_PROVIDER_POSTCLINIC':
        deleteProviderFromTable("PostClinicBookings", payload.providerName);
        response.data = { deleted: true };
        response.success = true;
        break;
      case 'UPDATE_POSTCLINIC':"""
if target in content: content = content.replace(target, replace)

# Append function
helper = """
function deleteProviderFromTable(sheetName, providerName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found");
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getDataRange().getValues();
    let pIndex = headers.indexOf("providerName");
    
    if(pIndex === -1) throw new Error("No providerName column found");
    
    let keepRows = [data[0]];
    for (let i = 1; i < data.length; i++) {
        if(data[i][pIndex] !== providerName) {
            keepRows.push(data[i]);
        }
    }
    
    sheet.clearContents();
    if (keepRows.length > 0) {
        sheet.getRange(1, 1, keepRows.length, headers.length).setValues(keepRows);
    }
    return true;
  } catch(e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}
"""
content += helper

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
