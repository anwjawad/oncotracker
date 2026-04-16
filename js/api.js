// ============================================
// Oncology Coordinator Workflow System - GAS Backend API
// ============================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbwSNo0whdJGYjDDcIKsq-MVVIKeG6w47E1sDnIJkE6iQmHFIq-afFuVlikwqSG6OTWxJA/exec"; 

const API = {
    _cache: null,
    _syncPromise: null,

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
        if (this._cache && !force) return this._cache;
        if (!this._syncPromise || force) {
            this._syncPromise = this._fetchGAS('SYNC_ALL').then(data => {
                if(data) this._cache = data;
                return this._cache;
            });
        }
        return await this._syncPromise;
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
        return await this._fetchGAS('UPDATE_POSTCLINIC', { data: data });
    },
    deletePostClinicBooking: async function(id) {
        if(!this._cache.postClinicBookings) return;
        this._cache.postClinicBookings = this._cache.postClinicBookings.filter(b => b.id !== id);
        return await this._fetchGAS('DELETE_ROW', { sheetName: 'PostClinicBookings', id: id });
    },
    deleteProviderBookings: async function(providerName, sessionDate) {
        if(!this._cache.postClinicBookings) return;
        this._cache.postClinicBookings = this._cache.postClinicBookings.filter(b => !(b.providerName === providerName && b.sessionDate === sessionDate));
        return await this._fetchGAS('DELETE_PROVIDER_POSTCLINIC', { providerName: providerName, sessionDate: sessionDate });
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
        if(!this._cache.newCasesMeeting) return;
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => b.id !== id);
        return await this._fetchGAS('DELETE_ROW', { sheetName: 'NewCasesMeeting', id: id });
    },
    deleteProviderNewCases: async function(providerName, sessionDate) {
        if(!this._cache.newCasesMeeting) return;
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => !(b.primaryPhysician === providerName && b.sessionDate === sessionDate));
        return await this._fetchGAS('DELETE_PROVIDER_NEW_CASES', { providerName: providerName, sessionDate: sessionDate });
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
