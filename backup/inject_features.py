js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

new_features = """
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
    buildStatsBar: function(data) {
        const total = data.length;
        const notified = data.filter(d => d.notifiedPatient === 'Y').length;
        const notNotified = total - notified;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>👥 إجمالي المرضى</span>
                <span class="stat-value">${total}</span>
            </div>
            <div class="stat-chip">
                <span>✅ تم تبليغهم</span>
                <span class="stat-value" style="color:#10b981;">${notified}</span>
            </div>
            <div class="stat-chip">
                <span>⏳ لم يتم تبليغهم</span>
                <span class="stat-value" style="color:#f59e0b;">${notNotified}</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value">${withPlan}</span>
            </div>
        </div>`;
    },

    buildNCStatsBar: function(data) {
        const total = data.length;
        const withHistory = data.filter(d => d.briefHistory && d.briefHistory.trim() !== '').length;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;
        const withNotes = data.filter(d => d.notes && d.notes.trim() !== '').length;

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>📁 إجمالي الحالات</span>
                <span class="stat-value">${total}</span>
            </div>
            <div class="stat-chip">
                <span>📖 لديهم تاريخ طبي</span>
                <span class="stat-value" style="color:#1d4ed8;">${withHistory}</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value" style="color:#b45309;">${withPlan}</span>
            </div>
            <div class="stat-chip">
                <span>📝 لديهم ملاحظات</span>
                <span class="stat-value">${withNotes}</span>
            </div>
        </div>`;
    }
};

// END OF UI.JS
"""

target = """};

// END OF UI.JS"""
content = content.replace(target, new_features)

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("Features injected to ui.js")
