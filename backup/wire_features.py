js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# 1. Skeleton in renderPostClinicBookings
old_pc_loading = """        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        
        // Extract all dynamic headers from existing data"""
new_pc_loading = """        this.container.innerHTML = this.renderSkeleton(6);
        
        // Extract all dynamic headers from existing data"""
content = content.replace(old_pc_loading, new_pc_loading)

# 2. Skeleton in renderNewCasesMeeting
old_nc_loading = """        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري سحب بيانات الحالات...</p></div>';"""
new_nc_loading = """        this.container.innerHTML = this.renderSkeleton(4);"""
content = content.replace(old_nc_loading, new_nc_loading)

# 3. Add Stats Bar and dark mode load on app start (wrap in renderPostClinicBookings after tabsHTML)
old_tabs_inject = """                ${tabsHTML}
                
                <div id="pc-list\""""
new_tabs_inject = """                ${tabsHTML}
                ${UI.buildStatsBar(activeData)}
                
                <div id="pc-list\""""
content = content.replace(old_tabs_inject, new_tabs_inject)

# 4. Add NC stats bar in renderNewCasesMeeting HTML build
old_nc_list = """                <div id="nc-list\""""
new_nc_list = """                ${UI.buildNCStatsBar(data)}
                <div id="nc-list\""""
content = content.replace(old_nc_list, new_nc_list, 1)

# 5. Wrap all updatePCRow and updateNewCaseRow to show saving/saved indicators
old_updatePC = """    updatePCRow: async function(id, field, value) {"""
new_updatePC = """    updatePCRow: async function(id, field, value) {
        UI.showSaving();"""
content = content.replace(old_updatePC, new_updatePC)

old_updatePC2 = """        try {
            await API.updatePostClinicBooking(id, field, value);
        } catch(err) {
            UI.showToast"""
new_updatePC2 = """        try {
            await API.updatePostClinicBooking(id, field, value);
            UI.showSaved();
        } catch(err) {
            UI.showToast"""
content = content.replace(old_updatePC2, new_updatePC2)

old_updateNC = """    updateNewCaseRow: async function(id, field, value) {"""
new_updateNC = """    updateNewCaseRow: async function(id, field, value) {
        UI.showSaving();"""
content = content.replace(old_updateNC, new_updateNC)

old_updateNC2 = """        try {
            await API.updateNewCaseMeeting(row);
        } catch(err) {
            UI.showToast("خطأ في المزامنة", "error");"""
new_updateNC2 = """        try {
            await API.updateNewCaseMeeting(row);
            UI.showSaved();
        } catch(err) {
            UI.showToast("خطأ في المزامنة", "error");"""
content = content.replace(old_updateNC2, new_updateNC2)

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("All features wired up")
