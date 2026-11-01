import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Fix the missing `return \`` from the previous chunk
broken_tr = """             <tr id="tr-${b.id}">
                 <td><textarea class="pc-input\""""
if broken_tr in content:
    content = content.replace(broken_tr, """             return `\n             <tr id="tr-${b.id}">\n                 <td><textarea class="pc-input\"""")
    print("Fixed missing return backtick")

# Chunk 2
target_2 = """                // Helper to get strictly First and Last Name
                const formatName = (fullName) => {
                    if(!fullName) return '';
                    let str = String(fullName).trim().replace(/\\s+/g, ' ');
                    let parts = str.split(' ');
                    if(parts.length <= 1) return str;
                    return parts[0] + ' ' + parts[parts.length - 1]; // First and Last
                };

                for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                    let row = rawData[i];
                    if(!row || !row.length) continue;"""

replace_2 = """                // Helper to get strictly First and Last Name
                const formatName = (fullName) => {
                    if(!fullName) return '';
                    let str = String(fullName).trim().replace(/\\s+/g, ' ');
                    let parts = str.split(' ');
                    if(parts.length <= 1) return str;
                    return parts[0] + ' ' + parts[parts.length - 1]; // First and Last
                };

                // Helper to get exactly First Name
                const formatFirstName = (fullName) => {
                    if(!fullName) return '';
                    let str = String(fullName).trim().replace(/\\s+/g, ' ');
                    return str.split(' ')[0];
                };

                for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                    let row = rawData[i];
                    if(!row || !row.length) continue;"""

# Chunk 3
target_3 = """                            fProv = colIdx;
                        } else if(cStr === 'age' || cStr === 'patientage' || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {"""

replace_3 = """                            fProv = colIdx;
                        } else if(cStr.includes('age') && !cStr.includes('page') || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {"""

# Chunk 4
target_4 = """                        let bookingData = {
                            id: 'PC' + new Date().getTime() + "_" + i,
                            patientName: formatName(pName),
                            patientCode: cleanCode,
                            patientAge: cleanAge, 
                            providerName: formatName(provider),
                            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', notifiedPatient: '', customData: ''
                        };"""

replace_4 = """                        let bookingData = {
                            id: 'PC' + new Date().getTime() + "_" + i,
                            patientName: formatName(pName),
                            patientCode: cleanCode,
                            patientAge: cleanAge, 
                            providerName: formatFirstName(provider),
                            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', notifiedPatient: '', customData: ''
                        };"""

if target_2 in content:
    content = content.replace(target_2, replace_2)
    print("Chunk 2 applied")
if target_3 in content:
    content = content.replace(target_3, replace_3)
    print("Chunk 3 applied")
if target_4 in content:
    content = content.replace(target_4, replace_4)
    print("Chunk 4 applied")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
