import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\backend\code.gs'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# 1. Add sessionDate to Schema
target_tables = """"PostClinicBookings": ["id", "patientName", "patientCode", "patientAge", "providerName", "treatmentPlan", "opcDate", "phoneNumber", "permit", "referral", "notifiedPatient", "customData"],
    "NewCasesMeeting": ["id", "patientName", "patientId", "briefHistory", "treatmentPlan", "primaryPhysician", "notes", "customData"]"""
replace_tables = """"PostClinicBookings": ["id", "patientName", "patientCode", "patientAge", "providerName", "treatmentPlan", "opcDate", "phoneNumber", "permit", "referral", "notifiedPatient", "sessionDate", "customData"],
    "NewCasesMeeting": ["id", "patientName", "patientId", "briefHistory", "treatmentPlan", "primaryPhysician", "notes", "sessionDate", "customData"]"""

content = content.replace(target_tables, replace_tables)

# 2. Add sessionDate passing to doPost
target_postclinic_delete = """      case 'DELETE_PROVIDER_POSTCLINIC':
        deleteProviderFromTable("PostClinicBookings", payload.providerName);"""
replace_postclinic_delete = """      case 'DELETE_PROVIDER_POSTCLINIC':
        deleteProviderFromTable("PostClinicBookings", payload.providerName, payload.sessionDate);"""
content = content.replace(target_postclinic_delete, replace_postclinic_delete)

target_newcases_delete = """      case 'DELETE_PROVIDER_NEW_CASES':
        deleteProviderFromTable("NewCasesMeeting", payload.providerName);"""
replace_newcases_delete = """      case 'DELETE_PROVIDER_NEW_CASES':
        deleteProviderFromTable("NewCasesMeeting", payload.providerName, payload.sessionDate);"""
content = content.replace(target_newcases_delete, replace_newcases_delete)

# 3. Update deleteProviderFromTable definition
target_del = """function deleteProviderFromTable(sheetName, providerName) {"""
replace_del = """function deleteProviderFromTable(sheetName, providerName, sessionDate) {"""
content = content.replace(target_del, replace_del)

# 4. Update the logic inside deleteProviderFromTable
target_del_logic = """    let keepRows = [data[0]];
    for (let i = 1; i < data.length; i++) {
        if(data[i][pIndex] !== providerName) {
            keepRows.push(data[i]);
        }
    }"""
replace_del_logic = """    let sIndex = headers.indexOf("sessionDate");
    let hasSession = (sIndex !== -1 && sessionDate != null);

    let keepRows = [data[0]];
    for (let i = 1; i < data.length; i++) {
        let matchingProvider = data[i][pIndex] === providerName;
        let matchingSession = hasSession ? (data[i][sIndex] === sessionDate) : true;
        
        // Only delete if BOTH provider AND (sessionDate if provided) match perfectly
        if(matchingProvider && matchingSession) {
            // Drop row (do not push to keepRows)
        } else {
            keepRows.push(data[i]);
        }
    }"""
content = content.replace(target_del_logic, replace_del_logic)

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("Updated code.gs for daily archiving.")
