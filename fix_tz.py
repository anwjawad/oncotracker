import os

app_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\app.js'
with open(app_path, 'r', encoding='utf-8') as f: app_content = f.read()

target = """window.globalArchiveDate = new Date().toISOString().split('T')[0];"""
replace = """window.globalArchiveDate = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];"""

app_content = app_content.replace(target, replace)

with open(app_path, 'w', encoding='utf-8') as f: f.write(app_content)
