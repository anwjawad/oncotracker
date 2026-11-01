import os
import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Update Post Clinic print header
old_pc = """        let printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة لجنة ما بعد العيادة</title>"""
new_pc = """        let printWindow = window.open('', '_blank');
        let pcPrintHeader = UI.getPrintHeader('جدول حجوزات ما بعد العيادة');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة لجنة ما بعد العيادة</title>"""
content = content.replace(old_pc, new_pc)

# Update NC print header
old_nc = """        let printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة لجنة الحالات الجديدة</title>"""
new_nc = """        let printWindow = window.open('', '_blank');
        let ncPrintHeader = UI.getPrintHeader('جدول لجنة الحالات الجديدة');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة لجنة الحالات الجديدة</title>"""
content = content.replace(old_nc, new_nc)

# Update the actual heading in PC print body to use variable
old_pc_h2 = """<h2 style="text-align:center; margin-bottom: 20px;">جدول حجوزات ما بعد العيادة</h2>"""
new_pc_h2 = """${pcPrintHeader}"""
content = content.replace(old_pc_h2, new_pc_h2)

old_nc_h2 = """<h2 style="text-align:center; margin-bottom: 20px; color:#1e293b;">جدول لجنة الحالات الجديدة</h2>"""
new_nc_h2 = """${ncPrintHeader}"""
content = content.replace(old_nc_h2, new_nc_h2)

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("Updated print headers in ui.js")
