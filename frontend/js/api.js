// ============================================
// Oncology Coordinator Workflow System - GAS Backend API
// ============================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbwSNo0whdJGYjDDcIKsq-MVVIKeG6w47E1sDnIJkE6iQmHFIq-afFuVlikwqSG6OTWxJA/exec"; 
const _LOCAL_KEY = "ONCOLOGY_SYNC_CACHE";

const API = {
    _cache: null,
    _syncPromise: null,
    _isSyncing: false,

    persistCache: function() {
        if (this._cache) {
            localStorage.setItem(_LOCAL_KEY, JSON.stringify({
                data: this._cache,
                timestamp: new Date().getTime()
            }));
        }
    },

    loadCache: function() {
        const stored = localStorage.getItem(_LOCAL_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                this._cache = parsed.data;
                return true;
            } catch (e) { return false; }
        }
        return false;
    },

    clearCache: function() {
        localStorage.removeItem(_LOCAL_KEY);
        this._cache = null;
        this._syncPromise = null;
    },

    _fetchGAS: async function(action, payload = {}) {
        if (!GAS_URL || GAS_URL === "YOUR_WEB_APP_URL_HERE") {
             console.error("API Error: GAS_URL is missing.");
             alert("الرجاء إضافة الرابط الخاص بقاعدة البيانات لتعمل النسخة الحية.");
             return null;
        }

        try {
            let res = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: action, payload: payload })
            });
            let result = await res.json();
            if (result.success) return result.data;
            throw new Error(result.message);
        } catch (e) {
            console.error("GAS Fetch Error:", e);
            alert("فشل الاتصال: " + e.message);
            return null;
        }
    },

    initSync: async function(force = false) {
        // Fast Load: Prefer Cache if available
        if (!this._cache && !force) {
            this.loadCache();
        }

        if (this._cache && !force) {
            // If we have cache, trigger a background sync silently
            this._backgroundSync();
            return this._cache;
        }

        if (!this._syncPromise || force) {
            this._syncPromise = this._fetchGAS('SYNC_ALL').then(data => {
                if(data) {
                    this._cache = data;
                    this.persistCache();
                }
                return this._cache;
            });
        }
        return await this._syncPromise;
    },

    _backgroundSync: async function() {
        if (this._isSyncing) return;
        this._isSyncing = true;
        try {
            const data = await this._fetchGAS('SYNC_ALL');
            if (data) {
                // Check if data actually changed to avoid unnecessary re-renders
                const dataChanged = JSON.stringify(this._cache) !== JSON.stringify(data);
                this._cache = data;
                this.persistCache();
                
                // If on dashboard or specific views, trigger a silent refresh
                if (dataChanged && window.UI && UI.currentRoute) {
                    console.log("⚡ Background Sync: Data updated, refreshing view.");
                    UI.renderByRoute(UI.currentRoute);
                }
            }
        } catch (e) {
            console.warn("Background sync failed:", e);
        } finally {
            this._isSyncing = false;
        }
    },

    // ----------------------------------------
    // Read App Data (Fully Local Memory Speed ⚡)
    // ----------------------------------------
    getDashboardData: async function() { await this.initSync(); return this._cache.dashboard; },
    getPatients: async function() { await this.initSync(); return this._cache.patients; },
    getCases: async function() { await this.initSync(); return this._cache.cases; },
    getAdmissions: async function() { await this.initSync(); return this._cache.admissions; },
    getPortCath: async function() { await this.initSync(); return this._cache.portCath; },
    getCommunications: async function() { await this.initSync(); return this._cache.communications; },
    getTasks: async function(caseId) { 
        await this.initSync(); 
        return caseId ? this._cache.tasks.filter(t => t.caseId === caseId) : this._cache.tasks;
    },
    getPostClinicBookings: async function() { await this.initSync(); return this._cache.postClinicBookings || []; },

    // ----------------------------------------
    // Write Mutations (Optimistic UI Updates)
    // ----------------------------------------
    createPatient: async function(patientData) {
        this._cache.patients.push(patientData);
        this.persistCache();
        let res = await this._fetchGAS('CREATE_PATIENT', { data: patientData });
        this.recalculateDashboard();
        return res;
    },
    createCase: async function(caseData, tasksData) {
        this._cache.cases.push(caseData);
        if(tasksData) this._cache.tasks.push(...tasksData);
        let res = await this._fetchGAS('CREATE_CASE', { caseData: caseData, tasksData: tasksData });
        this.recalculateDashboard();
        return res;
    },
    updateTask: async function(taskData) {
        let index = this._cache.tasks.findIndex(t => t.id === taskData.id);
        if(index > -1) this._cache.tasks[index] = taskData;
        
        // Optimistic Auto-complete
        let siblingTasks = this._cache.tasks.filter(t => t.caseId === taskData.caseId);
        let allCompleted = siblingTasks.every(t => t.status === 'Completed');
        if(allCompleted) {
             let cIndex = this._cache.cases.findIndex(c => c.id === taskData.caseId);
             if(cIndex > -1) this._cache.cases[cIndex].status = 'Completed';
        }

        let res = await this._fetchGAS('UPDATE_TASK', { taskData: taskData });
        this.recalculateDashboard();
        return res;
    },
    createCommunication: async function(commData) {
        this._cache.communications.push(commData);
        let res = await this._fetchGAS('CREATE_COMMUNICATION', { data: commData });
        this.recalculateDashboard();
        return res;
    },
    createAdmission: async function(adminData) {
        this._cache.admissions.push(adminData);
        return await this._fetchGAS('CREATE_ADMISSION', { data: adminData });
    },
    createPortCath: async function(portData) {
        this._cache.portCath.push(portData);
        return await this._fetchGAS('CREATE_PORTCATH', { data: portData });
    },
    createPostClinicBooking: async function(data) {
        if(!this._cache.postClinicBookings) this._cache.postClinicBookings = [];
        this._cache.postClinicBookings.push(data);
        this.persistCache();
        return await this._fetchGAS('CREATE_POSTCLINIC', { data: data });
    },
    createBatchPostClinicBookings: async function(dataArray) {
        if(!this._cache.postClinicBookings) this._cache.postClinicBookings = [];
        this._cache.postClinicBookings.push(...dataArray);
        return await this._fetchGAS('BATCH_ADD_POSTCLINIC', { data: dataArray });
    },
    updatePostClinicBooking: async function(data) {
        if(!this._cache.postClinicBookings) return;
        let index = this._cache.postClinicBookings.findIndex(t => t.id === data.id);
        if(index > -1) this._cache.postClinicBookings[index] = data;
        
        // --- Smart Automation: New Case Meeting Detection ---
        const plan = (data.treatmentPlan || "").toLowerCase();
        const keywords = ["new case", "meeting", "لجنة", "عرض", "حالات جديدة", "عرض على اللجنة"];
        const found = keywords.some(k => plan.includes(k));

        if (found) {
            await this.initSync(); // ensure newCasesMeeting cache is ready
            const sessionDate = data.sessionDate || new Date().toISOString().split('T')[0];
            const alreadyExists = (this._cache.newCasesMeeting || []).some(m => 
                (m.patientId === data.patientCode || m.patientName === data.patientName) && 
                m.sessionDate === sessionDate
            );

            if (!alreadyExists) {
                const meetingData = {
                    id: 'NC_AUTO_' + new Date().getTime(),
                    patientName: data.patientName,
                    patientId: data.patientCode,
                    primaryPhysician: data.providerName,
                    sessionDate: sessionDate,
                    treatmentPlan: data.treatmentPlan,
                    briefHistory: 'تمت الإضافة تلقائياً بناءً على خطة العلاج.',
                    notes: 'Auto-detected from Post-Clinic Booking',
                    customData: ''
                };
                await this.createNewCaseMeeting(meetingData);
                // We'll let the UI handle the notification if needed
                if (window.UI && UI.showToast) {
                    UI.showToast("⚡ ذكاء التنسيق: تم إدراج المريض تلقائياً في لجنة الحالات الجديدة", "success");
                }
            }
        }

        return await this._fetchGAS('UPDATE_POSTCLINIC', { data: data });
    },
    deletePostClinicBooking: async function(id) {
        if(!this._cache || !this._cache.postClinicBookings) return;
        // Send to server FIRST, then update cache only on success
        let res = await this._fetchGAS('DELETE_ROW', { sheetName: 'PostClinicBookings', id: id });
        if(res === null) throw new Error('فشل اتصال الخادم');
        this._cache.postClinicBookings = this._cache.postClinicBookings.filter(b => b.id !== id);
        // Force full re-sync on next load to confirm server state
        this._syncPromise = null;
        return res;
    },
    deleteProviderBookings: async function(providerName, sessionDate) {
        if(!this._cache || !this._cache.postClinicBookings) return;
        // Send to server FIRST, then update cache only on success
        let res = await this._fetchGAS('DELETE_PROVIDER_POSTCLINIC', { providerName: providerName, sessionDate: sessionDate });
        if(res === null) throw new Error('فشل اتصال الخادم');
        this._cache.postClinicBookings = this._cache.postClinicBookings.filter(b => !(b.providerName === providerName && b.sessionDate === sessionDate));
        // Force full re-sync on next load to confirm server state
        this._syncPromise = null;
        return res;
    },

    getNewCasesMeeting: async function() { await this.initSync(); return this._cache.newCasesMeeting || []; },
    createNewCaseMeeting: async function(data) {
        if(!this._cache.newCasesMeeting) this._cache.newCasesMeeting = [];
        this._cache.newCasesMeeting.push(data);
        return await this._fetchGAS('CREATE_NEW_CASE', { data: data });
    },
    createBatchNewCases: async function(dataArray) {
        if(!this._cache.newCasesMeeting) this._cache.newCasesMeeting = [];
        this._cache.newCasesMeeting.push(...dataArray);
        return await this._fetchGAS('BATCH_ADD_NEW_CASES', { data: dataArray });
    },
    updateNewCaseMeeting: async function(data) {
        if(!this._cache.newCasesMeeting) return;
        let idx = this._cache.newCasesMeeting.findIndex(b => b.id === data.id);
        if(idx !== -1) this._cache.newCasesMeeting[idx] = data;
        return await this._fetchGAS('UPDATE_NEW_CASE', { data: data });
    },
    deleteNewCaseMeeting: async function(id) {
        if(!this._cache || !this._cache.newCasesMeeting) return;
        // Send to server FIRST, then update cache only on success
        let res = await this._fetchGAS('DELETE_ROW', { sheetName: 'NewCasesMeeting', id: id });
        if(res === null) throw new Error('فشل اتصال الخادم');
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => b.id !== id);
        // Force full re-sync on next load to confirm server state
        this._syncPromise = null;
        return res;
    },
    deleteProviderNewCases: async function(providerName, sessionDate) {
        if(!this._cache || !this._cache.newCasesMeeting) return;
        // Send to server FIRST, then update cache only on success
        let res = await this._fetchGAS('DELETE_PROVIDER_NEW_CASES', { providerName: providerName, sessionDate: sessionDate });
        if(res === null) throw new Error('فشل اتصال الخادم');
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => !(b.primaryPhysician === providerName && b.sessionDate === sessionDate));
        // Force full re-sync on next load to confirm server state
        this._syncPromise = null;
        return res;
    },

    // Local manual recalculate to avoid requesting the heavy dashboard array sync
    recalculateDashboard: function() {
        if(!this._cache) return;
        const patientsCount = this._cache.patients.length;
        const overdueCount = this._cache.cases.filter(c => String(c.status).toLowerCase() === 'overdue').length;
        const pendingTasks = this._cache.tasks.filter(t => String(t.status).toLowerCase() === 'pending').length;
        const waitingReply = this._cache.communications.filter(c => String(c.outcome).toLowerCase().includes('waiting')).length;
        
        let overdueTasksArray = this._cache.tasks.filter(t => {
            if(!t.dueDate || t.status === 'Completed') return false;
            return new Date(t.dueDate) < new Date();
        });

        this._cache.dashboard = {
            patientsToday: patientsCount || 0,
            pendingTasks: pendingTasks || 0,
            waitingReply: waitingReply || 0,
            overdue: overdueCount || 0,
            overdueTasksCount: overdueTasksArray.length
        };
    }
};
