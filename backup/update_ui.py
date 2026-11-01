import os
import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Add deleteProviderBookings in ui.js
# We can inject `deleteProviderBookings: async function(prov) { ... }` after `deletePCRow: async function`
target_del = """    deletePCRow: async function(id) {
        if(!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
        try {
            await API.deletePostClinicBooking(id);
            UI.showToast("تم حذف السجل");
            UI.renderPostClinicBookings();
        } catch(err) {
            UI.showToast("فشل الحذف", "error");
        }
    },"""
replace_del = """    deletePCRow: async function(id) {
        if(!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
        try {
            await API.deletePostClinicBooking(id);
            UI.showToast("تم حذف السجل");
            UI.renderPostClinicBookings();
        } catch(err) {
            UI.showToast("فشل الحذف", "error");
        }
    },
    deleteProviderBookings: async function(providerName) {
        if(!confirm(`هل أنت متأكد من حذف كافة بيانات د. ${providerName} نهائياً؟`)) return;
        UI.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري المسح الشامل...</p></div>';
        try {
            await API.deleteProviderBookings(providerName);
            UI.showToast(`تم مسح بيانات د. ${providerName} بنجاح!`);
            UI.activePCTab = null; // reset active tab
            UI.renderPostClinicBookings();
        } catch(err) {
            console.error(err);
            UI.showToast("فشل المسح", "error");
            UI.renderPostClinicBookings();
        }
    },"""
if target_del in content:
    content = content.replace(target_del, replace_del)
    print("Injected UI.deleteProviderBookings")

# Replace renderPostClinicBookings mapping code
start_marker = "        let rows = data.map(b => {"
end_marker = "                <div id=\"pc-list\" style=\"display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: stretch; justify-content: center;\">\n                    ${rows}\n                </div>"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    new_html = """        let providers = [...new Set(data.map(d => d.providerName ? String(d.providerName).trim() : 'غير محدد'))];
        if (providers.length === 0) providers = ['غير محدد'];
        
        if (!this.activePCTab || !providers.includes(this.activePCTab)) {
            this.activePCTab = providers[0];
        }

        let tabsHTML = `<div class="pc-tabs no-print" style="display:flex; gap:12px; margin-bottom:24px; overflow-x:auto; padding-bottom:8px; align-items:center;">`;
        providers.forEach(prov => {
            let isActive = prov === this.activePCTab;
            let provData = data.filter(b => (b.providerName ? String(b.providerName).trim() : 'غير محدد') === prov);
            let activeStyle = isActive ? `background:var(--primary); color:white; border-color:var(--primary); box-shadow:0 4px 6px rgba(15,118,110,0.2);` : `background:#fff; color:var(--text); border-color:var(--border); opacity:0.8;`;
            let activeCountStyle = isActive ? `background:rgba(255,255,255,0.3); color:white;` : `background:var(--bg-light); color:var(--text-muted);`;
            tabsHTML += `<button onclick="UI.activePCTab='${prov}'; UI.renderPostClinicBookings();" style="padding:10px 20px; border-radius:30px; font-weight:800; cursor:pointer; font-size:1rem; white-space:nowrap; border:2px solid; transition:all 0.2s; ${activeStyle}">👨‍⚕️ د. ${prov} <span style="border-radius:10px; padding:2px 8px; margin-right:8px; font-size:0.85rem; ${activeCountStyle}">${provData.length}</span></button>`;
        });
        tabsHTML += `</div>`;

        let activeData = data.filter(b => (b.providerName ? String(b.providerName).trim() : 'غير محدد') === this.activePCTab);

        let rows = activeData.map(b => {
             let customData = {};
             if(b.customData) try { customData = JSON.parse(b.customData); } catch(e){}

             let dynamicFields = this.pcCustomColumns.map(col => `
                 <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; margin-bottom:4px;">
                     <label style="font-size:0.8rem; color:var(--text-muted); font-weight:800; margin:0;">${col}</label>
                     <input type="text" class="pc-input" value="${customData[col] || ''}" onchange="UI.updatePCRow('${b.id}', 'custom_${col}', this.value)" style="background:#fff; width:65%; padding:4px 6px; font-size:0.85rem;">
                 </div>
             `).join('');

             return `
             <div class="pc-dossier-card" id="tr-${b.id}" style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:16px; box-shadow:0 2px 10px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px; min-width:300px; max-width: 100%;">
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:var(--primary); font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">👤 Patient Name</label>
                     <textarea class="pc-input pc-name-input" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)" style="resize:vertical; min-height:45px; height:45px; overflow:hidden; font-size:1.15rem; font-weight:800; color:#0f766e; background:#f0fdfa; border:2px solid #0d9488; box-shadow:0 4px 6px -1px rgba(13,148,136,0.15);" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${b.patientName || ''}</textarea>
                 </div>
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Code</label>
                         <input type="text" class="pc-input" value="${b.patientCode || ''}" onchange="UI.updatePCRow('${b.id}', 'patientCode', this.value)" style="font-family:monospace; font-weight:700;">
                     </div>
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Age</label>
                         <input type="text" class="pc-input" value="${b.patientAge || ''}" onchange="UI.updatePCRow('${b.id}', 'patientAge', this.value)" style="text-align:center;">
                     </div>
                 </div>
                 <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Phone</label>
                         <input type="text" class="pc-input" value="${b.phoneNumber || ''}" onchange="UI.updatePCRow('${b.id}', 'phoneNumber', this.value)" style="direction:ltr;">
                     </div>
                 </div>
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:#b45309; font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">📋 Treatment Plan</label>
                     <textarea class="pc-input" onchange="UI.updatePCRow('${b.id}', 'treatmentPlan', this.value)" onkeydown="if(event.key==='Enter' && !event.shiftKey) { this.blur(); event.preventDefault(); }" style="resize:vertical; min-height:85px; width:100%; border:2px solid #f59e0b; background:#fffbeb; font-size:1.1rem; font-weight:600; color:#92400e; box-shadow:0 4px 6px -1px rgba(245,158,11,0.15); line-height:1.6;">${b.treatmentPlan || ''}</textarea>
                 </div>
                 <div style="display:flex; flex-direction:column; gap:12px; background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; margin-top: auto;">
                     <div style="display: flex; justify-content: space-between; align-items: center;">
                         <label style="margin:0; display:flex; align-items:center; gap:8px; cursor:pointer;">
                             <input type="checkbox" class="modern-checkbox" ${b.notifiedPatient === 'Y' ? 'checked' : ''} onchange="UI.updatePCRow('${b.id}', 'notifiedPatient', this.checked ? 'Y' : 'N')" style="transform:scale(1.2);">
                             <strong style="color:var(--primary); font-size:0.9rem;">تم التبليغ ✅</strong>
                         </label>
                     </div>
                     <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                         <strong style="font-size:0.85rem; color:var(--text-muted);">OPC Appt:</strong>
                         <input type="date" class="pc-input" style="padding: 4px 6px; font-size:0.85rem; width:150px; display:inline-block;" value="${b.opcDate || ''}" onchange="UI.updatePCRow('${b.id}', 'opcDate', this.value)">
                     </div>
                     <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                         <div class="dos-field" style="display:flex; flex-direction:row; align-items:center; gap:4px; max-width:100%;">
                             <label style="margin:0; font-size:0.8rem; font-weight:800; color:var(--text-muted);">Permit:</label>
                             <select class="pc-select ${b.permit === 'Y' ? 'yes' : b.permit === 'N' ? 'no' : ''}" onchange="this.className='pc-select '+(this.value==='Y'?'yes':this.value==='N'?'no':''); UI.updatePCRow('${b.id}', 'permit', this.value)" style="background:#fff; padding:4px; font-size:0.8rem; flex:1;">
                                 <option value="">-</option>
                                 <option value="Y" ${b.permit === 'Y' ? 'selected' : ''}>Y</option>
                                 <option value="N" ${b.permit === 'N' ? 'selected' : ''}>N</option>
                             </select>
                         </div>
                         <div class="dos-field" style="display:flex; flex-direction:row; align-items:center; gap:4px; max-width:100%;">
                             <label style="margin:0; font-size:0.8rem; font-weight:800; color:var(--text-muted);">Referral:</label>
                             <select class="pc-select ${b.referral === 'Y' ? 'yes' : b.referral === 'N' ? 'no' : ''}" onchange="this.className='pc-select '+(this.value==='Y'?'yes':this.value==='N'?'no':''); UI.updatePCRow('${b.id}', 'referral', this.value)" style="background:#fff; padding:4px; font-size:0.8rem; flex:1;">
                                 <option value="">-</option>
                                 <option value="Y" ${b.referral === 'Y' ? 'selected' : ''}>Y</option>
                                 <option value="N" ${b.referral === 'N' ? 'selected' : ''}>N</option>
                             </select>
                         </div>
                     </div>
                     ${dynamicFields}
                     <button class="btn btn-danger" style="margin-top:4px; padding:6px; width:100%; background:#fee2e2; color:#ef4444; border:none; font-weight:bold; border-radius:6px; cursor:pointer;" onclick="UI.deletePCRow('${b.id}')">🗑️ حذف الملف</button>
                 </div>
             </div>
             `;
        }).join('');

        this.container.innerHTML = `
            <div class="card" style="background:transparent; box-shadow:none; padding:0;">
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap:wrap; gap:16px; background:#fff; padding:20px; border-radius:12px; box-shadow:var(--shadow-sm);">
                    <div>
                        <h3 style="margin-bottom:8px;">عقود ما بعد العيادة (لجان الأطباء)</h3>
                        <p style="color:var(--text-muted); font-size:0.95rem; margin:0;">اختر التبويب الخاص بالطبيب لمعاينة وطباعة مرضاه المخصصين.</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                        <input type="file" id="excel-import" accept=".xlsx, .xls, .csv" style="display:none;" onchange="UI.handleExcelImport(event)">
                        <button class="btn btn-primary" style="background:#10b981; color:white; border:none; border-radius:8px; padding:10px 16px;" onclick="document.getElementById('excel-import').click()">📥 استيراد Excel</button>
                        <button class="btn btn-primary" style="border:1px solid var(--border); border-radius:8px; padding:10px 16px; background:#fff; color:var(--text);" onclick="UI.addPCColumn()">+ مساحة مخصصة</button>
                        <button class="btn btn-primary" onclick="UI.printPostClinicTable()" style="background:#334155; border:none; border-radius:8px; padding:10px 16px; color:#fff;">🖨️ طباعة للجنة</button>
                        ${this.activePCTab && this.activePCTab !== 'غير محدد' ? `<button class="btn btn-danger" onclick="UI.deleteProviderBookings('${this.activePCTab}')" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:10px 16px;">🗑️ تفريغ كافة حقول د. ${this.activePCTab}</button>` : ''}
                    </div>
                </div>
                
                ${tabsHTML}
                
                <div id="pc-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: stretch; justify-content: center;">
                    ${activeData.length > 0 ? rows : '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted); font-size:1.1rem; background:#fff; border-radius:12px; border:1px dashed #cbd5e1;">لا يوجد مرضى لهذا الطبيب. قم باستيراد ملف.</div>'}
                </div>"""
    content = content[:start_idx] + new_html + content[end_idx:]
    print("Replaced render logic successfully.")
else:
    print("Failed to find replacement indices")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
