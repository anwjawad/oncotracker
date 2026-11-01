import os

# --- 1. Modify app.js ---
app_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f: app_content = f.read()

target_app = """document.addEventListener('DOMContentLoaded', () => {
    app.init();
});"""

replace_app = """document.addEventListener('DOMContentLoaded', () => {
    // Set Global Archive Date to Today
    window.globalArchiveDate = new Date().toISOString().split('T')[0];
    let dateInput = document.getElementById('global-archive-date');
    if(dateInput) {
        dateInput.value = window.globalArchiveDate;
        dateInput.addEventListener('change', (e) => {
            window.globalArchiveDate = e.target.value;
            // Force re-render of active tab if it's sensitive to date
            let activeRoute = document.querySelector('.nav-links li.active')?.getAttribute('data-route');
            if(activeRoute === 'post-clinic' && window.UI) UI.renderPostClinicBookings();
            if(activeRoute === 'new-cases' && window.UI) UI.renderNewCasesMeeting();
        });
    }

    app.init();
});"""

app_content = app_content.replace(target_app, replace_app)
with open(app_path, 'w', encoding='utf-8') as f: f.write(app_content)

# --- 2. Modify api.js ---
api_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\api.js'
with open(api_path, 'r', encoding='utf-8') as f: api_content = f.read()

target_api_del1 = """    deleteProviderBookings: async function(providerName) {
        if(!this._cache.postClinicBookings) return;
        this._cache.postClinicBookings = this._cache.postClinicBookings.filter(b => b.providerName !== providerName);
        return await this._fetchGAS('DELETE_PROVIDER_POSTCLINIC', { providerName: providerName });
    },"""

replace_api_del1 = """    deleteProviderBookings: async function(providerName, sessionDate) {
        if(!this._cache.postClinicBookings) return;
        this._cache.postClinicBookings = this._cache.postClinicBookings.filter(b => !(b.providerName === providerName && b.sessionDate === sessionDate));
        return await this._fetchGAS('DELETE_PROVIDER_POSTCLINIC', { providerName: providerName, sessionDate: sessionDate });
    },"""

target_api_del2 = """    deleteProviderNewCases: async function(providerName) {
        if(!this._cache.newCasesMeeting) return;
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => b.primaryPhysician !== providerName);
        return await this._fetchGAS('DELETE_PROVIDER_NEW_CASES', { providerName: providerName });
    },"""

replace_api_del2 = """    deleteProviderNewCases: async function(providerName, sessionDate) {
        if(!this._cache.newCasesMeeting) return;
        this._cache.newCasesMeeting = this._cache.newCasesMeeting.filter(b => !(b.primaryPhysician === providerName && b.sessionDate === sessionDate));
        return await this._fetchGAS('DELETE_PROVIDER_NEW_CASES', { providerName: providerName, sessionDate: sessionDate });
    },"""

api_content = api_content.replace(target_api_del1, replace_api_del1)
api_content = api_content.replace(target_api_del2, replace_api_del2)
with open(api_path, 'w', encoding='utf-8') as f: f.write(api_content)
