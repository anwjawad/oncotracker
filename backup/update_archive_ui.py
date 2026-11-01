import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# === POST CLINIC BOOKINGS ===

# 1. renderPostClinicBookings filter
t_rend_pc = """        let data = await API.getPostClinicBookings();"""
r_rend_pc = """        let allData = await API.getPostClinicBookings();
        let data = allData.filter(d => d.sessionDate === window.globalArchiveDate);"""
content = content.replace(t_rend_pc, r_rend_pc)

# 2. Add PostClinic Row (Manual)
t_add_pc = """patientCode: '', patientAge: '', providerName: '',"""
r_add_pc = """patientCode: '', patientAge: '', providerName: '', sessionDate: window.globalArchiveDate,"""
content = content.replace(t_add_pc, r_add_pc)

# 3. PostClinic Excel Import
t_excel_pc = """notifiedPatient: '', customData: ''"""
r_excel_pc = """notifiedPatient: '', sessionDate: window.globalArchiveDate, customData: ''"""
content = content.replace(t_excel_pc, r_excel_pc)

# 4. deleteProviderBookings
t_del_prov_pc = """    deleteProviderBookings: async function(providerName) {
        if(!confirm(`هل أنت متأكد من مسح كافة بيانات د. ${providerName} نهائياً وبلا رجعة؟`)) return;"""
r_del_prov_pc = """    deleteProviderBookings: async function(providerName) {
        if(!confirm(`هل أنت متأكد من مسح كافة بيانات د. ${providerName} لتاريخ ${window.globalArchiveDate}؟`)) return;"""
content = content.replace(t_del_prov_pc, r_del_prov_pc)

t_del_prov_pc2 = """            await API.deleteProviderBookings(providerName);"""
r_del_prov_pc2 = """            await API.deleteProviderBookings(providerName, window.globalArchiveDate);"""
content = content.replace(t_del_prov_pc2, r_del_prov_pc2)

# 5. UI Button text for Delete Provider (pc)
t_btn_pc = """🗑️ تفريغ كافة حقول د. ${this.activePCTab}</button>` : ''}"""
r_btn_pc = """🗑️ حذف ملفات د. ${this.activePCTab} لتاريخ ${window.globalArchiveDate}</button>` : ''}"""
content = content.replace(t_btn_pc, r_btn_pc)

# 6. printPostClinic filter
t_print_pc = """        let data = this.activePCTab ? allData.filter(b => (b.providerName ? String(b.providerName).trim() : 'غير محدد') === this.activePCTab) : allData;"""
r_print_pc = """        let sessionData = allData.filter(b => b.sessionDate === window.globalArchiveDate);
        let data = this.activePCTab ? sessionData.filter(b => (b.providerName ? String(b.providerName).trim() : 'غير محدد') === this.activePCTab) : sessionData;"""
content = content.replace(t_print_pc, r_print_pc)


# === NEW CASES MEETING ===

# 1. renderNewCasesMeeting filter
t_rend_nc = """        let data = await API.getNewCasesMeeting();"""
r_rend_nc = """        let allDataNC = await API.getNewCasesMeeting();
        let data = allDataNC.filter(d => d.sessionDate === window.globalArchiveDate);"""
content = content.replace(t_rend_nc, r_rend_nc)

# 2. Add NewCase Row (Manual)
t_add_nc = """patientName: '', patientId: '', briefHistory: '', treatmentPlan: '', primaryPhysician: '', notes: '', customData: ''"""
r_add_nc = """patientName: '', patientId: '', briefHistory: '', treatmentPlan: '', primaryPhysician: '', notes: '', sessionDate: window.globalArchiveDate, customData: ''"""
content = content.replace(t_add_nc, r_add_nc)

# 3. NewCases Excel Import
t_excel_nc = """briefHistory: '', treatmentPlan: '', notes: '', customData: ''"""
r_excel_nc = """briefHistory: '', treatmentPlan: '', notes: '', sessionDate: window.globalArchiveDate, customData: ''"""
content = content.replace(t_excel_nc, r_excel_nc)

# 4. printNewCases filter
t_print_nc = """        let data = await API.getNewCasesMeeting();"""
r_print_nc = """        let allDataNC_p = await API.getNewCasesMeeting();
        let data = allDataNC_p.filter(d => d.sessionDate === window.globalArchiveDate);"""
content = content.replace(t_print_nc, r_print_nc)


with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("Updated ui.js.")
