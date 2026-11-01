import os
import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

append_logic = """
    ,
    // ================= NEW CASES MEETING MODULE =================
    
    renderNewCasesMeeting: async function() {
        this.title.textContent = 'لجنة الحالات الجديدة';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري سحب بيانات الحالات...</p></div>';
        
        let data = await API.getNewCasesMeeting();
        
        let rows = (data || []).map(b => {
             return `
             <div class="pc-dossier-card" id="tr-nc-${b.id}" style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:16px; box-shadow:0 2px 10px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px; min-width:300px; max-width: 100%;">
                 
                 <!-- Top Row: Name -->
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:var(--primary); font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">👤 Patient Name</label>
                     <textarea class="pc-input pc-name-input" onchange="UI.updateNewCaseRow('${b.id}', 'patientName', this.value)" style="resize:vertical; min-height:45px; height:45px; overflow:hidden; font-size:1.15rem; font-weight:800; color:#0f766e; background:#f0fdfa; border:2px solid #0d9488; box-shadow:0 4px 6px -1px rgba(13,148,136,0.15);" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${b.patientName || ''}</textarea>
                 </div>
                 
                 <!-- Grid Row: ID, Physician -->
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">🔢 ID / FN number</label>
                         <input type="text" class="pc-input" value="${b.patientId || ''}" onchange="UI.updateNewCaseRow('${b.id}', 'patientId', this.value)" style="font-family:monospace; font-weight:700;">
                     </div>
                     <div class="dos-field" style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">👨‍⚕️ Primary Physician</label>
                         <input type="text" class="pc-input" value="${b.primaryPhysician || ''}" onchange="UI.updateNewCaseRow('${b.id}', 'primaryPhysician', this.value)">
                     </div>
                 </div>

                 <!-- History -->
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:#1d4ed8; font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">📖 Brief history</label>
                     <textarea class="pc-input" onchange="UI.updateNewCaseRow('${b.id}', 'briefHistory', this.value)" style="resize:vertical; min-height:80px; width:100%; border:2px solid #3b82f6; background:#eff6ff; font-size:1.05rem; font-weight:600; color:#1e3a8a; line-height:1.6;">${b.briefHistory || ''}</textarea>
                 </div>

                 <!-- Treatment Plan -->
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:#b45309; font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">📋 Treatment plan</label>
                     <textarea class="pc-input" onchange="UI.updateNewCaseRow('${b.id}', 'treatmentPlan', this.value)" style="resize:vertical; min-height:80px; width:100%; border:2px solid #f59e0b; background:#fffbeb; font-size:1.05rem; font-weight:600; color:#92400e; line-height:1.6;">${b.treatmentPlan || ''}</textarea>
                 </div>
                 
                 <!-- Notes Square -->
                 <div class="dos-field" style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:#475569; font-weight:900; margin-bottom:8px; display:flex; align-items:center; gap:6px;">📝 Notes</label>
                     <textarea class="pc-input" onchange="UI.updateNewCaseRow('${b.id}', 'notes', this.value)" style="resize:vertical; min-height:60px; width:100%; border:1px solid #cbd5e1; background:#f8fafc; font-size:1rem; color:#334155;">${b.notes || ''}</textarea>
                 </div>

                 <!-- Footer Actions -->
                 <div style="display:flex; flex-direction:column; gap:12px; margin-top: auto;">
                     <button class="btn btn-danger" style="padding:6px; width:100%; background:#fee2e2; color:#ef4444; border:none; font-weight:bold; border-radius:6px; cursor:pointer;" onclick="UI.deleteNewCaseRow('${b.id}')">🗑️ حذف الحالة</button>
                 </div>
             </div>
             `;
        }).join('');

        this.container.innerHTML = `
            <div class="card" style="background:transparent; box-shadow:none; padding:0;">
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap:wrap; gap:16px; background:#fff; padding:20px; border-radius:12px; box-shadow:var(--shadow-sm);">
                    <div>
                        <h3 style="margin-bottom:8px;">لجنة الحالات الجديدة (New Cases Meeting)</h3>
                        <p style="color:var(--text-muted); font-size:0.95rem; margin:0;">نمط الكروت لاستعراض الحالات وإضافة تفاصيلها.</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                        <input type="file" id="nc-excel-import" accept=".xlsx, .xls, .csv" style="display:none;" onchange="UI.handleNewCasesExcelImport(event)">
                        <button class="btn btn-primary" style="background:#10b981; color:white; border:none; border-radius:8px; padding:10px 16px;" onclick="document.getElementById('nc-excel-import').click()">📥 استيراد Excel</button>
                        <button class="btn btn-primary" style="border:1px solid var(--border); border-radius:8px; padding:10px 16px; background:#fff; color:var(--text);" onclick="UI.addNewCaseRow()">+ إضافة حالة يدوياً</button>
                        <button class="btn btn-primary" onclick="UI.printNewCasesTable()" style="background:#334155; border:none; border-radius:8px; padding:10px 16px; color:#fff;">🖨️ طباعة للجنة</button>
                    </div>
                </div>
                
                <div id="nc-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; align-items: stretch; justify-content: center;">
                    ${data && data.length > 0 ? rows : '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted); font-size:1.1rem; background:#fff; border-radius:12px; border:1px dashed #cbd5e1;">لا يوجد حالات جديدة مدخلة.</div>'}
                </div>
            </div>
        `;
    },

    updateNewCaseRow: async function(id, field, value) {
        let allData = await API.getNewCasesMeeting();
        let row = allData.find(r => r.id === id);
        if(!row) return;

        row[field] = value;
        try {
            await API.updateNewCaseMeeting(row);
        } catch(err) {
            UI.showToast("خطأ في المزامنة", "error");
        }
    },

    deleteNewCaseRow: async function(id) {
        if(!confirm("هل أنت متأكد من حذف هذه الحالة نهائياً؟")) return;
        let tr = document.getElementById('tr-nc-' + id);
        if(tr) tr.style.opacity = '0.3';
        
        try {
            await API.deleteNewCaseMeeting(id);
            UI.showToast("تم الحذف بنجاح");
            UI.renderNewCasesMeeting();
        } catch(err) {
            UI.showToast("فشل في مسح البيانات", "error");
        }
    },

    addNewCaseRow: async function() {
        let newData = {
            id: 'NC' + new Date().getTime(),
            patientName: '', patientId: '', briefHistory: '', treatmentPlan: '', primaryPhysician: '', notes: '', customData: ''
        };
        UI.container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        await API.createNewCaseMeeting(newData);
        UI.renderNewCasesMeeting();
    },

    handleNewCasesExcelImport: function(event) {
        const file = event.target.files[0];
        if (!file) return;

        UI.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري معالجة ورفع الملف... يرجى الانتظار</p></div>';

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1});

                if (rawData.length < 2) {
                    UI.showToast("الملف فارغ أو لا يحتوي بيانات كافية", "error");
                    return;
                }

                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(10, rawData.length); i++) {
                    let row = rawData[i];
                    if (row && row.some(cell => String(cell).toLowerCase().includes('name'))) {
                        headerRowIdx = i;
                        break;
                    }
                }
                
                if (headerRowIdx === -1) {
                    UI.showToast("لم يتم العثور على عناوين الأعمدة المتوقعة في الملف (يجب أن يحتوي على عمود Name)", "error");
                    UI.renderNewCasesMeeting();
                    return;
                }

                let headers = rawData[headerRowIdx].map(h => String(h || '').toLowerCase().trim());
                
                let nameIdx = headers.findIndex(h => h.includes('name'));
                let codeIdx = headers.findIndex(h => h.includes('mrn') || h.includes('fn') || h.includes('code') || h.includes('id'));
                let providerIdx = headers.findIndex(h => h.includes('provider') || h.includes('physician') || h.includes('doctor'));
                
                if (nameIdx === -1) {
                    UI.showToast("يجب أن يحتوي الملف على عمود الاسم (Name)", "error");
                    UI.renderNewCasesMeeting();
                    return;
                }

                let newBookingsArray = [];

                for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                    let row = rawData[i];
                    if (!row || row.length === 0) continue;

                    let pName = row[nameIdx] || '';
                    let pCode = codeIdx !== -1 ? row[codeIdx] : '';
                    let provider = providerIdx !== -1 ? row[providerIdx] : '';

                    if (pName || pCode) {
                        let cleanCode = pCode ? String(pCode).replace(/^PAT/i, '').trim() : '';

                        let bookingData = {
                            id: 'NC' + new Date().getTime() + "_" + i,
                            patientName: pName ? String(pName).trim() : '',
                            patientId: cleanCode,
                            primaryPhysician: provider ? String(provider).trim() : '',
                            briefHistory: '', treatmentPlan: '', notes: '', customData: ''
                        };
                        newBookingsArray.push(bookingData);
                    }
                }

                if (newBookingsArray.length > 0) {
                    await API.createBatchNewCases(newBookingsArray);
                }
                UI.showToast(`تم استيراد ${newBookingsArray.length} حالة بنجاح! 🎉`);
                UI.renderNewCasesMeeting();
            } catch(err) {
                console.error(err);
                UI.showToast("حدث خطأ أثناء قراءة الملف", "error");
                UI.renderNewCasesMeeting();
            }
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    },

    printNewCasesTable: async function() {
        let data = await API.getNewCasesMeeting();
        
        if(!data || data.length === 0) {
            UI.showToast("لا يوجد بيانات للطباعة", "error");
            return;
        }

        let headers = `<th>Patient name</th><th>ID /FN number</th><th style="width:30%;">Brief history</th><th style="width:30%;">Treatment plan</th><th>Primary Physician</th><th>Notes</th>`;

        let rowsHTML = data.map(b => {
             return `
             <tr>
                 <td style="font-weight:bold;">${b.patientName || ''}</td>
                 <td style="font-family:monospace; white-space:nowrap;">${b.patientId || ''}</td>
                 <td style="white-space:pre-wrap; vertical-align:top; border:2px solid #3b82f6;">${(b.briefHistory || '').replace(/\\n/g, '<br>')}</td>
                 <td style="white-space:pre-wrap; vertical-align:top; border:2px solid #f59e0b;">${(b.treatmentPlan || '').replace(/\\n/g, '<br>')}</td>
                 <td style="vertical-align:top;">${b.primaryPhysician || ''}</td>
                 <td style="white-space:pre-wrap; vertical-align:top;">${(b.notes || '').replace(/\\n/g, '<br>')}</td>
             </tr>`;
        }).join('');

        let printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة لجنة الحالات الجديدة</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    th, td { border: 1px solid #333; padding: 10px; text-align: right; vertical-align: middle; }
                    th { border-bottom: 2px solid #000; background: #f1f5f9; font-size:15px; }
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h2 style="text-align:center; margin-bottom: 20px; color:#1e293b;">جدول لجنة الحالات الجديدة</h2>
                <table>
                    <thead><tr>${headers}</tr></thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
                <script>
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
};
"""

content = re.sub(r'};\s*$', append_logic, content)
with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
