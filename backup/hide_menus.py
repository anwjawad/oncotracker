import os

# 1. Update index.html
html_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\index.html'
with open(html_path, 'r', encoding='utf-8') as f: content = f.read()

target = """            <ul class="nav-links">
                <li class="active" data-route="dashboard">
                    <span class="icon">📊</span> <span class="nav-text">لوحة القيادة</span>
                </li>
                <li data-route="patients">
                    <span class="icon">👥</span> <span class="nav-text">سجل المرضى</span>
                </li>
                <li data-route="cases">
                    <span class="icon">📋</span> <span class="nav-text">الحالات والمهام</span>
                </li>
                <li data-route="admissions">
                    <span class="icon">🏥</span> <span class="nav-text">قوائم التنويم</span>
                </li>
                <li data-route="port-cath">
                    <span class="icon">💉</span> <span class="nav-text">جدولة Port Cath</span>
                </li>
                <li data-route="post-clinic">
                    <span class="icon">🏥</span> <span class="nav-text">حجوزات بعد العيادة</span>
                </li>
                <li data-route="new-cases">
                    <span class="icon">📁</span> <span class="nav-text">لجنة الحالات الجديدة</span>
                </li>
                <li data-route="bulk-actions" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 8px;">
                    <span class="icon">⚡</span> <span class="nav-text">مركز المهام السريعة</span>
                </li>
                <li data-route="communications">
                    <span class="icon">📞</span> <span class="nav-text">سجل المراسلات</span>
                </li>
            </ul>"""

replace = """            <ul class="nav-links">
                <li style="display: none;" data-route="dashboard">
                    <span class="icon">📊</span> <span class="nav-text">لوحة القيادة</span>
                </li>
                <li style="display: none;" data-route="patients">
                    <span class="icon">👥</span> <span class="nav-text">سجل المرضى</span>
                </li>
                <li style="display: none;" data-route="cases">
                    <span class="icon">📋</span> <span class="nav-text">الحالات والمهام</span>
                </li>
                <li style="display: none;" data-route="admissions">
                    <span class="icon">🏥</span> <span class="nav-text">قوائم التنويم</span>
                </li>
                <li style="display: none;" data-route="port-cath">
                    <span class="icon">💉</span> <span class="nav-text">جدولة Port Cath</span>
                </li>
                <li class="active" data-route="new-cases">
                    <span class="icon">📁</span> <span class="nav-text">لجنة الحالات الجديدة</span>
                </li>
                <li data-route="post-clinic">
                    <span class="icon">🏥</span> <span class="nav-text">حجوزات بعد العيادة</span>
                </li>
                <li style="display: none;" data-route="bulk-actions" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 8px;">
                    <span class="icon">⚡</span> <span class="nav-text">مركز المهام السريعة</span>
                </li>
                <li style="display: none;" data-route="communications">
                    <span class="icon">📞</span> <span class="nav-text">سجل المراسلات</span>
                </li>
            </ul>"""

content = content.replace(target, replace)
with open(html_path, 'w', encoding='utf-8') as f: f.write(content)


# 2. Update app.js default route
app_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f: app_content = f.read()

target_app = """    // Initial Load
    navigateTo('dashboard');"""

replace_app = """    // Initial Load
    navigateTo('new-cases');"""

app_content = app_content.replace(target_app, replace_app)
with open(app_path, 'w', encoding='utf-8') as f: f.write(app_content)
