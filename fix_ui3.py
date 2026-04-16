import re
import os

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'

with open(js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the missing `return \``
missing_return_bug = """             <tr id="tr-${b.id}">
                 <td><input type="text" class="pc-input" value="${b.patientName || ''}" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)"></td>"""
if missing_return_bug in content:
    content = content.replace(missing_return_bug, """             return `\n             <tr id="tr-${b.id}">\n                 <td><input type="text" class="pc-input" value="${b.patientName || ''}" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)"></td>""")

# Fix Age header mapping
target1 = """                    row.forEach((cell, colIdx) => {
                        if(!cell) return;
                        let cStr = String(cell).toLowerCase().replace(/\\s/g, '');
                        // Strictly mutually exclusive matching
                        if(cStr.includes('code') || cStr.includes('mrn') || cStr.includes('رقم')) {
                            fCode = colIdx;
                        } else if(cStr.includes('prov') || cStr.includes('doctor') || cStr.includes('طبيب')) {
                            fProv = colIdx;
                        } else if(cStr.includes('age') || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {
                            fName = colIdx;
                        }
                    });"""

replace1 = """                    row.forEach((cell, colIdx) => {
                        if(!cell) return;
                        let cStr = String(cell).toLowerCase().replace(/\\s/g, '');
                        // Strictly mutually exclusive matching
                        if(cStr.includes('code') || cStr.includes('mrn') || cStr.includes('رقم')) {
                            fCode = colIdx;
                        } else if(cStr.includes('prov') || cStr.includes('doctor') || cStr.includes('طبيب')) {
                            fProv = colIdx;
                        } else if(cStr === 'age' || cStr === 'patientage' || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {
                            fName = colIdx;
                        }
                    });"""

# Fix logic for Age matching in string
target2 = """                    if (pName || pCode) {
                        let cleanAge = pAge ? String(pAge).match(/\\d+/) : null;
                        cleanAge = cleanAge ? cleanAge[0] : '';
                        
                        let cleanCode = pCode ? pCode.replace(/^PAT/i, '').trim() : '';"""

replace2 = """                    if (pName || pCode) {
                        let cleanAge = '';
                        try {
                            let matchObj = pAge ? String(pAge).match(/\\d+/) : null;
                            if (matchObj) cleanAge = matchObj[0];
                        } catch(e){}
                        
                        let cleanCode = pCode ? pCode.replace(/^PAT/i, '').trim() : '';"""

if target1 in content:
    content = content.replace(target1, replace1)
if target2 in content:
    content = content.replace(target2, replace2)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Applied fixes successfully. len={len(content)}")
