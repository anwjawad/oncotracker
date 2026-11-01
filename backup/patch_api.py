import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\api.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

target = """    createPostClinicBooking: async function(data) {
        let res = await this._fetchGAS('CREATE_POSTCLINIC', { data: data });
        return res ? res.data : null;
    },"""

replace = """    createPostClinicBooking: async function(data) {
        let res = await this._fetchGAS('CREATE_POSTCLINIC', { data: data });
        return res ? res.data : null;
    },
    
    createBatchPostClinicBookings: async function(dataArray) {
        let res = await this._fetchGAS('BATCH_ADD_POSTCLINIC', { data: dataArray });
        return res ? res.data : null;
    },"""

if target in content:
    content = content.replace(target, replace)
    with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
    print("API.js patched successfully.")
else:
    print("Target not found in api.js")
