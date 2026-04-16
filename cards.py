import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: text = f.read()

start_marker = "        let rows = data.map(b => {"
end_marker = "                <div id=\"pc-list\">\n                    ${rows}\n                </div>"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    
    new_html = """        let rows = data.map(b => {
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
                 
                 <!-- Top Row: Name -->
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:var(--primary); font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">👤 Patient Name</label>
                     <textarea class="pc-input pc-name-input" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)" style="resize:vertical; min-height:45px; height:45px; overflow:hidden; font-size:1.15rem; font-weight:800; color:#0f766e; background:#f0fdfa; border:2px solid #0d9488; box-shadow:0 4px 6px -1px rgba(13,148,136,0.15);" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${b.patientName || ''}</textarea>
                 </div>
                 
                 <!-- Grid Row: Code, Age -->
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

                 <!-- Grid Row: Provider, Phone -->
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Provider Name</label>
                         <input type="text" class="pc-input" value="${b.providerName || ''}" onchange="UI.updatePCRow('${b.id}', 'providerName', this.value)">
                     </div>
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Phone</label>
                         <input type="text" class="pc-input" value="${b.phoneNumber || ''}" onchange="UI.updatePCRow('${b.id}', 'phoneNumber', this.value)" style="direction:ltr;">
                     </div>
                 </div>

                 <!-- Treatment Plan -->
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:#b45309; font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">📋 Treatment Plan</label>
                     <textarea class="pc-input" onchange="UI.updatePCRow('${b.id}', 'treatmentPlan', this.value)" onkeydown="if(event.key==='Enter' && !event.shiftKey) { this.blur(); event.preventDefault(); }" style="resize:vertical; min-height:85px; width:100%; border:2px solid #f59e0b; background:#fffbeb; font-size:1.1rem; font-weight:600; color:#92400e; box-shadow:0 4px 6px -1px rgba(245,158,11,0.15); line-height:1.6;">${b.treatmentPlan || ''}</textarea>
                 </div>

                 <!-- Footer Actions -->
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
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap:wrap; gap:16px; background:#fff; padding:20px; border-radius:12px; box-shadow:var(--shadow-sm);">
                    <div>
                        <h3 style="margin-bottom:8px;">تنظيم حجوزات ما بعد العيادة</h3>
                        <p style="color:var(--text-muted); font-size:0.95rem; margin:0;">نمط الكروت الذكية (Grid View). يتم المزامنة مباشرة مع السحابة.</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <input type="file" id="excel-import" accept=".xlsx, .xls, .csv" style="display:none;" onchange="UI.handleExcelImport(event)">
                        <button class="btn btn-primary" style="background:#10b981; color:white;" onclick="document.getElementById('excel-import').click()">📥 استيراد</button>
                        <button class="btn btn-primary" onclick="UI.addPCColumn()">+ حقل</button>
                        <button class="btn btn-primary" onclick="UI.printPostClinicTable()" style="background:#334155;">🖨️ طباعة كجدول</button>
                    </div>
                </div>
                
                <div id="pc-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: stretch; justify-content: center;">
                    ${rows}
                </div>"""
                
    text = text[:start_idx] + new_html + text[end_idx:]
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Table replaced with GRID CARDS layout successfully.")
else:
    print("Could not find boundaries. Trying alternate tags.")
