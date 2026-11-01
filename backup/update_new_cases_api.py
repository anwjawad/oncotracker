import os
import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\api.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# 1. Update cache declaration
target_cache = """        palliativeConsults: null,
        postClinicBookings: null
    },"""
replace_cache = """        palliativeConsults: null,
        postClinicBookings: null,
        newCasesMeeting: null
    },"""

if target_cache in content:
    content = content.replace(target_cache, replace_cache)
    print("Added newCasesMeeting to cache.")

# 2. Add NewCases API Methods
# Inject just before recalculateDashboard:
target_methods = """    // Local manual recalculate to avoid requesting the heavy dashboard array sync"""
replace_methods = """    getNewCasesMeeting: async function(forceRefresh = false) {
        if (this._cache.newCasesMeeting && !forceRefresh) return this._cache.newCasesMeeting;
        let res = await this._fetchGAS('GET_NEW_CASES');
        this._cache.newCasesMeeting = res;
        return res;
    },
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
    deleteProviderNewCases: async function(providerName) {
        if(!this._cache.newCasesMeeting) return;
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => b.primaryPhysician !== providerName);
        return await this._fetchGAS('DELETE_PROVIDER_NEW_CASES', { providerName: providerName });
    },

    // Local manual recalculate to avoid requesting the heavy dashboard array sync"""

if target_methods in content:
    content = content.replace(target_methods, replace_methods)
    print("Added NewCases API methods.")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
