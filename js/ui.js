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
                <td style="text-align:left; display:flex; gap:8px;">
                    <a href="https://wa.me/?text=${encodeURIComponent('مرحباً، معك منسق الأورام لتذكيرك بموعدك ومتابعة خطتك العلاجية. نتمنى لك دوام الصحة والعافية.')}" target="_blank" class="btn" style="background:#25D366; color:white; padding: 6px 16px; font-size: 0.9rem; text-decoration:none; display:flex; align-items:center;">📱 واتـساب</a>
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

    openChecklistModal: async function(caseId, fromProfile = false, patientId = null, patientName = null) {
        let tasks = await API.getTasks(caseId);
        if(!tasks || tasks.length === 0) {
            this.showToast("لا توجد مصفوفة مهام لهذه الحالة.", "error");
            return;
        }

        let taskRows = tasks.map(t => {
            let isAppointmentTask = t.taskName.includes('موعد') || t.taskName.includes('جلسة') || t.taskName.includes('تاريخ') || t.taskName.includes('تحديد');
            
            let mailtoLink = '';
            if(t.taskName.includes('صيدلية') || t.taskName.includes('علاج') || t.taskName.includes('دواء')) {
                mailtoLink = `mailto:pharmacy@hospital.local?subject=طلب موافقة علاج أورام - رقم الحالة: ${caseId}&body=عناية قسم الصيدلية السريرية،%0Aتحية طيبة،%0Aنرجو التكرم بمراجعة واعتماد الخطة العلاجية للمريض.%0Aرقم الحالة المرجعي: ${caseId}%0Aمع الشكر، منسقية الأورام.`;
            } else if(t.taskName.includes('أشعة') || t.taskName.includes('رنين') || t.taskName.includes('مقطعية') || t.taskName.includes('تصوير')) {
                mailtoLink = `mailto:radiology@hospital.local?subject=طلب موعد أشعة عاجل أورام - رقم الحالة: ${caseId}&body=عناية قسم الأشعة،%0Aتحية طيبة،%0Aنرجو التكرم بالتنسيق لإعطاء موعد عاجل للمريض كونه مريض أورام ضمن مسار سريع.%0Aرقم الحالة المرجعي: ${caseId}%0Aمع الشكر، منسقية الأورام.`;
            }

            let emailBtn = mailtoLink ? `<a href="${mailtoLink}" title="إعداد طلب إيميل رسمي تلقائي" style="background:#f1f5f9; border-radius:8px; padding:6px 12px; font-size:0.85rem; text-decoration:none; color:var(--primary); font-weight:700; border:1px solid #cbd5e1; transition:all 0.2s;">📧 إرسال إيميل للأقسام</a>` : '';

            let dateHTML = isAppointmentTask ? `
                <div style="display:flex; align-items:center; background:#f1f5f9; border-radius:8px; padding:4px 12px; border:1px solid #cbd5e1;">
                    <span style="font-size:0.85rem; font-weight:700; color:var(--primary); margin-left:8px;">📅 تدوين التاريخ:</span>
                    <input type="date" class="task-date-input" value="${t.dueDate || ''}" 
                           onchange="UI.updateTaskDate('${t.id}', this.value)" 
                           style="border:none; background:transparent; font-size:0.95rem; font-weight:700; color:#334155; outline:none; cursor:pointer;"
                           title="حدد تاريخ الموعد لتوثيقه">
                </div>
            ` : '';

            return `
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px; padding:16px 20px; background:var(--bg-main); border-radius:var(--radius-lg); border:1px solid var(--border); transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:var(--shadow-sm);">
                <div style="display:flex; align-items:flex-start; gap:16px;">
                    <input type="checkbox" id="chk-${t.id}" class="modern-checkbox" ${t.status === 'Completed' || t.status === 'مكتمل' ? 'checked' : ''} onchange="UI.toggleTaskStatus('${t.id}', this.checked)" style="transform: scale(1.4); cursor:pointer; margin-top:8px;" />
                    <label for="chk-${t.id}" style="flex:1; cursor:pointer; text-decoration: ${t.status === 'Completed' || t.status === 'مكتمل' ? 'line-through' : 'none'}; font-size:1.25rem; font-weight:700; color: #334155; margin:0; line-height:1.5;">${t.taskName}</label>
                </div>
                ${(emailBtn || dateHTML || (!isAppointmentTask && t.dueDate)) ? `
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-right:32px; padding-top:10px; border-top:1px dashed #e2e8f0;">
                    ${emailBtn}
                    ${dateHTML}
                    ${!isAppointmentTask && t.dueDate ? `<span style="font-size:0.9rem; font-weight:700; color:#94a3b8; padding-right:12px; border-right:2px solid #cbd5e1;">التاريخ الموثق: ${t.dueDate}</span>` : ''}
                </div>
                ` : ''}
            </div>
            `;
        }).join('');

        let contentHTML = `<div id="checklist-container" style="padding: 8px;">${taskRows}</div>`;
        
        let modalHTML = `
            <div id="app-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display:flex; justify-content:center; align-items:center; z-index:1000; direction:rtl; opacity: 1; transition: opacity 0.3s;">
                <div class="card" style="width: 750px; max-width: 95%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); animation: fadein 0.3s; padding:40px;">
                    <h3 style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 2px solid var(--border); font-size: 1.8rem; color:var(--primary);">المهام الإلزامية لحالة رقم: <span style="color:var(--text-main); font-family:monospace;">${caseId}</span></h3>
                    <div style="flex: 1; overflow-y:auto; margin-bottom: 24px; padding-right:4px;">${contentHTML}</div>
                    <div style="display:flex; justify-content:flex-end;">
                        <button class="btn btn-primary" onclick="document.getElementById('app-modal').remove(); ${fromProfile ? `UI.openPatientProfile('${patientId}', '${patientName}')` : 'UI.renderCases();'}" style="padding: 14px 40px; font-size:1.1rem;">تحديث السجلات والعودة</button>
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

    updateTaskDate: async function(taskId, newDate) {
        let task = this.currentTasks.find(t => t.id === taskId);
        if(!task) return;
        task.dueDate = newDate;
        
        await API.updateTask(task);
        this.showToast("تم توثيق تاريخ الموعد وحفظه بنجاح! 📅");
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

    handleSmartPaste: function(text, context) {
        if(!text) return;
        let mrnMatch = text.match(/\b\d{5,10}\b/);
        let extMrn = mrnMatch ? mrnMatch[0] : null;

        let nameMatch = text.match(/(?:name|الاسم|اسم المريض|patient)[\s:-]*([A-Za-z\u0600-\u06FF\s]+)/i);
        let extName = "";
        if(nameMatch && nameMatch[1].trim().length > 3) {
            extName = nameMatch[1].replace(/mrn|file|رقم|تاريخ|عمر|age|sex|الجنس/gi, '').trim();
        } else {
            let potentialNames = text.match(/([A-Za-z\u0600-\u06FF]{3,}(\s[A-Za-z\u0600-\u06FF]{3,}){1,3})/g);
            if(potentialNames && potentialNames.length > 0) {
                let name = potentialNames.find(n => !n.match(/(hospital|patient|male|female|مستشفى|مريض|رقم|تاريخ|clinic|قسم|dr\.|د\.|دكتور)/i));
                if(name) extName = name.trim();
            }
        }

        if(context === 'p') {
            if(extMrn && document.getElementById('p-mrn')) document.getElementById('p-mrn').value = extMrn;
            if(extName && document.getElementById('p-name')) document.getElementById('p-name').value = extName;
        } else if(context === 'c') {
            if(extMrn && document.getElementById('np-mrn')) document.getElementById('np-mrn').value = extMrn;
            if(extName && document.getElementById('np-name')) document.getElementById('np-name').value = extName;
            
            let sPatient = document.getElementById('c-patient');
            if(sPatient && (extMrn || extName)) {
                let found = false;
                for(let opt of sPatient.options) {
                    if(opt.value === 'NEW_PATIENT') continue;
                    if((extMrn && opt.textContent.includes(extMrn)) || (extName && opt.textContent.includes(extName))) {
                        sPatient.value = opt.value;
                        found = true;
                        break;
                    }
                }
                if(found) {
                    sPatient.dispatchEvent(new Event('change'));
                } else if(sPatient.value !== 'NEW_PATIENT') {
                    sPatient.value = 'NEW_PATIENT';
                    sPatient.dispatchEvent(new Event('change'));
                }
            }
            
            let typeElem = document.getElementById('c-type');
            if(typeElem) {
                let textLo = text.toLowerCase();
                if(textLo.includes('pet') || textLo.includes('ذري') || textLo.includes('مقطعي')) typeElem.value = 'PET_CT';
                else if(textLo.includes('mri') || textLo.includes('رنين')) typeElem.value = 'MRI';
                else if(textLo.includes('endoscopy') || textLo.includes('تنظير')) typeElem.value = 'ENDOSCOPY';
                else if(textLo.includes('chemo') || textLo.includes('drug') || textLo.includes('دواء') || textLo.includes('جرعة') || textLo.includes('صيدلية')) typeElem.value = 'SPECIAL_DRUG';
                typeElem.dispatchEvent(new Event('change'));
            }
        }
    },

    openAddPatientModal: function() {
        let formHTML = `
            <div style="background:#f0f9ff; padding:12px; border-radius:8px; border:1px dashed #0284c7; margin-bottom:20px;">
                <label style="color:#0284c7; font-size:0.95rem; font-weight:800;">🪄 اللصق الذكي (توضيب البيانات من نظام المستشفى)</label>
                <textarea id="smart-paste-p" placeholder="انسخ سطر بيانات المريض من النظام وألصقه هنا ليتم استخراج الاسم والرقم تلقائياً..." style="width:100%; height:45px; resize:none; border:none; background:transparent; font-size:0.95rem;" oninput="UI.handleSmartPaste(this.value, 'p')"></textarea>
            </div>
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
                <div style="width:100%; background:#cbd5e1; height:8px; border-radius:4px; overflow:hidden; margin-bottom:16px;">
                    <div style="width:${cTasks.length ? (compTasks/cTasks.length)*100 : 0}%; background:var(--success); height:100%; border-radius:4px; transition:width 0.5s;"></div>
                </div>
                <button class="btn ${c.status === 'Completed' || c.status === 'مكتمل' ? 'btn-success' : 'btn-primary'}" style="width:100%; padding:10px; font-size: 1rem; border-radius:8px;" onclick="UI.openChecklistModal('${c.id}', true, '${patientId}', '${patientName}')">📋 استعراض ومعالجة قائمة المهام</button>
            </div>`;
        }).join('');

        let contentHTML = `<div style="max-height:55vh; overflow-y:auto; padding-right:12px; padding-bottom:20px;">${caseCards}</div>`;
        
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
            <div style="background:#f0f9ff; padding:12px; border-radius:8px; border:1px dashed #0284c7; margin-bottom:20px;">
                <label style="color:#0284c7; font-size:0.95rem; font-weight:800;">🪄 لصق التنسيق الذكي</label>
                <textarea id="smart-paste-c" placeholder="يلتقط الإسم أو MRN ويطابقه مع المرضى (أو يملأ المريض الجديد)، ويحدد الإجراء إن ذكر..." style="width:100%; height:45px; resize:none; border:none; background:transparent; font-size:0.95rem;" oninput="UI.handleSmartPaste(this.value, 'c')"></textarea>
            </div>
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

    startVoiceDictation: function(targetId, btn) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showToast("عذراً، متصفحك لا يدعم الإملاء الصوتي.", "error");
            return;
        }
        
        let target = document.getElementById(targetId);
        if(!target) return;

        let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let originalState = btn.innerHTML;
        let originalBg = btn.style.background;
        let originalColor = btn.style.color;
        
        recognition.onstart = () => {
            btn.innerHTML = '🔴 نستمع إليك جيبداً...';
            btn.style.background = '#fee2e2';
            btn.style.color = '#ef4444';
            btn.style.borderColor = '#ef4444';
        };

        recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            target.value = (target.value + ' ' + transcript).trim();
            this.showToast("تم تحويل الصوت لورق بنجاح!");
        };

        recognition.onerror = (event) => {
            console.error(event.error);
        };

        recognition.onend = () => {
            btn.innerHTML = originalState;
            btn.style.background = originalBg;
            btn.style.color = originalColor;
            btn.style.borderColor = 'transparent';
        };

        recognition.start();
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

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="margin:0;">نتائج التواصل (Outcome Statement)</label>
                <button type="button" class="btn" style="background:#f8fafc; border:1px solid #cbd5e1; padding:4px 16px; border-radius:16px; font-size:0.9rem; font-weight:800; color:var(--primary); transition:all 0.3s;" onclick="UI.startVoiceDictation('l-outcome', this)">🎙️ إملاء صوتي</button>
            </div>
            <textarea id="l-outcome" placeholder="اكتب أو تحدث عن التزام الطرف الآخر أو المحصلة..." rows="4" style="width:100%; resize:vertical; margin-bottom:8px;"></textarea>
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
            
            <label>سبب التنويم (التشخيص المبدئي أو الهدف)</label>
            <input type="text" id="a-reason" placeholder="مثال: أخذ الجرعة، أو تدهور الحالة..." style="width:100%; margin-bottom:20px; border-color:var(--primary); background:#f8fafc;" />
            
            <label>تاريخ حجز السرير المطلوب</label>
            <input type="date" id="a-date" value="${new Date().toISOString().split('T')[0]}" style="width:100%; margin-bottom:20px;" />
            
            <label>الوجهة (القسم / الجناح)</label>
            <input type="text" id="a-loc" placeholder="مثال: جناح 4" style="width:100%; margin-bottom:8px;" />
        `;

        this.showModal('إدراج جدول تنويم منفصل', formHTML, async () => {
            let pName = document.getElementById('a-patient').value.trim();
            if(!pName) { UI.showToast("اسم المريض مطلوب", "error"); return; }
            let data = {
                patientName: pName,
                mrn: document.getElementById('a-mrn').value.trim(),
                date: document.getElementById('a-date').value,
                type: document.getElementById('a-reason').value.trim() || "إدراج يدوي - بدون سبب",
                location: document.getElementById('a-loc').value || "جناح غير محدد"
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
    },

    renderBulkActions: async function() {
        this.title.textContent = 'مركز الإجراءات المجمّعة (Bulk Hub)';
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري حصر المهام المعلقة...</p></div>';
        
        let tasks = await API.getTasks();
        let pendingTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'مكتمل');
        
        let pharmacyTasks = pendingTasks.filter(t => t.taskName.includes('صيدلية') || t.taskName.includes('علاج') || t.taskName.includes('دواء') || t.taskName.includes('موافقة'));
        let radioTasks = pendingTasks.filter(t => t.taskName.includes('أشعة') || t.taskName.includes('رنين') || t.taskName.includes('تصوير') || t.taskName.includes('مقطعي'));
        let otherTasks = pendingTasks.filter(t => !pharmacyTasks.includes(t) && !radioTasks.includes(t));

        let makeGroupHTML = (title, items) => {
            if(!items || items.length === 0) return '';
            let rows = items.map(t => `
                <div style="display:flex; align-items:center; gap:16px; background:white; padding:16px 20px; border-bottom:1px solid #e2e8f0; transition:background 0.2s;">
                    <input type="checkbox" class="bulk-chk" data-task-id="${t.id}" style="transform:scale(1.4); cursor:pointer;">
                    <span style="font-size:0.95rem; font-family:monospace; font-weight:700; color:white; background:var(--primary); padding:4px 8px; border-radius:4px; max-width:140px; overflow:hidden; text-overflow:ellipsis;" title="Case ID: ${t.caseId}">الحالة: ${String(t.caseId).substr(-6)}</span>
                    <span style="flex:1; font-weight:800; font-size:1.15rem; color:#334155;">${t.taskName}</span>
                </div>
            `).join('');

            return `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; margin-bottom:24px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="background:var(--primary); color:white; padding:16px 20px; font-weight:800; font-size:1.15rem; display:flex; justify-content:space-between; align-items:center;">
                    <span>${title} (${items.length} معلقة)</span>
                    <button class="btn" style="background:rgba(255,255,255,0.2); color:white; font-size:0.9rem; padding:6px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.3);" onclick="UI.selectAllBulk(this)">تحديد الكل</button>
                </div>
                <div>${rows}</div>
            </div>`;
        };

        let html = `
            <div class="card" style="box-shadow:var(--shadow-sm); min-height:60vh; position:relative;">
                <div style="margin-bottom:24px; border-bottom:1px solid var(--border); padding-bottom:16px;">
                    <h3 style="margin-bottom:8px; color:var(--primary); font-size:1.4rem;">🎯 تنفيذ المهام الجماعية (بضغطة واحدة)</h3>
                    <p style="color:var(--text-muted); font-size:1.1rem; line-height:1.6;">وفر ساعات من العمل عبر تحديد المهام التي تم إنجازها واعتمادها دفعة واحدة كحزمة واحدة دون الحاجة للدلالة وفتح ملف كل مريض.</p>
                </div>
                
                ${makeGroupHTML('💊 مهام موافقات الصيدلية السريرية والعلاجات', pharmacyTasks)}
                ${makeGroupHTML('☢️ تنسيق مواعيد أقسام الأشعة والطب النووي', radioTasks)}
                ${makeGroupHTML('📋 مهام التنسيق الإدارية والعيادات الأخرى', otherTasks)}
                
                ${pendingTasks.length > 0 ? `
                <div style="position:sticky; bottom:10px; background:rgba(255,255,255,0.9); backdrop-filter:blur(4px); padding:24px; text-align:center; border-top:1px solid #e2e8f0; border-radius:12px; box-shadow:0 -4px 10px rgba(0,0,0,0.05);">
                    <button id="execute-bulk-btn" class="btn btn-primary" onclick="UI.executeBulkAction()" style="padding:16px 48px; font-size:1.3rem; box-shadow:var(--shadow-lg); transition:transform 0.2s;">✔️ اعتماد كافة المهام المحددة وإنهاؤها</button>
                </div>
                ` : '<div style="text-align:center; padding:64px; color:var(--success); font-weight:800; font-size:1.5rem;"><div style="font-size:3rem; margin-bottom:16px;">🏆</div>رائع جداً! لا يوجد أي مهام معلقة في كل النظام.</div>'}
            </div>
        `;
        
        this.container.innerHTML = html;
        this._currentBulkTasks = pendingTasks;
    },

    selectAllBulk: function(btn) {
        let container = btn.parentElement.nextElementSibling;
        let checks = container.querySelectorAll('.bulk-chk');
        if(checks.length === 0) return;
        
        let allChecked = Array.from(checks).every(c => c.checked);
        checks.forEach(c => c.checked = !allChecked);
        
        btn.textContent = allChecked ? 'تحديد الكل' : 'إلغاء التحديد';
        btn.style.background = allChecked ? 'rgba(255,255,255,0.2)' : 'white';
        btn.style.color = allChecked ? 'white' : 'var(--primary)';
    },

    executeBulkAction: async function() {
        let checks = document.querySelectorAll('.bulk-chk:checked');
        if(checks.length === 0) {
            this.showToast("يرجى تحديد مهمة واحدة على الأقل قبل الاعتماد.", "error");
            return;
        }

        let taskIdsToUpdate = Array.from(checks).map(c => c.getAttribute('data-task-id'));
        let btn = document.getElementById('execute-bulk-btn');
        let origContent = btn.innerHTML;
        btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:3px; display:inline-block; vertical-align:middle; margin-left:12px;"></div> جاري تغيير حالة الملفات...';
        btn.disabled = true;

        for(let tid of taskIdsToUpdate) {
            let tObj = this._currentBulkTasks.find(t => t.id === tid);
            if(tObj) {
                tObj.status = 'Completed';
                await API.updateTask(tObj);
            }
        }

        this.showToast(`🔥 تم الإنجاز! أغلقت ${taskIdsToUpdate.length} مهام معلقة بسلام.`);
        this.renderBulkActions();
    },

    openSpotlight: async function() {
        let modalHTML = `
            <div id="spotlight-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display:flex; justify-content:center; align-items:flex-start; padding-top: 10vh; z-index:9999; direction:rtl; opacity: 1; transition: opacity 0.2s;" onclick="if(event.target.id === 'spotlight-modal') this.remove()">
                <div style="background:var(--bg-main); width: 600px; max-width: 95%; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow:hidden; animation: fadeup 0.2s ease-out;">
                    <div style="display:flex; align-items:center; border-bottom:1px solid var(--border); padding: 16px 24px;">
                        <span style="font-size:1.5rem; margin-left:16px;">🔍</span>
                        <input type="text" id="spotlight-search" placeholder="اكتب اسم المريض أو رقم الملف (MRN)..." style="flex:1; border:none; background:transparent; font-size:1.3rem; outline:none; font-weight:700; color:var(--text-main);" oninput="UI.handleSpotlightSearch(this.value)" autocomplete="off">
                    </div>
                    <div id="spotlight-results" style="max-height: 50vh; overflow-y:auto; padding: 12px;">
                        <div style="padding: 24px; text-align:center; color:var(--text-muted); font-weight:600;">ابدأ بكتابة أي معلومات تخص المريض للبحث...</div>
                    </div>
                </div>
            </div>`;
        
        let existing = document.getElementById('spotlight-modal');
        if(existing) existing.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setTimeout(() => document.getElementById('spotlight-search').focus(), 50);

        if(!this._cachedPatients) this._cachedPatients = await API.getPatients();
        if(!this._cachedCases) this._cachedCases = await API.getCases();
    },

    handleSpotlightSearch: async function(query) {
        let resultsContainer = document.getElementById('spotlight-results');
        if(!query || query.trim().length < 2) {
            resultsContainer.innerHTML = '<div style="padding: 24px; text-align:center; color:var(--text-muted); font-weight:600;">اكتب لتظهر النتائج والمطابقات...</div>';
            return;
        }

        let q = query.toLowerCase().trim();
        let matchedPatients = (this._cachedPatients || []).filter(p => p.name.toLowerCase().includes(q) || String(p.mrn).includes(q));
        
        if(matchedPatients.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 24px; text-align:center; color:var(--danger); font-weight:800;">لا يوجد نتائج مطابقة! جرب رقماً آخر.</div>';
            return;
        }

        let html = matchedPatients.slice(0, 15).map(p => {
            let pCases = (this._cachedCases || []).filter(c => c.patientName.includes(p.name));
            let casesHtml = pCases.map(c => `
                <div style="background:#f8fafc; padding:8px 12px; border-radius:8px; margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.95rem; font-weight:700; color:var(--primary);">${c.type}</span>
                    <div style="display:flex; align-items:center;">
                        <span style="font-size:0.8rem; background:${c.status === 'Completed' || c.status === 'مكتمل' ? '#dcfce7' : '#fef9c3'}; color:${c.status === 'Completed' || c.status === 'مكتمل' ? 'var(--success)' : 'var(--warning)'}; padding:4px 12px; border-radius:12px; font-weight:800; margin-left:12px;">${c.status === 'Completed' || c.status === 'مكتمل' ? 'مكتمل' : 'قيد الإجراء'}</span>
                        <button class="btn btn-primary" style="padding:6px 16px; font-size:0.85rem;" onclick="document.getElementById('spotlight-modal').remove(); UI.openChecklistModal('${c.id}', true, '${p.id}', '${p.name}')">معالجة المهام 📋</button>
                    </div>
                </div>
            `).join('');

            return `
            <div style="padding: 16px; border-radius: 12px; margin-bottom:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:1.15rem; font-weight:800; color:var(--primary);">${p.name}</div>
                        <div style="font-family:monospace; font-weight:700; color:var(--text-muted); font-size:1.1rem; margin-top:4px;">MRN: ${p.mrn}</div>
                    </div>
                    <button class="btn" style="background:#e2e8f0; color:var(--text-main); font-size:0.95rem; font-weight:800;" onclick="document.getElementById('spotlight-modal').remove(); document.querySelector('.nav-links li[data-route=\\'patients\\']').click(); setTimeout(() => UI.openPatientProfile('${p.id}', '${p.name}'), 300);">📂 استعراض الملف</button>
                </div>
                ${casesHtml ? `<div style="margin-top:16px; border-top:2px dashed #cbd5e1; padding-top:12px;">${casesHtml}</div>` : ''}
            </div>
            `;
        }).join('');

        resultsContainer.innerHTML = html;
    },

    // ============================================
    // Post Clinic Bookings Feature (Excel, Sync, Dynamic Columns)
    // ============================================
    pcCustomColumns: [],

    renderPostClinicBookings: async function() {
        this.title.textContent = 'حجوزات بعد العيادة';
        this.container.innerHTML = this.renderSkeleton(6);
        
        // Extract all dynamic headers from existing data
        let fallbackToday = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let allData = await API.getPostClinicBookings();
        let data = allData.filter(d => d.sessionDate === window.globalArchiveDate || (!d.sessionDate && window.globalArchiveDate === fallbackToday));
        this.pcCustomColumns = [];
        data.forEach(row => {
            if(row.customData) {
                try {
                    let custom = JSON.parse(row.customData);
                    Object.keys(custom).forEach(key => {
                        if(!this.pcCustomColumns.includes(key)) this.pcCustomColumns.push(key);
                    });
                } catch(e) {}
            }
        });

        let providers = [...new Set(data.map(d => d.providerName ? String(d.providerName).trim() : 'غير محدد'))];
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
                     <label style="font-size:0.95rem; color:var(--primary); font-weight:900; margin-bottom:8px;">👤 Patient Name</label>
                     <textarea class="pc-input pc-name-input" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)" style="resize:vertical; min-height:45px; height:45px; font-size:1.15rem; font-weight:800; color:#0f766e; background:#f0fdfa; border:2px solid #0d9488;" oninput="this.style.height=''; this.style.height=this.scrollHeight+'px'">${b.patientName || ''}</textarea>
                 </div>
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                     <div style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Code</label>
                         <input type="text" class="pc-input" value="${b.patientCode || ''}" onchange="UI.updatePCRow('${b.id}', 'patientCode', this.value)" style="font-family:monospace; font-weight:700;">
                     </div>
                     <div style="display:flex; flex-direction:column;">
                         <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Age</label>
                         <input type="text" class="pc-input" value="${b.patientAge || ''}" onchange="UI.updatePCRow('${b.id}', 'patientAge', this.value)" style="text-align:center;">
                     </div>
                 </div>
                 <div style="display:flex; flex-direction:column;">
                     <label style="font-size:0.85rem; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Phone</label>
                     <input type="text" class="pc-input" value="${b.phoneNumber || ''}" onchange="UI.updatePCRow('${b.id}', 'phoneNumber', this.value)" style="direction:ltr;">
                 </div>
                 <div style="display:flex; flex-direction:column;">
                     <label style="font-size:0.95rem; color:#b45309; font-weight:900; margin-bottom:8px;">📋 Treatment Plan</label>
                     <textarea class="pc-input" onchange="UI.updatePCRow('${b.id}', 'treatmentPlan', this.value)" style="resize:vertical; min-height:85px; width:100%; border:2px solid #f59e0b; background:#fffbeb; font-size:1.1rem; font-weight:600; color:#92400e; line-height:1.6;">${b.treatmentPlan || ''}</textarea>
                 </div>
                 <div style="display:flex; flex-direction:column; gap:12px; background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; margin-top:auto;">
                     <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0;">
                         <input type="checkbox" ${b.notifiedPatient === 'Y' ? 'checked' : ''} onchange="UI.updatePCRow('${b.id}', 'notifiedPatient', this.checked ? 'Y' : 'N')" style="transform:scale(1.2);">
                         <strong style="color:var(--primary); font-size:0.9rem;">تم التبليغ ✅</strong>
                     </label>
                     <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                         <strong style="font-size:0.85rem; color:var(--text-muted);">OPC Appt:</strong>
                         <input type="date" class="pc-input" style="padding:4px 6px; font-size:0.85rem; width:150px;" value="${b.opcDate || ''}" onchange="UI.updatePCRow('${b.id}', 'opcDate', this.value)">
                     </div>
                     <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                         <div style="display:flex; align-items:center; gap:4px;">
                             <label style="margin:0; font-size:0.8rem; font-weight:800; color:var(--text-muted);">Permit:</label>
                             <select class="pc-select ${b.permit === 'Y' ? 'yes' : b.permit === 'N' ? 'no' : ''}" onchange="this.className='pc-select '+(this.value==='Y'?'yes':this.value==='N'?'no':''); UI.updatePCRow('${b.id}', 'permit', this.value)" style="padding:4px; font-size:0.8rem; flex:1;">
                                 <option value="">-</option>
                                 <option value="Y" ${b.permit === 'Y' ? 'selected' : ''}>Y</option>
                                 <option value="N" ${b.permit === 'N' ? 'selected' : ''}>N</option>
                             </select>
                         </div>
                         <div style="display:flex; align-items:center; gap:4px;">
                             <label style="margin:0; font-size:0.8rem; font-weight:800; color:var(--text-muted);">Referral:</label>
                             <select class="pc-select ${b.referral === 'Y' ? 'yes' : b.referral === 'N' ? 'no' : ''}" onchange="this.className='pc-select '+(this.value==='Y'?'yes':this.value==='N'?'no':''); UI.updatePCRow('${b.id}', 'referral', this.value)" style="padding:4px; font-size:0.8rem; flex:1;">
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
                        ${this.activePCTab && this.activePCTab !== 'غير محدد' ? `<button class="btn btn-danger" onclick="UI.deleteProviderBookings('${this.activePCTab}')" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:10px 16px;">🗑️ حذف ملفات د. ${this.activePCTab} لتاريخ ${window.globalArchiveDate}</button>` : ''}
                    </div>
                </div>
                
                ${tabsHTML}
                ${UI.buildStatsBar(activeData)}
                
                <div id="pc-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: stretch; justify-content: center;">
                    ${activeData.length > 0 ? rows : '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted); font-size:1.1rem; background:#fff; border-radius:12px; border:1px dashed #cbd5e1;">لا يوجد مرضى لهذا الطبيب. قم باستيراد ملف.</div>'}
                </div>
                <div class="no-print" style="margin-top:16px;">
                    <button class="btn btn-primary" style="padding:8px 24px;" onclick="UI.addPostClinicRow()">+ إضافة صف يدوياً</button>
                </div>
            </div>
        `;
    },

    updatePCRow: async function(id, field, value) {
        UI.showSaving();
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

    deleteProviderBookings: async function(providerName) {
        if(!confirm(`هل أنت متأكد من مسح كافة بيانات د. ${providerName} لتاريخ ${window.globalArchiveDate}؟`)) return;
        
        UI.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p style="margin-top:20px; font-weight:bold; color:var(--danger);">جاري المسح. يرجى الانتظار...</p></div>';
        
        try {
            await API.deleteProviderBookings(providerName, window.globalArchiveDate);
            UI.showToast(`تم مسح بيانات د. ${providerName} بنجاح!`);
            UI.activePCTab = null;
            UI.renderPostClinicBookings();
        } catch(err) {
            console.error(err);
            UI.showToast("فشل في مسح البيانات", "error");
            UI.renderPostClinicBookings();
        }
    },

    addPostClinicRow: function() {
        let newData = {
            id: 'PC' + new Date().getTime(),
            patientName: '', patientCode: '', patientAge: '', providerName: '', sessionDate: window.globalArchiveDate,
            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', notifiedPatient: '', sessionDate: window.globalArchiveDate, customData: ''
        };
        // Optimistic UI update: fire and forget background sync
        API.createPostClinicBooking(newData).catch(() => UI.showToast("خطأ في المزامنة", "error"));
        UI.renderPostClinicBookings(); // renders instantly from updated cache
    },

    addPCColumn: function() {
        let colName = prompt("أدخل عنوان العمود الجديد (مثال: Appointment 2 Date, Reason...):");
        if(colName && colName.trim()) {
            colName = colName.trim();
            if(!this.pcCustomColumns.includes(colName)) {
                this.pcCustomColumns.push(colName);
                UI.renderPostClinicBookings();
            }
        }
    },

    handleExcelImport: async function(event) {
        let file = event.target.files[0];
        if(!file) return;

        UI.showToast("جاري تحليل ومزامنة ملف الإكسل السحابي... يرجى الانتظار", "success");
        
        let reader = new FileReader();
        reader.onload = async function(e) {
            try {
                let data = new Uint8Array(e.target.result);
                let workbook = window.XLSX.read(data, {type: 'array'});
                let firstSheetName = workbook.SheetNames[0];
                let worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to 2D array
                let rawData = window.XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false});
                
                if (rawData.length === 0) {
                    UI.showToast("الملف فارغ أو غير متوافق.", "error"); return;
                }

                // Dynamic Header Locator
                let headerRowIdx = -1;
                let hMap = { name: -1, code: -1, age: -1, provider: -1 };

                for(let i=0; i<rawData.length; i++) {
                    let row = rawData[i];
                    if(!row || !row.length) continue;
                    
                    let fName = -1, fCode = -1, fAge = -1, fProv = -1;
                    
                    row.forEach((cell, colIdx) => {
                        if(!cell) return;
                        let cStr = String(cell).toLowerCase().replace(/\\s/g, '');
                        // Strictly mutually exclusive matching
                        if(cStr.includes('code') || cStr.includes('mrn') || cStr.includes('رقم')) {
                            fCode = colIdx;
                        } else if(cStr.includes('prov') || cStr.includes('doctor') || cStr.includes('طبيب')) {
                            fProv = colIdx;
                        } else if((cStr.includes('age') && !cStr.includes('page')) || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {
                            fName = colIdx;
                        }
                    });
                    
                    if((fName > -1 && fCode > -1) || (fName > -1 && fProv > -1) || (fCode > -1 && fAge > -1)) {
                        headerRowIdx = i;
                        hMap.name = fName; hMap.code = fCode; hMap.age = fAge; hMap.provider = fProv;
                        break;
                    }
                }

                if(headerRowIdx === -1) {
                    // Try fallback logic if the names are strictly "PatientCode" etc without matching the strict checks perfectly
                    // Our strict Regex removed spaces, so 'patientname' matches. It should work perfectly.
                    UI.showToast("عذراً، لم أصادف عناوين الأعمدة المطلوبة في الملف.. يرجى التأكد من الصيغة", "error");
                    return;
                }

                let newBookingsArray = [];

                for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                    let row = rawData[i];
                    if(!row || !row.length) continue;
                    
                    let pName = hMap.name > -1 ? row[hMap.name] : '';
                    let pCode = hMap.code > -1 ? row[hMap.code] : '';
                    let pAge = hMap.age > -1 ? row[hMap.age] : '';
                    let provider = hMap.provider > -1 ? row[hMap.provider] : '';
                    
                    // Helper for strictly First and Last name
                    const formatName = (fName) => {
                        if(!fName) return '';
                        let str = String(fName).trim().replace(/\s+/g, ' ');
                        let p = str.split(' ');
                        if(p.length <= 1) return str;
                        return p[0] + ' ' + p[p.length - 1];
                    };
                    // Helper for strictly First Name
                    const formatFirstName = (fName) => {
                        if(!fName) return '';
                        let str = String(fName).trim().replace(/\s+/g, ' ');
                        return str.split(' ')[0];
                    };

                    // Only import valid rows (at least a name or code)
                    if (pName || pCode) {
                        let cleanAge = '';
                        try {
                            let matchObj = pAge ? String(pAge).match(/\d+/) : null;
                            if (matchObj) cleanAge = matchObj[0];
                        } catch(e){}
                        
                        let cleanCode = pCode ? String(pCode).replace(/^PAT/i, '').trim() : '';

                        let bookingData = {
                            id: 'PC' + new Date().getTime() + "_" + i,
                            patientName: formatName(pName),
                            patientCode: cleanCode,
                            patientAge: cleanAge, 
                            providerName: formatFirstName(provider),
                            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', notifiedPatient: '', sessionDate: window.globalArchiveDate, customData: ''
                        };
                        newBookingsArray.push(bookingData);
                    }
                }

                if (newBookingsArray.length > 0) {
                    await API.createBatchPostClinicBookings(newBookingsArray);
                }
                UI.showToast(`تم اكتشاف واستيراد ${newBookingsArray.length} مريض بنجاح! 🎉`);
                UI.renderPostClinicBookings();
            } catch(err) {
                console.error(err);
                UI.showToast("حدث خطأ أثناء قراءة الملف. " + err.message, "error");
            }
            // clear input
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    ,
    printPostClinicTable: async function() {
        let allData = await API.getPostClinicBookings();
        let fallbackToday = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let sessionData = allData.filter(b => b.sessionDate === window.globalArchiveDate || (!b.sessionDate && window.globalArchiveDate === fallbackToday));
        let data = this.activePCTab ? sessionData.filter(b => (b.providerName ? String(b.providerName).trim() : 'غير محدد') === this.activePCTab) : sessionData;
        
        if(!data || data.length === 0) {
            UI.showToast("لا يوجد بيانات للطباعة في هذه القائمة", "error");
            return;
        }

        let customCols = [];
        data.forEach(row => {
            if(row.customData) {
                try {
                    let custom = JSON.parse(row.customData);
                    Object.keys(custom).forEach(key => {
                        if(!customCols.includes(key)) customCols.push(key);
                    });
                } catch(e) {}
            }
        });

        let headers = `<th>Patient Name</th><th>Code</th><th>Age</th><th>Provider</th><th>Treatment Plan</th><th>OPC Appt</th><th>Phone</th><th>Notified</th><th>Permit</th><th>Referral</th>`;
        customCols.forEach(col => headers += `<th>${col}</th>`);

        let rowsHTML = data.map(b => {
             let customData = {};
             if(b.customData) try { customData = JSON.parse(b.customData); } catch(e){}
             let customTds = customCols.map(col => `<td>${customData[col] || ''}</td>`).join('');
             return `
             <tr>
                 <td style="font-weight:bold;">${b.patientName || ''}</td>
                 <td style="font-family:monospace;">${b.patientCode || ''}</td>
                 <td style="text-align:center;">${b.patientAge || ''}</td>
                 <td>${b.providerName || ''}</td>
                 <td style="max-width:350px; white-space:pre-wrap;">${(b.treatmentPlan || '').replace(/\\n/g, '<br>')}</td>
                 <td style="white-space:nowrap;">${b.opcDate || ''}</td>
                 <td style="direction:ltr;">${b.phoneNumber || ''}</td>
                 <td style="text-align:center;">${b.notifiedPatient === 'Y' ? '✅' : ''}</td>
                 <td style="text-align:center;">${b.permit || ''}</td>
                 <td style="text-align:center;">${b.referral || ''}</td>
                 ${customTds}
             </tr>`;
        }).join('');

        let pcPrintHeader = UI.getPrintHeader();
        let pcHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>طباعة</title><style>'
            + 'body{font-family:Tahoma,sans-serif;direction:rtl;padding:20px;}'
            + 'table{width:100%;border-collapse:collapse;font-size:13px;}'
            + 'th,td{border:1px solid #333;padding:8px;text-align:right;vertical-align:top;}'
            + 'th{background:#eee;}'
            + '@media print{@page{size:landscape;margin:8mm;}body{padding:0;}}'
            + '</style></head><body>'
            + pcPrintHeader
            + '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rowsHTML + '</tbody></table>'
            + '<scr' + 'ipt>setTimeout(function(){window.print();window.close();},400);</scr' + 'ipt>'
            + '</body></html>';

        let printWindow = window.open('', '_blank');
        if (!printWindow) { UI.showToast('يرجى السماح بفتح النوافذ المنبثقة لعمل الطباعة', 'error'); return; }
        printWindow.document.write(pcHTML);
        printWindow.document.close();
    }

    ,
    // ================= NEW CASES MEETING MODULE =================
    
    renderNewCasesMeeting: async function() {
        this.title.textContent = 'لجنة الحالات الجديدة';
        this.container.innerHTML = this.renderSkeleton(4);
        
        let fallbackToday = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let allDataNC = await API.getNewCasesMeeting();
        let data = allDataNC.filter(d => d.sessionDate === window.globalArchiveDate || (!d.sessionDate && window.globalArchiveDate === fallbackToday));
        
        let rows = (data || []).map(b => {
             return `
            <div class="pc-accordion-card" id="tr-nc-${b.id}">
                <!-- HEADER -->
                <div class="accordion-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap; flex:1;">
                        <input type="text" onclick="event.stopPropagation()" value="${b.patientName || ''}" class="minimal-input" style="width:250px; font-weight:800; font-size:1.1rem; border:none; background:transparent; padding:0; box-shadow:none;" placeholder="اسم المريض..." onchange="UI.updateNewCaseRow('${b.id}', 'patientName', this.value)">
                        <span style="font-family:monospace; background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:0.9rem;">${b.patientId || 'بدون رقم'}</span>
                        <span style="font-size:0.9rem; color:#475569;">👨‍⚕️ ${b.primaryPhysician || '-'}</span>
                    </div>
                    <div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="accordion-icon"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>

                <!-- BODY -->
                <div class="accordion-body">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div>
                            <label class="field-label">🔢 ID / FN number</label>
                            <input type="text" class="minimal-input" value="${b.patientId || ''}" onchange="UI.updateNewCaseRow('${b.id}', 'patientId', this.value)">
                        </div>
                        <div>
                            <label class="field-label">👨‍⚕️ Primary Physician</label>
                            <input type="text" class="minimal-input" value="${b.primaryPhysician || ''}" onchange="UI.updateNewCaseRow('${b.id}', 'primaryPhysician', this.value)">
                        </div>
                    </div>

                    <div>
                        <label class="field-label">📖 Brief history</label>
                        <textarea class="minimal-input minimal-textarea" onchange="UI.updateNewCaseRow('${b.id}', 'briefHistory', this.value)">${b.briefHistory || ''}</textarea>
                    </div>

                    <div>
                        <label class="field-label">📋 Treatment plan</label>
                        <textarea class="minimal-input minimal-textarea" onchange="UI.updateNewCaseRow('${b.id}', 'treatmentPlan', this.value)">${b.treatmentPlan || ''}</textarea>
                    </div>

                    <div>
                        <label class="field-label">📝 Notes</label>
                        <textarea class="minimal-input minimal-textarea" style="min-height:50px;" onchange="UI.updateNewCaseRow('${b.id}', 'notes', this.value)">${b.notes || ''}</textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end;">
                        <button class="btn btn-danger" style="padding:6px 12px; background:#fee2e2; color:#ef4444; border:none; border-radius:6px; cursor:pointer;" onclick="UI.deleteNewCaseRow('${b.id}')">🗑️ حذف الملف</button>
                    </div>
                </div>
            </div>             </div>
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
                
                ${UI.buildNCStatsBar(data)}
                <div id="nc-list" style="display: flex; flex-direction: column; gap: 8px;">
                    ${data && data.length > 0 ? rows : '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted); font-size:1.1rem; background:#fff; border-radius:12px; border:1px dashed #cbd5e1;">لا يوجد حالات جديدة مدخلة.</div>'}
                </div>
            </div>
        `;
    },

    updateNewCaseRow: async function(id, field, value) {
        UI.showSaving();
        let allData = await API.getNewCasesMeeting();
        let row = allData.find(r => r.id === id);
        if(!row) return;

        row[field] = value;
        try {
            await API.updateNewCaseMeeting(row);
            UI.showSaved();
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

    addNewCaseRow: function() {
        let newData = {
            id: 'NC' + new Date().getTime(),
            patientName: '', patientId: '', briefHistory: '', treatmentPlan: '', primaryPhysician: '', notes: '', sessionDate: window.globalArchiveDate, customData: ''
        };
        // Optimistic UI update: Background sync without blocking the user
        API.createNewCaseMeeting(newData).catch(() => UI.showToast("خطأ في المزامنة", "error"));
        UI.renderNewCasesMeeting(); // Render instantly
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
                            briefHistory: '', treatmentPlan: '', notes: '', sessionDate: window.globalArchiveDate, customData: ''
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
        let allDataNC = await API.getNewCasesMeeting();
        let data = allDataNC.filter(d => d.sessionDate === window.globalArchiveDate);
        
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
                 <td style="white-space:pre-wrap; vertical-align:top; border:2px solid #3b82f6;">${(b.briefHistory || '').replace(/\n/g, '<br>')}</td>
                 <td style="white-space:pre-wrap; vertical-align:top; border:2px solid #f59e0b;">${(b.treatmentPlan || '').replace(/\n/g, '<br>')}</td>
                 <td style="vertical-align:top;">${b.primaryPhysician || ''}</td>
                 <td style="white-space:pre-wrap; vertical-align:top;">${(b.notes || '').replace(/\n/g, '<br>')}</td>
             </tr>`;
        }).join('');

        let ncPrintHeader = UI.getPrintHeader();
        let ncHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>طباعة لجنة الحالات</title><style>'
            + 'body{font-family:Tahoma,sans-serif;direction:rtl;padding:20px;}'
            + 'table{width:100%;border-collapse:collapse;font-size:13px;}'
            + 'th,td{border:1px solid #333;padding:10px;text-align:right;vertical-align:top;}'
            + 'th{background:#f1f5f9;font-size:14px;}'
            + '@media print{@page{size:landscape;margin:8mm;}body{padding:0;}}'
            + '</style></head><body>'
            + ncPrintHeader
            + '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rowsHTML + '</tbody></table>'
            + '<scr' + 'ipt>setTimeout(function(){window.print();window.close();},400);</scr' + 'ipt>'
            + '</body></html>';

        let printWindow = window.open('', '_blank');
        if (!printWindow) { UI.showToast('يرجى السماح بفتح النوافذ المنبثقة لعمل الطباعة', 'error'); return; }
        printWindow.document.write(ncHTML);
        printWindow.document.close();
    }

    ,
    // ================= SETTINGS MODULE =================

    _themes: [
        { name: 'Teal (Default)',  primary: '#0f766e', light: '#0d9488', sidebar: 'linear-gradient(180deg, #0f4c44 0%, #0f766e 100%)', accent: '#5eead4' },
        { name: 'Ocean Blue',      primary: '#1d4ed8', light: '#2563eb', sidebar: 'linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)', accent: '#93c5fd' },
        { name: 'Royal Purple',    primary: '#7c3aed', light: '#8b5cf6', sidebar: 'linear-gradient(180deg, #4c1d95 0%, #7c3aed 100%)', accent: '#c4b5fd' },
        { name: 'Rose Gold',       primary: '#be185d', light: '#db2777', sidebar: 'linear-gradient(180deg, #831843 0%, #be185d 100%)', accent: '#fbcfe8' },
        { name: 'Midnight',        primary: '#0f172a', light: '#1e293b', sidebar: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)', accent: '#38bdf8' },
        { name: 'Forest Green',    primary: '#166534', light: '#15803d', sidebar: 'linear-gradient(180deg, #052e16 0%, #166534 100%)', accent: '#86efac' },
        { name: 'Amber Fire',      primary: '#b45309', light: '#d97706', sidebar: 'linear-gradient(180deg, #78350f 0%, #b45309 100%)', accent: '#fcd34d' },
        { name: 'Slate Modern',    primary: '#334155', light: '#475569', sidebar: 'linear-gradient(180deg, #0f172a 0%, #334155 100%)', accent: '#94a3b8' },
    ],

    openSettings: function() {
        const modal = document.getElementById('settings-modal');
        modal.style.display = 'flex';

        // Load saved settings
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        document.getElementById('print-hospital-name').value = saved.hospitalName || '';
        document.getElementById('print-department-name').value = saved.departmentName || '';

        // Load logo preview
        const savedLogo = saved.logoDataUrl || '';
        const logoPrev = document.getElementById('logo-preview');
        const logoRemove = document.getElementById('logo-remove-btn');
        if(logoPrev) { logoPrev.src = savedLogo || ''; logoPrev.style.display = savedLogo ? 'block' : 'none'; }
        if(logoRemove) logoRemove.style.display = savedLogo ? 'inline-block' : 'none';

        // Build theme swatches
        const container = document.getElementById('theme-swatches');
        const currentTheme = saved.themeIndex || 0;
        container.innerHTML = this._themes.map((t, i) => `
            <button onclick="UI.applyTheme(${i})" style="
                background: ${t.sidebar};
                border-radius: 12px;
                padding: 14px 10px;
                border: ${i === currentTheme ? '3px solid #fff' : '3px solid transparent'};
                box-shadow: ${i === currentTheme ? '0 0 0 3px ' + t.primary : '0 2px 8px rgba(0,0,0,0.15)'};
                cursor: pointer;
                transition: all 0.2s;
                display:flex; flex-direction:column; align-items:center; gap:8px;
            ">
                <span style="width:28px; height:28px; border-radius:50%; background:${t.accent}; display:block; border:2px solid rgba(255,255,255,0.4);"></span>
                <span style="font-size:0.72rem; font-weight:700; color:rgba(255,255,255,0.9);">${t.name}</span>
            </button>
        `).join('');

        // Close on backdrop click
        modal.onclick = (e) => { if(e.target === modal) UI.closeSettings(); };
    },

    closeSettings: function() {
        document.getElementById('settings-modal').style.display = 'none';
    },

    applyTheme: function(index) {
        const t = this._themes[index];
        if (!t) return;

        const root = document.documentElement;
        root.style.setProperty('--primary', t.primary);
        root.style.setProperty('--primary-light', t.light);
        root.style.setProperty('--accent', t.accent);

        // Update sidebar gradient
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.background = t.sidebar;

        // Save
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        saved.themeIndex = index;
        saved.theme = t;
        localStorage.setItem('appSettings', JSON.stringify(saved));

        // Rebuild swatches to reflect selection
        this.openSettings();
        UI.showToast(`تم تطبيق ثيم "${t.name}" ✨`);
    },

    savePrintSettings: function() {
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        saved.hospitalName = document.getElementById('print-hospital-name')?.value || '';
        saved.departmentName = document.getElementById('print-department-name')?.value || '';
        localStorage.setItem('appSettings', JSON.stringify(saved));
    },

    loadSavedSettings: function() {
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        if (saved.theme) {
            const t = saved.theme;
            const root = document.documentElement;
            root.style.setProperty('--primary', t.primary);
            root.style.setProperty('--primary-light', t.light);
            root.style.setProperty('--accent', t.accent);
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.style.background = t.sidebar;
        }
    },

    getPrintHeader: function() {
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        const hospital = saved.hospitalName || '';
        const dept = saved.departmentName || '';
        const logo = saved.logoDataUrl || '';
        const dateStr = new Date().toLocaleDateString('en-GB', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
        const logoHtml = logo ? '<img src="' + logo + '" style="max-height:70px;max-width:180px;object-fit:contain;margin-bottom:6px;">' : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #334155;">'
             + '<div style="display:flex;align-items:center;gap:14px;">'
             + logoHtml
             + '<div>'
             + (hospital ? '<div style="font-size:1.15rem;font-weight:900;color:#0f172a;">' + hospital + '</div>' : '')
             + (dept ? '<div style="font-size:0.95rem;color:#475569;margin-top:2px;">' + dept + '</div>' : '')
             + '</div>'
             + '</div>'
             + '<div style="text-align:right;color:#64748b;font-size:0.85rem;">' + dateStr + '</div>'
             + '</div>';
    },

    uploadLogo: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
            saved.logoDataUrl = e.target.result;
            localStorage.setItem('appSettings', JSON.stringify(saved));
            const prev = document.getElementById('logo-preview');
            const btn = document.getElementById('logo-remove-btn');
            if(prev) { prev.src = e.target.result; prev.style.display = 'block'; }
            if(btn) btn.style.display = 'inline-block';
            UI.showToast('تم رفع الشعار بنجاح! ✨');
        };
        reader.readAsDataURL(file);
    },

    removeLogo: function() {
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        delete saved.logoDataUrl;
        localStorage.setItem('appSettings', JSON.stringify(saved));
        const prev = document.getElementById('logo-preview');
        const btn = document.getElementById('logo-remove-btn');
        if(prev) { prev.src = ''; prev.style.display = 'none'; }
        if(btn) btn.style.display = 'none';
        UI.showToast('تم حذف الشعار');
    }

    ,
    // ============================================
    //   FEATURE PACK: Dark Mode, Skeleton, Save Indicator, Stats
    // ============================================

    // --- DARK MODE ---
    toggleDarkMode: function() {
        const isDark = document.body.classList.toggle('dark-mode');
        const btn = document.getElementById('dark-mode-toggle');
        if(btn) btn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('darkMode', isDark ? '1' : '0');
    },

    loadDarkMode: function() {
        if(localStorage.getItem('darkMode') === '1') {
            document.body.classList.add('dark-mode');
            const btn = document.getElementById('dark-mode-toggle');
            if(btn) btn.textContent = '☀️';
        }
    },

    // --- SAVE INDICATOR ---
    _saveTimer: null,
    showSaving: function() {
        const el = document.getElementById('save-indicator');
        const txt = document.getElementById('save-indicator-text');
        if(!el) return;
        el.classList.remove('saved');
        if(txt) txt.textContent = 'جاري الحفظ...';
        el.classList.add('visible');
        clearTimeout(this._saveTimer);
    },

    showSaved: function() {
        const el = document.getElementById('save-indicator');
        const txt = document.getElementById('save-indicator-text');
        if(!el) return;
        el.classList.add('saved');
        if(txt) txt.textContent = '✅ تم الحفظ';
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            el.classList.remove('visible', 'saved');
        }, 2200);
    },

    // --- SKELETON LOADING ---
    renderSkeleton: function(count = 6) {
        let cards = '';
        for(let i = 0; i < count; i++) {
            cards += `
                <div class="skeleton-card">
                    <div class="skeleton-line" style="height:18px; width:60%;"></div>
                    <div class="skeleton-line" style="height:40px; width:100%;"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="skeleton-line" style="height:36px;"></div>
                        <div class="skeleton-line" style="height:36px;"></div>
                    </div>
                    <div class="skeleton-line" style="height:80px; width:100%;"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="skeleton-line" style="height:32px;"></div>
                        <div class="skeleton-line" style="height:32px;"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="skeleton-grid">${cards}</div>`;
    },

    // --- STATS BAR ---
    animateCounters: function() {
        const els = document.querySelectorAll('.stat-value[data-target]');
        els.forEach(el => {
            const target = parseInt(el.getAttribute('data-target'), 10);
            const duration = 600;
            const start = performance.now();
            const step = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                el.textContent = Math.round(eased * target);
                if(progress < 1) requestAnimationFrame(step);
                else { el.textContent = target; el.classList.add('counting'); setTimeout(()=>el.classList.remove('counting'),400); }
            };
            requestAnimationFrame(step);
        });
    },

    buildStatsBar: function(data) {
        const total = data.length;
        const notified = data.filter(d => d.notifiedPatient === 'Y').length;
        const notNotified = total - notified;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;

        setTimeout(() => UI.animateCounters(), 100);

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>👥 إجمالي المرضى</span>
                <span class="stat-value" data-target="${total}">0</span>
            </div>
            <div class="stat-chip">
                <span>✅ تم تبليغهم</span>
                <span class="stat-value" data-target="${notified}" style="color:#10b981;">0</span>
            </div>
            <div class="stat-chip">
                <span>⏳ لم يتم تبليغهم</span>
                <span class="stat-value" data-target="${notNotified}" style="color:#f59e0b;">0</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value" data-target="${withPlan}">0</span>
            </div>
        </div>`;
    },

    buildNCStatsBar: function(data) {
        const total = data.length;
        const withHistory = data.filter(d => d.briefHistory && d.briefHistory.trim() !== '').length;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;
        const withNotes = data.filter(d => d.notes && d.notes.trim() !== '').length;

        setTimeout(() => UI.animateCounters(), 100);

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>📁 إجمالي الحالات</span>
                <span class="stat-value" data-target="${total}">0</span>
            </div>
            <div class="stat-chip">
                <span>📖 لديهم تاريخ طبي</span>
                <span class="stat-value" data-target="${withHistory}" style="color:#1d4ed8;">0</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value" data-target="${withPlan}" style="color:#b45309;">0</span>
            </div>
            <div class="stat-chip">
                <span>📝 لديهم ملاحظات</span>
                <span class="stat-value" data-target="${withNotes}">0</span>
            </div>
        </div>`;
    }
};

// END OF UI.JS



