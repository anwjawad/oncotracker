import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

settings_code = """
    ,
    // ================= SETTINGS MODULE =================

    _themes: [
        { name: 'Teal (Default)',  primary: '#0f766e', light: '#0d9488', sidebar: 'linear-gradient(180deg, #0f4c44 0%, #0f766e 100%)', accent: '#5eead4' },
        { name: 'Ocean Blue',      primary: '#1d4ed8', light: '#2563eb', sidebar: 'linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)', accent: '#93c5fd' },
        { name: 'Royal Purple',    primary: '#7c3aed', light: '#8b5cf6', sidebar: 'linear-gradient(180deg, '#4c1d95 0%, #7c3aed 100%)', accent: '#c4b5fd' },
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

    getPrintHeader: function(title) {
        const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        const hospital = saved.hospitalName || '';
        const dept = saved.departmentName || '';
        return `
            <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #334155; padding-bottom:16px;">
                ${hospital ? `<div style="font-size:1.2rem; font-weight:900; color:#0f172a;">${hospital}</div>` : ''}
                ${dept ? `<div style="font-size:1rem; color:#475569; margin-top:4px;">${dept}</div>` : ''}
                <div style="font-size:1.3rem; font-weight:800; color:#0f766e; margin-top:${hospital || dept ? '12px' : '0'};">${title}</div>
                <div style="font-size:0.85rem; color:#94a3b8; margin-top:4px;">${new Date().toLocaleDateString('ar-SA', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</div>
            </div>
        `;
    }
};

// END OF UI.JS
"""

# Remove old END marker and append new one
target = """};

// END OF UI.JS"""
content = content.replace(target, settings_code)

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
