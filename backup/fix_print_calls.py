js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Fix print calls that still pass a title
content = content.replace("UI.getPrintHeader('جدول حجوزات ما بعد العيادة')", "UI.getPrintHeader()")
content = content.replace("UI.getPrintHeader('جدول لجنة الحالات الجديدة')", "UI.getPrintHeader()")

# Update openSettings to add logo upload section
old_settings_end = """        // Build theme swatches
        const container = document.getElementById('theme-swatches');"""

new_settings_end = """        // Load logo preview
        const savedLogo = saved.logoDataUrl || '';
        const logoPrev = document.getElementById('logo-preview');
        const logoRemove = document.getElementById('logo-remove-btn');
        if(logoPrev) { logoPrev.src = savedLogo || ''; logoPrev.style.display = savedLogo ? 'block' : 'none'; }
        if(logoRemove) logoRemove.style.display = savedLogo ? 'inline-block' : 'none';

        // Build theme swatches
        const container = document.getElementById('theme-swatches');"""

content = content.replace(old_settings_end, new_settings_end)
with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("Done")
