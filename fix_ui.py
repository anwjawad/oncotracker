import re
import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'

with open(js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the EXACT index of:
# <div class="no-print" style="margin                let uploadPromises = [];
# and the EXACT index of:
# UI.renderPostClinicBookings();\n    },

idx_start = content.find('<div class="no-print" style="margin')
idx_end_fragment = 'UI.renderPostClinicBookings();\n    },'
idx_end = content.find(idx_end_fragment, idx_start)

if idx_start != -1 and idx_end != -1:
    idx_end += len(idx_end_fragment)
    
    clean_replacement = """<div class="no-print" style="margin-top:16px;">
                    <button class="btn btn-primary" style="padding:8px 24px;" onclick="UI.addPostClinicRow()">+ إضافة صف يدوياً</button>
                </div>
            </div>
        `;
    },

    updatePCRow: async function(id, field, value) {
        let allData = await API.getPostClinicBookings();
        let row = allData.find(r => r.id === id);
        if(!row) return;

        if (field.startsWith('custom_')) {
            let actualKey = field.replace('custom_', '');
            let cData = {};
            if(row.customData) try { cData = JSON.parse(row.customData); } catch(e){}
            cData[actualKey] = value;
            row.customData = JSON.stringify(cData);
        } else {
            row[field] = value;
        }

        let tr = document.getElementById('tr-' + id);
        if(tr) tr.style.opacity = '0.6';
        
        await API.updatePostClinicBooking(row);
        
        if(tr) tr.style.opacity = '1';
    },

    deletePCRow: async function(id) {
        if(!confirm("هل أنت متأكد من حذف هذا الصف نهائياً؟")) return;
        let tr = document.getElementById('tr-' + id);
        if(tr) tr.style.opacity = '0.3';
        
        await API.deletePostClinicBooking(id);
        UI.renderPostClinicBookings();
    },

    addPostClinicRow: async function() {
        let newData = {
            id: 'PC' + new Date().getTime(),
            patientName: '', patientCode: '', patientAge: '', providerName: '',
            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', notifiedPatient: '', customData: ''
        };
        await API.createPostClinicBooking(newData);
        UI.renderPostClinicBookings();
    },"""

    # Do string splice
    # Wait, the idx_start matches `<div class...` which has indentation before it.
    # We strip the spaces before it or just start replacing exactly where `<div` started.
    
    content = content[:idx_start] + clean_replacement + content[idx_end:]
    print("Found and replaced the garbage.")
else:
    print(f"Failed to find indices. Start: {idx_start}, End: {idx_end}")

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File cleaned successfully. len(content) is {len(content)}")
