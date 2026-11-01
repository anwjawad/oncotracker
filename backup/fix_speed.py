import os
import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\backend\code.gs'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

target1 = """      tasks: getTableData("Tasks"),
      postClinicBookings: getTableData("PostClinicBookings")
  };"""
replace1 = """      tasks: getTableData("Tasks"),
      postClinicBookings: getTableData("PostClinicBookings"),
      newCasesMeeting: getTableData("NewCasesMeeting")
  };"""

if target1 in content:
    content = content.replace(target1, replace1)
    with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
    print("code.gs synced.")
else:
    print("code.gs target not found.")


api_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\api.js'
with open(api_path, 'r', encoding='utf-8') as f: api_content = f.read()

target2 = """    getNewCasesMeeting: async function(forceRefresh = false) {
        if (this._cache.newCasesMeeting && !forceRefresh) return this._cache.newCasesMeeting;
        let res = await this._fetchGAS('GET_NEW_CASES');
        this._cache.newCasesMeeting = res;
        return res;
    },"""
replace2 = """    getNewCasesMeeting: async function() { await this.initSync(); return this._cache.newCasesMeeting || []; },"""

if target2 in api_content:
    api_content = api_content.replace(target2, replace2)
    with open(api_path, 'w', encoding='utf-8') as f: f.write(api_content)
    print("api.js synced.")
else:
    print("api.js target not found.")
