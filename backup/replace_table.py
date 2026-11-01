import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = "        let dynamicHeadersRow = this.pcCustomColumns.map(col => `<th>${col}</th>`).join('');"
end_marker = "                </table>"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    
    new_html = """        let rows = data.map(b => {
             let customData = {};
             if(b.customData) try { customData = JSON.parse(b.customData); } catch(e){}

             let dynamicFields = this.pcCustomColumns.map(col => `
                 <div class="dos-field" style="flex:1; min-width:120px;">
                     <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">${col}</label>
                     <input type="text" class="pc-input" value="${customData[col] || ''}" onchange="UI.updatePCRow('${b.id}', 'custom_${col}', this.value)" style="background:#fff;">
                 </div>
             `).join('');

             return `
             <div class="pc-dossier-card" id="tr-${b.id}" style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
                 <div class="dos-top" style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end;">
                     <div class="dos-field" style="flex:2; min-width:220px; display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">Patient Name</label>
                         <textarea class="pc-input pc-name-input" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)" style="resize:vertical; min-height:42px; height:42px; overflow:hidden;" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${b.patientName || ''}</textarea>
                     </div>
                     <div class="dos-field" style="flex:1; min-width:130px; display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">Code</label>
                         <input type="text" class="pc-input" value="${b.patientCode || ''}" onchange="UI.updatePCRow('${b.id}', 'patientCode', this.value)" style="font-family:monospace; font-weight:700;">
                     </div>
                     <div class="dos-field" style="width:70px; display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">Age</label>
                         <input type="text" class="pc-input" value="${b.patientAge || ''}" onchange="UI.updatePCRow('${b.id}', 'patientAge', this.value)" style="text-align:center;">
                     </div>
                     <div class="dos-field" style="flex:1.5; min-width:160px; display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">Provider Name</label>
                         <input type="text" class="pc-input" value="${b.providerName || ''}" onchange="UI.updatePCRow('${b.id}', 'providerName', this.value)">
                     </div>
                     <div class="dos-field" style="flex:1.2; min-width:140px; display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">Phone Number</label>
                         <input type="text" class="pc-input" value="${b.phoneNumber || ''}" onchange="UI.updatePCRow('${b.id}', 'phoneNumber', this.value)" style="direction:ltr;">
                     </div>
                     <div class="dos-field" style="flex:1; min-width:130px; display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">OPC Appt Date</label>
                         <input type="date" class="pc-input" value="${b.opcDate || ''}" onchange="UI.updatePCRow('${b.id}', 'opcDate', this.value)" style="font-weight:700; color:var(--primary);">
                     </div>
                 </div>
                 
                 <div class="dos-middle" style="margin-top:20px;">
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:6px;">Treatment Plan</label>
                         <textarea class="pc-input" onchange="UI.updatePCRow('${b.id}', 'treatmentPlan', this.value)" onkeydown="if(event.key==='Enter' && !event.shiftKey) { this.blur(); event.preventDefault(); }" style="resize:vertical; min-height:80px; width:100%; border-color:#94a3b8; font-size:1.05rem;">${b.treatmentPlan || ''}</textarea>
                     </div>
                 </div>
                 
                 <div class="dos-bottom" style="display:flex; flex-wrap:wrap; gap:20px; margin-top:20px; align-items:center; background:#f8fafc; padding:14px 20px; border-radius:10px; border:1px solid #e2e8f0;">
                     <label style="margin:0; display:flex; align-items:center; gap:8px; cursor:pointer;">
                         <input type="checkbox" class="modern-checkbox" ${b.notifiedPatient === 'Y' ? 'checked' : ''} onchange="UI.updatePCRow('${b.id}', 'notifiedPatient', this.checked ? 'Y' : 'N')" style="transform:scale(1.2);">
                         <strong style="color:var(--primary);">تم تبليغ المريض ✅</strong>
                     </label>
                     
                     <div class="dos-field" style="display:flex; flex-direction:row; align-items:center; gap:8px;">
                         <label style="margin:0; font-size:0.85rem; font-weight:800; color:var(--text-muted);">Permit:</label>
                         <select class="pc-select ${b.permit === 'Y' ? 'yes' : b.permit === 'N' ? 'no' : ''}" onchange="this.className='pc-select '+(this.value==='Y'?'yes':this.value==='N'?'no':''); UI.updatePCRow('${b.id}', 'permit', this.value)" style="background:#fff;">
                             <option value="">-</option>
                             <option value="Y" ${b.permit === 'Y' ? 'selected' : ''}>Y (نعم)</option>
                             <option value="N" ${b.permit === 'N' ? 'selected' : ''}>N (لا)</option>
                         </select>
                     </div>

                     <div class="dos-field" style="display:flex; flex-direction:row; align-items:center; gap:8px;">
                         <label style="margin:0; font-size:0.85rem; font-weight:800; color:var(--text-muted);">Referral:</label>
                         <select class="pc-select ${b.referral === 'Y' ? 'yes' : b.referral === 'N' ? 'no' : ''}" onchange="this.className='pc-select '+(this.value==='Y'?'yes':this.value==='N'?'no':''); UI.updatePCRow('${b.id}', 'referral', this.value)" style="background:#fff;">
                             <option value="">-</option>
                             <option value="Y" ${b.referral === 'Y' ? 'selected' : ''}>Y (نعم)</option>
                             <option value="N" ${b.referral === 'N' ? 'selected' : ''}>N (لا)</option>
                         </select>
                     </div>
                     
                     ${dynamicFields}
                     
                     <div class="no-print" style="margin-right:auto;">
                         <button class="btn btn-danger" style="padding:6px 14px; background:#fee2e2; color:#ef4444; border:none; font-weight:bold; border-radius:6px; cursor:pointer;" onclick="UI.deletePCRow('${b.id}')">🗑️ حذف الملف</button>
                     </div>
                 </div>
             </div>
             `;
        }).join('');

        this.container.innerHTML = `
            <div class="card" style="background:transparent; box-shadow:none; padding:0;">
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap:wrap; gap:16px; background:#fff; padding:20px; border-radius:12px; box-shadow:var(--shadow-sm);">
                    <div>
                        <h3 style="margin-bottom:8px;">تنظيم حجوزات ما بعد العيادة</h3>
                        <p style="color:var(--text-muted); font-size:0.95rem; margin:0;">نمط الملفات الطبية الذكية. يتم المزامنة مباشرة مع السحابة.</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <input type="file" id="excel-import" accept=".xlsx, .xls, .csv" style="display:none;" onchange="UI.handleExcelImport(event)">
                        <button class="btn btn-primary" style="background:#10b981; color:white;" onclick="document.getElementById('excel-import').click()">📥 استيراد Excel</button>
                        <button class="btn btn-primary" onclick="UI.addPCColumn()">+ إضافة حقل</button>
                        <button class="btn btn-primary" onclick="window.print()" style="background:#334155;">🖨️ طباعة</button>
                    </div>
                </div>
                
                <div id="pc-list">
                    ${rows}
                </div>"""
                
    text = text[:start_idx] + new_html + text[end_idx:]
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Table replaced with DOSSIER layout successfully.")
else:
    print("Could not find boundaries.")
