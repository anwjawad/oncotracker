const fs = require('fs');
const file = 'C:/Users/palliative/.gemini/antigravity/scratch/oncology-workflow-system/frontend/js/ui.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let startIdx = lines.findIndex(l => l.includes('renderFollowUpView: async function() {'));
let endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('openPrintFollowUpSettings: function() {')) - 1;

let newCode = `    renderFollowUpView: async function() {
        this.title.textContent = 'قسم متابعة المرضى';
        this.container.innerHTML = this.renderSkeleton(5);

        const pcData = await API.getPostClinicBookings();
        const ncData = await API.getNewCasesMeeting();

        let followUps = [];

        pcData.forEach(b => {
            if(b.followUpStatus === 'ACTIVE') {
                followUps.push({
                    id: b.id,
                    source: 'PC',
                    patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientCode || '---',
                    providerName: b.providerName || 'غير محدد',
                    sessionDate: b.sessionDate || '---',
                    followUpNotes: b.followUpNotes || 'لا توجد ملاحظات',
                    notifiedPatient: b.notifiedPatient === 'Y'
                });
            }
        });

        ncData.forEach(b => {
            let cData = this.parseNCCustomData(b.customData);
            if(cData.followUpStatus === 'ACTIVE') {
                followUps.push({
                    id: b.id,
                    source: 'NC',
                    patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientId || '---',
                    providerName: b.primaryPhysician || 'غير محدد',
                    sessionDate: b.sessionDate || '---',
                    followUpNotes: cData.followUpNotes || 'لا توجد ملاحظات',
                    notifiedPatient: cData.notifiedPatient === 'Y'
                });
            }
        });

        followUps.sort((a,b) => new Date(a.sessionDate || 0) - new Date(b.sessionDate || 0));

        let query = (this.followUpSearchQuery || '').toLowerCase().trim();
        let filtered = followUps.filter(b => 
            String(b.patientName).toLowerCase().includes(query) || 
            String(b.patientCode).includes(query) || 
            String(b.followUpNotes).toLowerCase().includes(query) ||
            String(b.providerName).toLowerCase().includes(query)
        );

        let unnotified = filtered.filter(b => !b.notifiedPatient);
        let notified = filtered.filter(b => b.notifiedPatient);

        const generateRows = (arr) => arr.map(b => \`
            <tr style="transition:background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='white'">
                <td style="padding:15px; border-bottom:1px solid #f1f5f9;">
                    <div style="font-weight:900; color:var(--primary);">\${b.patientName}</div>
                    <div style="color:var(--text-muted); font-size:0.8rem; font-family:monospace;">\${b.patientCode}</div>
                </td>
                <td style="padding:15px; border-bottom:1px solid #f1f5f9; font-weight:700; color:#334155;">د. \${b.providerName}</td>
                <td style="padding:15px; border-bottom:1px solid #f1f5f9;">
                    <div style="background:#fffbeb; color:#92400e; padding:8px 12px; border-radius:8px; border-right:4px solid #f59e0b; font-size:0.9rem; max-width:400px;">
                        \${b.followUpNotes}
                    </div>
                </td>
                <td style="padding:15px; border-bottom:1px solid #f1f5f9; font-size:0.85rem; color:#64748b;">\${b.sessionDate}</td>
                <td style="padding:15px; border-bottom:1px solid #f1f5f9; text-align:left;">
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:0.85rem; background:#0f766e;" onclick="\${b.source === 'NC' ? 'window.navigateTo(\\'new-cases\\')' : \`UI.openDossierModal('\${b.id}')\`}">👁️ عرض</button>
                        <button class="btn" style="padding:6px 12px; font-size:0.85rem; background:#f0fdf4; color:#15803d; border:1px solid #86efac;" onclick="UI.finishFollowUp('\${b.id}', '\${b.source}')">✅ إنهاء</button>
                    </div>
                </td>
            </tr>
        \`).join('');

        this.container.innerHTML = \`
            <div class="card animate-fade" style="padding:0; overflow:hidden; border-radius:15px; box-shadow:var(--shadow-lg);">
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; background:#fff; padding:25px; border-bottom:1px solid #f1f5f9;">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <div>
                            <h3 style="margin:0; color:#92400e; display:flex; align-items:center; gap:10px;">
                                <span style="font-size:1.8rem;">🚶</span> سجل مهام المتابعة الشامل
                            </h3>
                            <p style="color:var(--text-muted); font-size:0.9rem; margin:6px 0 0 0;">يجمع كافة الحالات (عيادات ولجنة) التي تحتاج لمتابعة أو تبليغ.</p>
                        </div>
                        <button class="btn btn-primary" onclick="UI.openPrintFollowUpSettings()" style="padding:10px 20px; background:#92400e; border:none; border-radius:10px; display:flex; align-items:center; gap:8px;">
                            <span style="font-size:1.2rem;">🖨️</span> طباعة التقرير الشامل
                        </button>
                    </div>
                    <div style="position:relative; width:350px;">
                        <input type="text" value="\${this.followUpSearchQuery || ''}" 
                               placeholder="بحث باسم المريض أو المهمة..." 
                               oninput="UI.followUpSearchQuery=this.value; UI.renderFollowUpView()"
                               style="width:100%; padding:12px 45px 12px 15px; border-radius:12px; border:2px solid #fdba74; outline:none; font-weight:700;">
                        <span style="position:absolute; right:15px; top:50%; transform:translateY(-50%); font-size:1.2rem; opacity:0.6;">🔍</span>
                    </div>
                </div>

                \${unnotified.length > 0 ? \`
                <div style="background:#fef2f2; border-bottom:2px solid #fca5a5;">
                    <div style="padding:15px 25px; background:#fee2e2; color:#b91c1c; font-weight:900; font-size:1.1rem; border-bottom:1px solid #fecaca; display:flex; align-items:center; gap:8px;">
                        🚨 مرضى بانتظار التبليغ العاجل (\${unnotified.length})
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; min-width:800px;">
                            \${generateRows(unnotified)}
                        </table>
                    </div>
                </div>
                \` : ''}

                <div class="session-stats-bar" style="border-radius:0; margin:0; padding:15px 25px; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                    <div class="stat-chip">
                        <span>📋 إجمالي الحالات قيد المتابعة الروتينية</span>
                        <span class="stat-value" data-target="\${notified.length}">\${notified.length}</span>
                    </div>
                </div>

                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; min-width:800px;">
                        <thead>
                            <tr style="background:#f8fafc; color:var(--text-muted); text-align:right; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">
                                <th style="padding:15px; font-weight:900;">المريض / الكود</th>
                                <th style="padding:15px; font-weight:900;">الجهة (الطبيب)</th>
                                <th style="padding:15px; font-weight:900;">مهمة المتابعة المطلوبة</th>
                                <th style="padding:15px; font-weight:900;">تاريخ الجلسة الأصلية</th>
                                <th style="padding:15px; font-weight:900; text-align:left;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${notified.length > 0 ? generateRows(notified) : '<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8; font-size:1.1rem;">لا توجد مهام متابعة روتينية معلقة حالياً. أحسنت! 🎉</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>\`;
    },

    _updateFollowUp: async function(id, status, notes) {
        UI.showSaving();
        let allData = await API.getPostClinicBookings();
        let row = allData.find(r => r.id === id);
        if(!row) return;

        row.followUpStatus = status;
        if (notes !== undefined) row.followUpNotes = notes;
        
        await API.updatePostClinicBooking(row);
        UI.showToast(status === 'ACTIVE' ? "تم النقل لقسم المتابعة 🚶" : "تم إنهاء المهمة بنجاح ✅");
    },

    toggleFollowUp: async function(id, isActive) {
        if (!isActive) {
            this.finishFollowUp(id);
            return;
        }
        const note = prompt("ما هي المتابعة المطلوبة لهذا المريض؟ (مثال: حجز موعد خزعة، اتصال بالأهل...)");
        if (note === null) {
            let checkbox = document.querySelector(\`input[onchange*="toggleFollowUp('\${id}'"]\`);
            if(checkbox) checkbox.checked = false;
            return; 
        }
        this._updateFollowUp(id, 'ACTIVE', note);
    },

    finishFollowUp: async function(id, source = 'PC') {
        const note = prompt("ماذا فعلت مع المريض لإغلاق هذه المهمة؟\\n(سيتم تسجيل هذا النص في خطة العلاج بلون مختلف)");
        if (note === null) return; 

        UI.showSaving();
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-EG') + ' ' + now.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
        const followUpEntry = \`\\n<div style="color:#0369a1; font-weight:bold; margin-top:12px; border-top:1px dashed #bae6fd; padding-top:12px; font-size:0.95rem;">✅ تم إنهاء المهمة (\${dateStr}):<br>\${note}</div>\`;

        if (source === 'PC') {
            let allData = await API.getPostClinicBookings();
            let row = allData.find(r => r.id === id);
            if(!row) return;

            row.treatmentPlan = (row.treatmentPlan || "") + followUpEntry;
            row.followUpStatus = 'FINISHED';
            row.followUpNotes = null;
            this._masterRegistryCache = null;
            await API.updatePostClinicBooking(row);
        } else if (source === 'NC') {
            let allDataNC = await API.getNewCasesMeeting();
            let row = allDataNC.find(r => r.id === id);
            if(!row) return;

            row.treatmentPlan = (row.treatmentPlan || "") + followUpEntry;
            let cData = this.parseNCCustomData(row.customData);
            cData.followUpStatus = 'FINISHED';
            cData.followUpNotes = null;
            row.customData = JSON.stringify(cData);
            await API.updateNewCaseMeeting(row);
        }
        
        UI.showToast("تم توثيق الإجراء وإغلاق المهمة بنجاح ✅");
        
        const route = document.querySelector('.nav-links li.active')?.getAttribute('data-route');
        if (route === 'follow-up') UI.renderFollowUpView();
        else if (route === 'post-clinic') UI.renderPostClinicBookings();
        else if (route === 'new-cases') UI.renderNewCasesMeeting();
    },`;

lines.splice(startIdx, endIdx - startIdx + 1, newCode);
fs.writeFileSync(file, lines.join('\n'));
console.log('Script completed.');
