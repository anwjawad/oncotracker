import os
import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\backend\code.gs'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# 1. Update tables schema
target_tables = """"PostClinicBookings": ["id", "patientName", "patientCode", "patientAge", "providerName", "treatmentPlan", "opcDate", "phoneNumber", "permit", "referral", "notifiedPatient", "customData"]
  };"""
replace_tables = """"PostClinicBookings": ["id", "patientName", "patientCode", "patientAge", "providerName", "treatmentPlan", "opcDate", "phoneNumber", "permit", "referral", "notifiedPatient", "customData"],
    "NewCasesMeeting": ["id", "patientName", "patientId", "briefHistory", "treatmentPlan", "primaryPhysician", "notes", "customData"]
  };"""

if target_tables in content:
    content = content.replace(target_tables, replace_tables)
    print("Added NewCasesMeeting to tables schema.")

# 2. Update doPost switch
target_doPost = """      case 'CREATE_POSTCLINIC':"""
replace_doPost = """      case 'GET_NEW_CASES':
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
        deleteProviderFromTable("NewCasesMeeting", payload.providerName);
        response.data = { deleted: true };
        response.success = true;
        break;
      case 'CREATE_POSTCLINIC':"""

if target_doPost in content:
    content = content.replace(target_doPost, replace_doPost)
    print("Added NewCases endpoints to doPost.")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
