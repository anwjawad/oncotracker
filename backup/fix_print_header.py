js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

old = """    getPrintHeader: function(title) {
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
};"""

new = """    getPrintHeader: function() {
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
            UI.showToast('\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u0634\u0639\u0627\u0631 \u0628\u0646\u062c\u0627\u062d! \u2728');
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
        UI.showToast('\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0634\u0639\u0627\u0631');
    }
};"""

if old in content:
    content = content.replace(old, new)
    print("Replaced getPrintHeader successfully")
else:
    print("Target not found - trying fallback")
    # Fallback: just find and replace the function end
    old2 = "    getPrintHeader: function(title) {"
    new2 = "    getPrintHeader_OLD: function(title) {"
    content = content.replace(old2, new2)
    print("Did fallback rename. Manual check needed.")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
