const UI = {
    container: document.getElementById('view-container'),
    title: document.getElementById('page-title'),

    renderDashboard: async function() {
        this.title.textContent = 'لوحة القيادة';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p style="font-weight: 700; color: #64748b; margin-top:16px;">جاري تحميل ومزامنة البيانات...</p></div>';
        
        let data = await API.getDashboardData();
        
        let overdueTasksHTML = data.overdueTasksCount > 0 
            ? `<li style="display:flex; align-items:center; gap:8px;">⚠️ <span>عاجل: يوجد <strong style="color:var(--danger);">${data.overdueTasksCount} مهام متأخرة</strong> تجاوزت الموعد المحدد. راجع الحالات والمهام!</span></li>`
            : `<li style="display:flex; align-items:center; gap:8px; color:var(--success);">✅ <span>لا يوجد أي مهام متأخرة اليوم، السجل نظيف.</span></li>`;

        let thursdayAlert = new Date().getDay() === 4 
            ? `<li style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">📅 <strong>اليوم الخميس!</strong> تذكر طباعة واعتماد قوائم تنويم عطلة نهاية الأسبوع من الإدارة.</li>` 
            : "";

        this.container.innerHTML = `
            <div class="dashboard-grid">
                <div class="card stat-card border-blue">
                    <span class="stat-title">إجمالي الحالات النشطة</span>
                    <span class="stat-value status-blue">${data.patientsToday}</span>
                </div>
                <div class="card stat-card border-yellow">
                    <span class="stat-title">المهام قيد الإجراء</span>
                    <span class="stat-value status-yellow">${data.pendingTasks}</span>
                </div>
                <div class="card stat-card border-red">
                    <span class="stat-title">تنتظر ردود الأقسام</span>
                    <span class="stat-value status-red">${data.waitingReply}</span>
                </div>
                <div class="card stat-card border-green">
                    <span class="stat-title">بروتوكولات متأخرة</span>
                    <span class="stat-value status-green">${data.overdue}</span>
                </div>
            </div>
            
            <div class="card" style="border-right: 5px solid var(--danger);">
                <h3 style="color:var(--danger); margin-bottom:0;">تنبيهات النظام الذكية</h3>
                <ul id="alerts-list" style="margin-top: 20px; padding-right: 0; list-style:none; font-size:1.1rem; line-height: 1.8;">
                    ${thursdayAlert}
                    ${overdueTasksHTML}
                </ul>
            </div>
        `;
    },

    renderPatients: async function() {
        this.title.textContent = 'سجل المرضى الموحد';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري استحضار سجل المرضى...</p></div>';
        
        let data = await API.getPatients();
        let rows = data.map(p => `
            <tr>
                <td style="font-weight:bold; color:var(--primary);">${p.name}</td>
                <td><span style="background:var(--bg-main); padding: 4px 12px; border-radius:12px; font-weight:700;">${p.mrn}</span></td>
                <td>${p.doctor || '-'}</td>
                <td><span style="background:#fef3c7; color:#92400e; padding:4px 12px; border-radius:12px; font-size:0.85rem; font-weight:800;">${p.source || 'أخرى'}</span></td>
                <td style="text-align:left;">
                    <button class="btn btn-primary" style="padding: 6px 16px; font-size: 0.9rem" onclick="UI.openPatientProfile('${p.id}', '${p.name}')">📂 استعراض الملف</button>
                </td>
            </tr>
        `).join('');

        this.container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3>سجل المراجعين (مرضى الأورام)</h3>
                    <button class="btn btn-primary" onclick="UI.openAddPatientModal()">+ فتح ملف لمراجع جديد</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>اسم المريض</th>
                            <th>رقم الملف (MRN)</th>
                            <th>الطبيب المعالج</th>
                            <th>جهة الاستلام (المصدر)</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    renderCases: async function() {
        this.title.textContent = 'إدارة الحالات والمهام النشطة';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري مزامنة الحالات...</p></div>';
        
        let data = await API.getCases();
        // Sort cases so "قيد الإجراء" is on top, and "مكتمل" is at bottom
        data.sort((a,b) => {
            if(a.status === 'Completed' || a.status === 'مكتمل') return 1;
            if(b.status === 'Completed' || b.status === 'مكتمل') return -1;
            return 0;
        });

        let rows = data.map(c => {
            let creationDate = '';
            try { creationDate = new Date(parseInt(c.id.replace('C', ''))).toISOString().split('T')[0]; } catch(e) { creationDate = '-'; }
            return `
            <tr style="opacity: ${c.status === 'Completed' || c.status === 'مكتمل' ? '0.6' : '1'};">
                <td>
                    <span style="color:var(--text-muted); font-size:0.95rem; font-family:monospace; display:block;">${c.id}</span>
                </td>
                <td style="font-weight:800; font-size:1.1rem; color:var(--primary);">${c.patientName}</td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:4px 12px; border-radius:12px; font-size:0.9rem; font-weight:700;">${c.type}</span></td>
                <td>
                    <span style="background: ${c.status === 'Completed' || c.status === 'مكتمل' ? '#dcfce7' : c.status === 'Overdue' ? '#fee2e2' : '#fef9c3'}; color: ${c.status === 'Completed' || c.status === 'مكتمل' ? 'var(--success)' : c.status === 'Overdue' ? 'var(--danger)' : 'var(--warning)'}; padding:4px 12px; border-radius:12px; font-weight:800; font-size:0.9rem;">
                        ${c.status === 'Completed' ? 'مكتمل' : c.status === 'Overdue' ? 'متأخر' : 'قيد التدقيق'}
                    </span>
                </td>
                <td style="direction:ltr; text-align:right; font-weight:700; color:var(--text-main);">${creationDate}</td>
                <td style="text-align:center;">
                    <button class="btn ${c.status === 'Completed' || c.status === 'مكتمل' ? 'btn-success' : 'btn-primary'}" style="padding: 6px 16px; font-size: 0.9rem; margin:auto;" onclick="UI.openChecklistModal('${c.id}')">📋 قائمة المهام</button>
                </td>
            </tr>
        `;}).join('');

        this.container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 24px;">
                    <h3>سجل الطلبات والإجراءات الطبية</h3>
                    <button class="btn btn-primary" onclick="UI.openNewCaseModal()">+ إضافة طلب (Case)</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>المرجع</th>
                            <th>المريض المعني</th>
                            <th>البروتوكول الطبي</th>
                            <th>المرحلة</th>
                            <th>تاريخ إدراج الطلب</th>
                            <th style="text-align:center;">إدارة المهام سير العمل</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    currentAdmissionDateFilter: new Date().toISOString().split('T')[0],

    renderAdmissions: async function() {
        this.title.textContent = 'جدولة قوائم التنويم';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        
        let currentDate = this.currentAdmissionDateFilter;
        let data = await API.getAdmissions();
        let filteredData = data.filter(a => String(a.date).includes(currentDate) || String(a.date) === "");

        let rows = filteredData.length ? filteredData.map(a => `
            <tr>
                <td style="font-weight:800; font-size:1.1rem; color:var(--primary);">${a.patientName}</td>
                <td><span style="background:var(--bg-main); padding: 4px 12px; border-radius:8px; font-family:monospace; font-weight:700; font-size:1.1rem;">${a.mrn}</span></td>
                <td>${a.type}</td>
                <td><span style="background:#f1f5f9; padding:4px 12px; border-radius:4px; font-weight:700;">${a.location}</span></td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="padding:32px; text-align:center; color:var(--text-muted); font-size:1.2rem;">لا توجد أي حجوزات تنويم لليوم المحدد.</td></tr>';

        this.container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
                    <div style="display:flex; align-items:center; gap: 16px; background:var(--bg-main); padding:8px 16px; border-radius:var(--radius-md);">
                        <h3 style="margin:0; font-size:1.2rem;">تاريخ البحث والفلترة:</h3>
                        <input type="date" id="admin-date" value="${currentDate}" onchange="UI.currentAdmissionDateFilter = this.value; UI.renderAdmissions();" style="border:none; box-shadow:none; font-size:1.1rem;">
                    </div>
                    <div style="display:flex; gap:12px;">
                        <button class="btn btn-primary" onclick="UI.openAddAdmissionModal()">+ إدراج اسم للقائمة</button>
                        <button class="btn btn-success" onclick="alert('تم نسخ القائمة للذاكرة!')">📋 نسخ لمجموعات الـ WhatsApp</button>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>المريض</th>
                            <th>الملف الطبي (MRN)</th>
                            <th>سبب التنويم</th>
                            <th>الوجهة (الجناح)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    currentPortCathDateFilter: null,

    renderPortCath: async function() {
        if(!this.currentPortCathDateFilter) {
            let d = new Date();
            let day = d.getDay();
            let diff = day <= 6 ? 6 - day : 0;
            d.setDate(d.getDate() + diff);
            this.currentPortCathDateFilter = d.toISOString().split('T')[0];
        }

        this.title.textContent = 'عمليات اليوم الواحد (Port Cath)';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        
        let data = await API.getPortCath();
        let targetDate = this.currentPortCathDateFilter;
        let filteredData = data.filter(p => !p.date || String(p.date).includes(targetDate));

        let bookedCount = filteredData.filter(d => d.status === 'Booked' || d.status === 'محجوز').length;
        let warningHTML = bookedCount >= 5 
            ? '<p style="color: var(--danger); font-weight: 800; background:#fef2f2; padding:16px; border-radius:12px; margin-top:24px; border:2px solid #fecaca; font-size:1.1rem;">⚠️ تنبيه إداري: لوائح الجراحة وصلت للحد الأقصى (5 مرضى) ليوم السبت المحدد!</p>' 
            : '';
        
        let rows = filteredData.length ? filteredData.map(p => `
            <tr>
                <td style="font-weight:800; font-size:1.1rem;">${p.patientName}</td>
                <td>
                    <span style="background:${p.status === 'Booked' || p.status === 'محجوز' ? '#dcfce7' : '#fef9c3'}; color:${p.status === 'Booked' || p.status === 'محجوز' ? 'var(--success)' : 'var(--warning)'}; padding:6px 16px; border-radius:16px; font-weight:800; font-size:0.95rem;">
                        ${p.status === 'Booked' || p.status === 'محجوز' ? 'محجوز ومؤكد' : 'توقع بقائمة الانتظار'}
                    </span>
                </td>
                <td style="direction:ltr; text-align:right;">${p.date}</td>
            </tr>
        `).join('') : '<tr><td colspan="3" style="padding:32px; text-align:center; color:var(--text-muted); font-size:1.2rem;">لا يوجد مرضى مسجلين في يوم السبت المحدد.</td></tr>';

        let satOptions = [];
        let d = new Date();
        d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
        for(let i=0; i<8; i++){
            let satStr = d.toISOString().split('T')[0];
            satOptions.push(`<option value="${satStr}">${satStr} (السبت)</option>`);
            d.setDate(d.getDate() + 7);
        }

        this.container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; gap:16px;">
                    <div style="display:flex; align-items:center; gap: 16px; background:var(--bg-main); padding:8px 16px; border-radius:var(--radius-md);">
                        <h3 style="margin:0; font-size:1.2rem;">تاريخ البحث بالجدول:</h3>
                        <select id="pc-filter-date" onchange="UI.currentPortCathDateFilter = this.value; UI.renderPortCath();" style="border:none; box-shadow:none; font-size:1.1rem; background:transparent;">
                            ${satOptions.map(opt => opt.includes(targetDate) ? opt.replace('<option', '<option selected') : opt).join('')}
                        </select>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span style="font-size: 1.1rem; color: var(--text-muted); font-weight:600; padding-right:8px;">(المؤكد: ${bookedCount} من 5)</span>
                        <button class="btn btn-primary" onclick="UI.openAddPortCathModal()">+ إحالة مريض للجراحة</button>
                    </div>
                </div>
                ${warningHTML}
                <table>
                    <thead>
                        <tr>
                            <th>اسم الحالة</th>
                            <th>التصنيف المالي والجراحي</th>
                            <th>تاريخ إدراج العملية</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div style="margin-top: 40px; border-top: 1px solid var(--border); padding-top: 32px; display:flex; gap:16px; align-items:center;">
                    <button class="btn btn-primary" onclick="UI.openPortCathEmailTemplate()" style="background:#1e293b; color:#fff; font-size:1.1rem;">✉️ اعتماد الجدول وإرساله</button>
                    ${new Date().getDay() === 3 ? '<p style="color:var(--warning); font-weight:800; margin:0; font-size:1.1rem;">⚠️ تذكير: اليوم الأربعاء، وقت إغلاق اللائحة!</p>' : ''}
                </div>
            </div>
        `;
    },

    renderCommunications: async function() {
        this.title.textContent = 'سجل التوثيق للمراسلات';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        
        let data = await API.getCommunications();
        let rows = data.map(c => `
            <tr>
                <td><span style="background:var(--bg-main); padding:4px 12px; border-radius:6px; font-size:0.9rem; font-family:monospace;">${c.caseId}</span></td>
                <td><span style="font-weight:700; color:var(--primary);">${c.type}</span></td>
                <td style="font-weight:600;">${c.to}</td>
                <td style="direction:ltr; text-align:right; color:var(--text-muted);">${c.date}</td>
                <td><span style="background:${c.outcome.includes('waiting') || c.outcome.includes('بانتظار') ? '#fef9c3' : '#f1f5f9'}; color:${c.outcome.includes('waiting') || c.outcome.includes('بانتظار') ? 'var(--warning)' : 'var(--text-main)'}; padding:6px 12px; border-radius:8px; font-weight:700; display:inline-block; max-width:250px; line-height:1.4;">${c.outcome}</span></td>
            </tr>
        `).join('');

        this.container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 24px;">
                    <div>
                        <h3 style="margin-bottom:4px;">السجل الإداري</h3>
                        <p style="color:var(--text-muted); font-size:0.9rem;">مرجع قانوني لتتبع كل رسالة أو تواصل مع الأقسام بشأن المرضى.</p>
                    </div>
                    <button class="btn btn-primary" style="font-size:1.1rem; padding:12px 24px;" onclick="UI.openLogCommunicationModal()">+ إثبات تواصل جديد</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>المرجع (Case)</th>
                            <th>المنصة / الوسيلة</th>
                            <th>الجهة المستهدفة</th>
                            <th>التوثيق الزمني</th>
                            <th>محتوى الرد أو النتيجة</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    currentTasks: [],

    openChecklistModal: async function(caseId) {
        let tasks = await API.getTasks(caseId);
        if(!tasks || tasks.length === 0) {
            this.showToast("لا توجد مصفوفة مهام لهذه الحالة.", "error");
            return;
        }

        let taskRows = tasks.map(t => `
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; padding:20px; background:var(--bg-main); border-radius:var(--radius-lg); border:1px solid var(--border); transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:var(--shadow-sm);">
                <input type="checkbox" id="chk-${t.id}" class="modern-checkbox" ${t.status === 'Completed' || t.status === 'مكتمل' ? 'checked' : ''} onchange="UI.toggleTaskStatus('${t.id}', this.checked)" style="transform: scale(1.4); cursor:pointer;" />
                <label for="chk-${t.id}" style="flex:1; cursor:pointer; text-decoration: ${t.status === 'Completed' || t.status === 'مكتمل' ? 'line-through' : 'none'}; font-size:1.25rem; font-weight:700; color: #334155; margin:0; transition:color 0.3s;">${t.taskName}</label>
                <span style="font-size:0.9rem; font-weight:700; color:#94a3b8; padding-right:16px; border-right:2px solid #cbd5e1;">${t.dueDate ? t.dueDate : 'بدون تاريخ استحقاق'}</span>
            </div>
        `).join('');

        let contentHTML = `<div id="checklist-container" style="padding: 8px;">${taskRows}</div>`;
        
        let modalHTML = `
            <div id="app-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display:flex; justify-content:center; align-items:center; z-index:1000; direction:rtl; opacity: 1; transition: opacity 0.3s;">
                <div class="card" style="width: 750px; max-width: 95%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); animation: fadein 0.3s; padding:40px;">
                    <h3 style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 2px solid var(--border); font-size: 1.8rem; color:var(--primary);">المهام الإلزامية لحالة رقم: <span style="color:var(--text-main); font-family:monospace;">${caseId}</span></h3>
                    <div style="flex: 1; overflow-y:auto; margin-bottom: 24px; padding-right:4px;">${contentHTML}</div>
                    <div style="display:flex; justify-content:flex-end;">
                        <button class="btn btn-primary" onclick="document.getElementById('app-modal').remove(); UI.renderCases();" style="padding: 14px 40px; font-size:1.1rem;">تحديث السجلات والعودة</button>
                    </div>
                </div>
            </div>`;
        document.getElementById('modal-root').innerHTML = modalHTML;
        this.currentTasks = tasks;
    },

    toggleTaskStatus: async function(taskId, isChecked) {
        let task = this.currentTasks.find(t => t.id === taskId);
        if(!task) return;
        task.status = isChecked ? 'Completed' : 'Pending';
        
        let label = document.querySelector(`label[for="chk-${taskId}"]`);
        label.style.textDecoration = isChecked ? 'line-through' : 'none';
        label.style.color = isChecked ? '#94a3b8' : '#334155';
        
        await API.updateTask(task);
        if(isChecked) {
             this.showToast("تم ترصيد إنجاز المهمة بنجاح! ✔️");
             
             // Check if all are completed in memory
             let allDone = this.currentTasks.every(t => t.status === 'Completed' || t.status === 'مكتمل');
             if(allDone) {
                 setTimeout(() => this.showToast("🎉 رائع! تم إغلاق جميع مهام هذه الحالة ونقلها للأرشيف المكتمل."), 1000);
             }
        }
    },
    
    showToast: function(message, type="success") {
        let toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `position:fixed; top:30px; left:50%; transform:translateX(-50%); padding:16px 32px; background:${type === 'success' ? 'var(--success)' : 'var(--danger)'}; color:white; border-radius:var(--radius-md); box-shadow:var(--shadow-lg); z-index:9999; animation: fadein 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); font-weight: 800; font-size:1.15rem; min-width:300px; text-align:center;`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            toast.style.transition = 'all 0.4s';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    },

    showModal: function(title, contentHTML, onSave) {
        let modalHTML = `
            <div id="app-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display:flex; justify-content:center; align-items:center; z-index:1000; direction:rtl;">
                <div class="card" style="width: 550px; max-width: 95%; box-shadow:var(--shadow-lg); animation:fadein 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); padding:40px;">
                    <h3 style="font-size: 1.6rem; font-weight:800; margin-bottom: 32px; color:var(--primary); border-bottom:2px solid var(--border); padding-bottom:16px;">${title}</h3>
                    <div style="margin: 24px 0;">${contentHTML}</div>
                    <div style="display:flex; justify-content:flex-end; gap:16px; margin-top:40px;">
                        <button class="btn" style="background:var(--border); color:var(--text-main); font-weight:800;" onclick="document.getElementById('app-modal').remove()">إلغاء الأمر</button>
                        <button class="btn btn-primary" id="modal-save-btn" style="font-weight:800; padding:12px 32px;">حفظ واعتماد</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal-root').innerHTML = modalHTML;
        document.getElementById('modal-save-btn').onclick = () => {
            onSave();
        };
    },

    openAddPatientModal: function() {
        let formHTML = `
            <label>اسم المريض الكامل (مطابق للضمان)</label>
            <input type="text" id="p-name" placeholder="مثال: أحمد علي عبد الرحمن" style="width:100%; margin-bottom:20px;" />
            
            <label>رقم الملف بالمستشفى (MRN)</label>
            <input type="text" id="p-mrn" placeholder="مثال: 100200" style="width:100%; margin-bottom:20px;" />
            
            <label>الاستشاري المعالج للورم</label>
            <input type="search" id="p-doctor" placeholder="مثال: د. ياسين أبو الهوى" style="width:100%; margin-bottom:20px;" />
            
            <label>جهة الاستلام (من أين قمت باستلام المريض؟)</label>
            <input type="text" id="p-source" placeholder="مثال: العيادة الخارجية، قسم الطوارئ، تحويلة خارجية..." style="width:100%; margin-bottom:8px;" />
        `;
        this.showModal('فتح ملف لمراجع جديد', formHTML, async () => {
            let btn = document.getElementById('modal-save-btn');
            btn.textContent = 'جاري تسجيل القيود...';
            btn.disabled = true;

            let data = {
                name: document.getElementById('p-name').value,
                mrn: document.getElementById('p-mrn').value,
                doctor: document.getElementById('p-doctor').value,
                source: document.getElementById('p-source').value || 'العيادة الخارجية',
                status: 'ملف نشط',
                createdAt: new Date().toISOString().split('T')[0]
            };
            
            if (!data.name || !data.mrn) {
                this.showToast("يجب إدخال الاسم الرباعي ورقم الملف الزامي!", "error");
                btn.textContent = 'حفظ واعتماد';
                btn.disabled = false;
                return;
            }

            await API.createPatient(data);
            document.getElementById('app-modal').remove();
            this.showToast("تم حفظ سجل المريض الجديد، ومزامنته بسلام.");
            this.renderPatients(); 
        });
    },

    openPatientProfile: async function(patientId, patientName) {
        let cases = await API.getCases();
        let patientCases = cases.filter(c => c.patientName.includes(patientName)); 

        let tasks = await API.getTasks();
        
        let caseCards = patientCases.length === 0 ? '<p style="color:var(--text-muted); font-size:1.1rem; text-align:center;">لا يوجد إجراءات طبية مسجلة لهذا المريض في النظام.</p>' : patientCases.map(c => {
            let cTasks = tasks.filter(t => t.caseId === c.id);
            let compTasks = cTasks.filter(t => t.status === 'Completed' || t.status === 'مكتمل').length;
            
            return `
            <div style="background:var(--bg-main); padding:20px; border-radius:12px; margin-bottom:16px; border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center;">
                    <strong style="color:var(--primary); font-size:1.1rem;">${c.type}</strong>
                    <span style="background:${c.status === 'Completed' || c.status === 'مكتمل' ? '#dcfce7' : '#fef9c3'}; color:${c.status === 'Completed' || c.status === 'مكتمل' ? 'var(--success)' : 'var(--warning)'}; padding:4px 16px; border-radius:16px; font-size:0.9rem; font-weight:800;">${c.status === 'Completed' || c.status === 'مكتمل' ? 'مكتمل' : 'قيد الإجراء'}</span>
                </div>
                <p style="font-size:1rem; color:var(--text-muted); margin-bottom:12px; font-weight:700;">التاريخ المستهدف: ${c.dueDate}</p>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:0.9rem; font-weight:700;">نسبة الإنجاز:</span>
                    <span style="font-size:0.9rem; font-weight:800;">${compTasks} من ${cTasks.length} مهام</span>
                </div>
                <div style="width:100%; background:#cbd5e1; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="width:${cTasks.length ? (compTasks/cTasks.length)*100 : 0}%; background:var(--success); height:100%; border-radius:4px; transition:width 0.5s;"></div>
                </div>
            </div>`;
        }).join('');

        let contentHTML = `<div style="max-height:55vh; overflow-y:auto; padding-right:12px;">${caseCards}</div>`;
        
        this.showModal(`السجل الطبي الموحد: <span style="color:var(--text-main); font-size:1.4rem;">${patientName}</span>`, contentHTML, () => {
            document.getElementById('app-modal').remove();
        });
        
        document.getElementById('modal-save-btn').textContent = "إغلاق السجل";
        document.getElementById('modal-save-btn').className = "btn";
        document.getElementById('modal-save-btn').style.background = "var(--primary)";
        document.getElementById('modal-save-btn').style.color = "white";
    },

    openNewCaseModal: async function() {
        let patients = await API.getPatients();
        let patientOptions = `<option value="NEW_PATIENT" style="font-weight:800; color:var(--primary);">➕ إضافة مريض جديد فوراً...</option>`;
        patientOptions += patients.map(p => `<option value="${p.id}">${p.name} (${p.mrn})</option>`).join('');
        
        let formHTML = `
            <label>ربط بالملف (ابحث باسم المريض)</label>
            <select id="c-patient" style="width:100%; margin-bottom:12px;" onchange="document.getElementById('new-patient-form').style.display = this.value === 'NEW_PATIENT' ? 'block' : 'none';">
                ${patientOptions}
            </select>
            
            <div id="new-patient-form" style="display:block; background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px; border:2px dashed var(--primary); animation: fadein 0.3s;">
                <label style="font-size:0.95rem; color:var(--primary);">الاسم الرباعي للمريض الجديد</label>
                <input type="text" id="np-name" placeholder="مثال: أحمد علي عبد الرحمن" style="width:100%; margin-bottom:12px;"/>
                <label style="font-size:0.95rem; color:var(--primary);">رقم الملف (MRN)</label>
                <input type="text" id="np-mrn" placeholder="مثال: 123456" style="width:100%; margin-bottom:12px;" />
                <label style="font-size:0.95rem; color:var(--primary);">جهة الاستلام (المصدر)</label>
                <input type="text" id="np-source" placeholder="مثال: العيادة، الطوارئ، تحويلة خارجية..." style="width:100%;" />
            </div>
            
            <label>الطلب المراد تنفيذه (التدخل الطبي)</label>
            <select id="c-type" style="width:100%; margin-bottom:16px;" onchange="document.getElementById('drug-container').style.display = this.value === 'SPECIAL_DRUG' ? 'block' : 'none';">
                <option value="PET_CT">تصوير ذري مقطعي (PET CT)</option>
                <option value="MRI">رنين مغناطيسي (MRI)</option>
                <option value="ENDOSCOPY">تنظير الجهاز الهضمي (Endoscopy)</option>
                <option value="SPECIAL_DRUG">أدوية وموافقات خاصة (Special Drugs)</option>
            </select>
            
            <div id="drug-container" style="display:none; margin-bottom:16px;">
                <label>اسم الدواء الخاص (تنبيه: سيظهر في سجل الطلبات)</label>
                <input type="text" id="c-drug-name" placeholder="مثال: Keytruda 200mg" style="width:100%; border-color:var(--primary);" />
            </div>
            
            <label>الدرجة القصوى للاستجابة (Priority)</label>
            <select id="c-priority" style="width:100%; margin-bottom:8px;">
                <option value="عادي">روتين منتظم (Normal)</option>
                <option value="عاجل">طارئ جداً (Urgent - 24H)</option>
            </select>
        `;

        this.showModal('تأسيس بروتوكول علاجي جديد', formHTML, async () => {
            let btn = document.getElementById('modal-save-btn');
            btn.textContent = 'جاري التأسيس ونسج المهام...';
            btn.disabled = true;

            let patientId = document.getElementById('c-patient').value;
            let patientName = "";

            if (patientId === 'NEW_PATIENT') {
                let npName = document.getElementById('np-name').value.trim();
                let npMrn = document.getElementById('np-mrn').value.trim();
                if(!npName || !npMrn) {
                     UI.showToast("عذراً، يجب إدخال اسم المريض ورقم الملف!", "error");
                     btn.textContent = 'حفظ واعتماد';
                     btn.disabled = false;
                     return;
                }
                
                let newPatientData = {
                    name: npName,
                    mrn: npMrn,
                    doctor: 'طبيب غير مسجل',
                    source: document.getElementById('np-source').value || 'العيادة الخارجية',
                    status: 'ملف نشط',
                    createdAt: new Date().toISOString().split('T')[0]
                };
                let createdPatient = await API.createPatient(newPatientData);
                patientId = createdPatient ? createdPatient.id : ('P' + new Date().getTime());
                patientName = npName;
                UI.showToast("تم فتح ملف للمريض الجديد وربطه بالطلب!");
            } else {
                patientName = patients.find(p => p.id === patientId)?.name || 'غير معروف';
            }

            let type = document.getElementById('c-type').value;
            let displayType = document.getElementById('c-type').options[document.getElementById('c-type').selectedIndex].text;
            let priority = document.getElementById('c-priority').value;
            let caseId = 'C' + new Date().getTime();

            if (type === 'SPECIAL_DRUG') {
                let drugName = document.getElementById('c-drug-name').value.trim();
                if (drugName) displayType = `أدوية خاصة - ${drugName}`;
            }

            let caseData = {
                id: caseId,
                patientName: patientName,
                type: displayType,
                status: 'قيد الإجراء',
                dueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
                priority: priority
            };

            let tasksData = [];
            if (WORKFLOW_TEMPLATES[type]) {
                tasksData = WORKFLOW_TEMPLATES[type].map(step => {
                    return {
                        id: 'T' + new Date().getTime() + Math.random().toString(36).substring(2,6),
                        caseId: caseId,
                        taskName: step.name,
                        status: 'Pending',
                        dueDate: '' 
                    };
                });
            }

            await API.createCase(caseData, tasksData);
            document.getElementById('app-modal').remove();
            this.showToast("تم توليد كافة مهام الـ Protocol للحالة!");
            this.renderCases();
        });
    },

    openLogCommunicationModal: async function() {
        let cases = await API.getCases();
        let activeCases = cases.filter(c => c.status !== 'Completed' && c.status !== 'مكتمل');
        let caseOptions = activeCases.map(c => `<option value="${c.id}">${c.patientName} (${c.type})</option>`).join('');
        
        let formHTML = `
            <label>تحديد حالة المريض المعنية</label>
            <select id="l-case" style="width:100%; margin-bottom:20px;">
                ${caseOptions}
            </select>

            <label>طريقة إيصال المعلومة</label>
            <select id="l-type" style="width:100%; margin-bottom:20px;">
                <option value="تطبيق الواتساب">واتساب لمجموعة الأطباء</option>
                <option value="البريد الإلكتروني">इيميل رسمي للإدارة</option>
                <option value="اتصال هاتفي">مكالمة هاتفية عاجلة</option>
            </select>
            
            <label>الطرف المتلقي (الجهة/الشخص)</label>
            <input type="text" id="l-to" placeholder="مثال: قسم الأشعة التداخلية أو د. فلان" style="width:100%; margin-bottom:20px;" />

            <label>نتائج التواصل (Outcome Statement)</label>
            <textarea id="l-outcome" placeholder="اكتب هنا التزام الطرف الآخر أو المحصلة..." rows="4" style="width:100%; resize:vertical; margin-bottom:8px;"></textarea>
        `;

        this.showModal('تدوين وثيقة اتصال', formHTML, async () => {
            let data = {
                caseId: document.getElementById('l-case').value,
                type: document.getElementById('l-type').value,
                to: document.getElementById('l-to').value,
                date: new Date().toLocaleString('ar-SA'),
                outcome: document.getElementById('l-outcome').value
            };
            
            await API.createCommunication(data);
            document.getElementById('app-modal').remove();
            UI.showToast("تم ختم السجل بنجاح، لن يضيع حق المرضى بعد الآن.");
            UI.renderCommunications();
        });
    },

    openAddAdmissionModal: async function() {
        let formHTML = `
            <label>اسم المريض الكامل</label>
            <input type="text" id="a-patient" placeholder="مثال: خالد عبدالله" style="width:100%; margin-bottom:20px;" />
            
            <label>الرقم الطبي (MRN)</label>
            <input type="text" id="a-mrn" placeholder="مثال: 12345" style="width:100%; margin-bottom:20px;" />
            
            <label>تاريخ حجز السرير المطلوب</label>
            <input type="date" id="a-date" value="${new Date().toISOString().split('T')[0]}" style="width:100%; margin-bottom:20px;" />
            
            <label>نوع التوجه العلاجي والمكان</label>
            <input type="text" id="a-loc" placeholder="مثال: غسيل دم - جناح 4" style="width:100%; margin-bottom:8px;" />
        `;

        this.showModal('إدراج جدول تنويم منفصل', formHTML, async () => {
            let pName = document.getElementById('a-patient').value.trim();
            if(!pName) { UI.showToast("اسم المريض مطلوب", "error"); return; }
            let data = {
                patientName: pName,
                mrn: document.getElementById('a-mrn').value.trim(),
                date: document.getElementById('a-date').value,
                type: "إدراج يدوي",
                location: document.getElementById('a-loc').value
            };
            await API.createAdmission(data);
            document.getElementById('app-modal').remove();
            UI.showToast("المريض جاهز الآن ضمن لائحة التنويم.");
            UI.renderAdmissions();
        });
    },

    openPortCathEmailTemplate: async function() {
        let data = await API.getPortCath();
        let targetDate = this.currentPortCathDateFilter;
        let filteredData = data.filter(p => String(p.date).includes(targetDate) && (p.status === 'Booked' || p.status === 'محجوز'));
        
        let patientsText = filteredData.map((p, index) => `${index + 1}. Patient Name: ${p.patientName}`).join('\\n');
        if(patientsText === '') patientsText = "There are no confirmed booked patients yet for this date.";

        let emailTemplate = `Dear Randa,

Kindly be informed about the finalized Port Cath list for the upcoming Saturday: ${targetDate}.

Booked Patients:
${patientsText}

Please confirm and prepare the OR schedule.

Best Regards,
Oncology Coordinator System`;

        let modalHTML = `
            <div id="app-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display:flex; justify-content:center; align-items:center; z-index:1000; direction:rtl;">
                <div class="card" style="width: 650px; max-width: 95%; box-shadow:var(--shadow-lg); animation:fadein 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); padding:40px;">
                    <h3 style="font-size: 1.6rem; font-weight:800; margin-bottom: 24px; color:var(--primary); border-bottom:2px solid var(--border); padding-bottom:16px;">نموذج الإيميل الرسمي</h3>
                    <p style="color:var(--text-muted); margin-bottom:16px; font-weight:700;">تم ملء النص وتجهيزه باللغة الإنجليزية للنسخ المباشر:</p>
                    <textarea id="email-template-text" style="width:100%; height:250px; direction:ltr; text-align:left; font-family:monospace; font-size:1.05rem; padding:16px; background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);" readonly>${emailTemplate}</textarea>
                    
                    <div style="display:flex; justify-content:space-between; margin-top:32px; align-items:center;">
                        <button class="btn" style="background:var(--border); color:var(--text-main); font-weight:800;" onclick="document.getElementById('app-modal').remove()">تراجع للخلف</button>
                        <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('email-template-text').value); UI.showToast('تم نسخ الإيميل بحمد الله! 📋', 'success');" style="font-weight:800; padding:12px 32px; background:var(--sidebar-bg);"><span style="font-size:1.2rem; margin-left:8px;">📋</span> نسخ كامل النص للإرسال</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal-root').innerHTML = modalHTML;
    },

    openAddPortCathModal: async function() {
        let satOptions = [];
        let d = new Date();
        d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
        for(let i=0; i<8; i++){
            let satStr = d.toISOString().split('T')[0];
            satOptions.push(`<option value="${satStr}">${satStr} (السبت)</option>`);
            d.setDate(d.getDate() + 7);
        }

        let formHTML = `
            <label>اسم المريض الكامل</label>
            <input type="text" id="pc-patient" placeholder="مثال: فاطمة حسن" style="width:100%; margin-bottom:20px;" />
            
            <label>اختيار يوم العمليات (أيام السبت فقط)</label>
            <select id="pc-date" style="width:100%; margin-bottom:20px;">
                ${satOptions.join('')}
            </select>
            
            <label>الحالة والتصنيف</label>
            <select id="pc-status" style="width:100%; margin-bottom:8px;">
                <option value="محجوز">تأكيد حجز وموعد ثابت</option>
                <option value="مرشّح بقائمة الانتظار">على قائمة الانتظار</option>
            </select>
        `;

        this.showModal('حجز موعد جراحة Port Cath', formHTML, async () => {
            let pName = document.getElementById('pc-patient').value.trim();
            if(!pName) { UI.showToast("اسم المريض مطلوب", "error"); return; }
            let data = {
                patientName: pName,
                status: document.getElementById('pc-status').value,
                date: document.getElementById('pc-date').value
            };
            await API.createPortCath(data);
            document.getElementById('app-modal').remove();
            UI.showToast("تم إدراج المريض للائحة العمليات بنجاح.");
            UI.renderPortCath();
        });
    }
};
