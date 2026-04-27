const fs = require('fs');
const file = 'C:/Users/palliative/.gemini/antigravity/scratch/oncology-workflow-system/frontend/js/ui.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        const pcData = await API.getPostClinicBookings();
        const ncData = await API.getNewCasesMeeting();

        let followUps = [];

        pcData.forEach(b => {
            if(b.followUpStatus === 'ACTIVE') {
                followUps.push({
                    id: b.id,
                    source: 'PC',
                    patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientCode || '---',
                    providerName: b.providerName || 'غير محدد',
                    sessionDate: b.sessionDate || '---',
                    followUpNotes: b.followUpNotes || 'لا توجد ملاحظات',
                    notifiedPatient: b.notifiedPatient === 'Y'
                });
            }
        });

        ncData.forEach(b => {
            let cData = this.parseNCCustomData(b.customData);
            if(cData.followUpStatus === 'ACTIVE') {
                followUps.push({
                    id: b.id,
                    source: 'NC',
                    patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientId || '---',
                    providerName: b.primaryPhysician || 'غير محدد',
                    sessionDate: b.sessionDate || '---',
                    followUpNotes: cData.followUpNotes || 'لا توجد ملاحظات',
                    notifiedPatient: cData.notifiedPatient === 'Y'
                });
            }
        });

        followUps.sort((a,b) => new Date(a.sessionDate || 0) - new Date(b.sessionDate || 0));

        let query = (this.followUpSearchQuery || '').toLowerCase().trim();
        let filtered = followUps.filter(b => 
            b.patientName.toLowerCase().includes(query) || 
            b.patientCode.includes(query) || 
            b.followUpNotes.toLowerCase().includes(query) ||
            b.providerName.toLowerCase().includes(query)
        );

        let unnotified = filtered.filter(b => !b.notifiedPatient);
        let notified = filtered.filter(b => b.notifiedPatient);`;

const replacementStr = `        const pcData = await API.getPostClinicBookings();
        const ncData = await API.getNewCasesMeeting();

        let followUps = [];
        let unnotified = [];
        
        const fallbackToday = new Date().toLocaleDateString('en-CA');
        const activePCDate = window.globalArchiveDate || fallbackToday;
        const archivedNCDates = JSON.parse(localStorage.getItem('archivedNCDates') || '[]');

        pcData.forEach(b => {
            if(b.followUpStatus === 'ACTIVE') {
                followUps.push({
                    id: b.id, source: 'PC', patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientCode || '---', providerName: b.providerName || 'غير محدد',
                    sessionDate: b.sessionDate || '---', followUpNotes: b.followUpNotes || 'لا توجد ملاحظات'
                });
            } else if (b.notifiedPatient !== 'Y' && b.sessionDate === activePCDate) {
                unnotified.push({
                    id: b.id, source: 'PC', patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientCode || '---', providerName: b.providerName || 'غير محدد',
                    sessionDate: b.sessionDate || '---', followUpNotes: 'بانتظار تبليغ المريض'
                });
            }
        });

        ncData.forEach(b => {
            let cData = this.parseNCCustomData(b.customData);
            if(cData.followUpStatus === 'ACTIVE') {
                followUps.push({
                    id: b.id, source: 'NC', patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientId || '---', providerName: b.primaryPhysician || 'غير محدد',
                    sessionDate: b.sessionDate || '---', followUpNotes: cData.followUpNotes || 'لا توجد ملاحظات'
                });
            } else if (cData.notifiedPatient !== 'Y' && !archivedNCDates.includes(b.sessionDate)) {
                unnotified.push({
                    id: b.id, source: 'NC', patientName: b.patientName || 'بدون اسم',
                    patientCode: b.patientId || '---', providerName: b.primaryPhysician || 'غير محدد',
                    sessionDate: b.sessionDate || '---', followUpNotes: 'بانتظار تبليغ المريض'
                });
            }
        });

        followUps.sort((a,b) => new Date(a.sessionDate || 0) - new Date(b.sessionDate || 0));
        unnotified.sort((a,b) => new Date(a.sessionDate || 0) - new Date(b.sessionDate || 0));

        let query = (this.followUpSearchQuery || '').toLowerCase().trim();
        
        let notified = followUps.filter(b => 
            b.patientName.toLowerCase().includes(query) || b.patientCode.includes(query) || 
            b.followUpNotes.toLowerCase().includes(query) || b.providerName.toLowerCase().includes(query)
        );
        unnotified = unnotified.filter(b => 
            b.patientName.toLowerCase().includes(query) || b.patientCode.includes(query) || 
            b.followUpNotes.toLowerCase().includes(query) || b.providerName.toLowerCase().includes(query)
        );`;

content = content.replace(targetStr, replacementStr);

const targetStr2 = `row.followUpStatus = 'FINISHED';
            row.followUpNotes = null;
            this._masterRegistryCache = null;`;
            
const replacementStr2 = `row.followUpStatus = 'FINISHED';
            row.followUpNotes = null;
            row.notifiedPatient = 'Y';
            this._masterRegistryCache = null;`;
            
content = content.replace(targetStr2, replacementStr2);

const targetStr3 = `cData.followUpStatus = 'FINISHED';
            cData.followUpNotes = null;
            row.customData = JSON.stringify(cData);`;
            
const replacementStr3 = `cData.followUpStatus = 'FINISHED';
            cData.followUpNotes = null;
            cData.notifiedPatient = 'Y';
            row.customData = JSON.stringify(cData);`;

content = content.replace(targetStr3, replacementStr3);

fs.writeFileSync(file, content);
console.log('Script completed.');
