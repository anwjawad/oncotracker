import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Fix layout chunk: Patient Name Textarea, Age Input Text, Provider Input
target_1 = """             <tr id="tr-${b.id}">
                 <td><input type="text" class="pc-input" value="${b.patientName || ''}" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)"></td>
                 <td><input type="text" class="pc-input" value="${b.patientCode || ''}" onchange="UI.updatePCRow('${b.id}', 'patientCode', this.value)" style="font-family:monospace; font-weight:700;"></td>
                 <td><input type="number" class="pc-input" value="${b.patientAge || ''}" onchange="UI.updatePCRow('${b.id}', 'patientAge', this.value)" style="width:70px;"></td>
                 <td><input type="text" class="pc-input" value="${b.providerName || ''}" onchange="UI.updatePCRow('${b.id}', 'providerName', this.value)"></td>"""
replace_1 = """             <tr id="tr-${b.id}">
                 <td><textarea class="pc-input pc-name-input" onchange="UI.updatePCRow('${b.id}', 'patientName', this.value)" style="resize:vertical; min-height:45px; height:45px; overflow:hidden;" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${b.patientName || ''}</textarea></td>
                 <td><input type="text" class="pc-input" value="${b.patientCode || ''}" onchange="UI.updatePCRow('${b.id}', 'patientCode', this.value)" style="font-family:monospace; font-weight:700;"></td>
                 <td><input type="text" class="pc-input" value="${b.patientAge || ''}" onchange="UI.updatePCRow('${b.id}', 'patientAge', this.value)" style="width:75px; text-align:center;"></td>
                 <td><input type="text" class="pc-input" value="${b.providerName || ''}" onchange="UI.updatePCRow('${b.id}', 'providerName', this.value)"></td>"""
if target_1 in content:
    content = content.replace(target_1, replace_1)
    print("Chunk 1 applied")

# Fix Phone Number Layout Chunk
target_pn = """                 <td><input type="date" class="pc-input" value="${b.opcDate || ''}" onchange="UI.updatePCRow('${b.id}', 'opcDate', this.value)" style="font-weight:700; color:var(--primary);"></td>
                 <td><input type="text" class="pc-input" value="${b.phoneNumber || ''}" onchange="UI.updatePCRow('${b.id}', 'phoneNumber', this.value)" style="direction:ltr;"></td>"""
replace_pn = """                 <td><input type="date" class="pc-input" value="${b.opcDate || ''}" onchange="UI.updatePCRow('${b.id}', 'opcDate', this.value)" style="font-weight:700; color:var(--primary); width:130px;"></td>
                 <td><input type="text" class="pc-input" value="${b.phoneNumber || ''}" onchange="UI.updatePCRow('${b.id}', 'phoneNumber', this.value)" style="direction:ltr; min-width:145px;"></td>"""
if target_pn in content:
    content = content.replace(target_pn, replace_pn)
    print("Chunk PN applied")

# Fix Header Matching
target_2 = """                        } else if(cStr.includes('age') || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {"""
replace_2 = """                        } else if((cStr.includes('age') && !cStr.includes('page')) || cStr.includes('عمر')) {
                            fAge = colIdx;
                        } else if(cStr.includes('name') || cStr.includes('اسم') || cStr.includes('patient')) {"""
if target_2 in content:
    content = content.replace(target_2, replace_2)
    print("Chunk 2 applied")

# Fix Extraction & Mapping
target_3 = """                    // Only import valid rows (at least a name or code)
                    if (pName || pCode) {
                        // Extract numbers safely from Age (e.g. "72Y" -> "72")
                        let cleanAge = pAge ? String(pAge).match(/\\\\d+/) : null;
                        cleanAge = cleanAge ? cleanAge[0] : '';

                        let bookingData = {
                            id: 'PC' + new Date().getTime() + "_" + i,
                            patientName: pName || '',
                            patientCode: pCode || '',
                            patientAge: cleanAge, 
                            providerName: provider || '',
                            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', customData: ''
                        };
                        uploadPromises.push(API.createPostClinicBooking(bookingData));
                    }"""
replace_3 = """                    // Helper for strictly First and Last name
                    const formatName = (fName) => {
                        if(!fName) return '';
                        let str = String(fName).trim().replace(/\\s+/g, ' ');
                        let p = str.split(' ');
                        if(p.length <= 1) return str;
                        return p[0] + ' ' + p[p.length - 1];
                    };
                    // Helper for strictly First Name
                    const formatFirstName = (fName) => {
                        if(!fName) return '';
                        let str = String(fName).trim().replace(/\\s+/g, ' ');
                        return str.split(' ')[0];
                    };

                    // Only import valid rows (at least a name or code)
                    if (pName || pCode) {
                        let cleanAge = '';
                        try {
                            let matchObj = pAge ? String(pAge).match(/\\d+/) : null;
                            if (matchObj) cleanAge = matchObj[0];
                        } catch(e){}
                        
                        let cleanCode = pCode ? String(pCode).replace(/^PAT/i, '').trim() : '';

                        let bookingData = {
                            id: 'PC' + new Date().getTime() + "_" + i,
                            patientName: formatName(pName),
                            patientCode: cleanCode,
                            patientAge: cleanAge, 
                            providerName: formatFirstName(provider),
                            treatmentPlan: '', opcDate: '', phoneNumber: '', permit: '', referral: '', notifiedPatient: '', customData: ''
                        };
                        uploadPromises.push(API.createPostClinicBooking(bookingData));
                    }"""
if target_3 in content:
    content = content.replace(target_3, replace_3)
    print("Chunk 3 applied")
else:
    print("Chunk 3 not found. Trying simpler substitution.")
    target_3_alt = """                    if (pName || pCode) {
                        // Extract numbers safely from Age (e.g. "72Y" -> "72")"""
    if target_3_alt in content: print("Alt target 3 found but not replaced manually yet.")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
