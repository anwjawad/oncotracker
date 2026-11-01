import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

target = """<button class="btn btn-primary" onclick="window.print()" style="background:#334155;">🖨️ طباعة</button>"""
replace = """<button class="btn btn-primary" onclick="UI.printPostClinicTable()" style="background:#334155;">🖨️ طباعة كجدول</button>"""

if target in content:
    content = content.replace(target, replace)
    print("Print button updated.")

append_logic = """
    ,
    printPostClinicTable: async function() {
        let data = await API.getPostClinicBookings();
        if(!data || data.length === 0) {
            UI.showToast("لا يوجد بيانات للطباعة", "error");
            return;
        }

        let customCols = [];
        data.forEach(row => {
            if(row.customData) {
                try {
                    let custom = JSON.parse(row.customData);
                    Object.keys(custom).forEach(key => {
                        if(!customCols.includes(key)) customCols.push(key);
                    });
                } catch(e) {}
            }
        });

        let headers = `<th>Patient Name</th><th>Code</th><th>Age</th><th>Provider</th><th>Treatment Plan</th><th>OPC Appt</th><th>Phone</th><th>Notified</th><th>Permit</th><th>Referral</th>`;
        customCols.forEach(col => headers += `<th>${col}</th>`);

        let rowsHTML = data.map(b => {
             let customData = {};
             if(b.customData) try { customData = JSON.parse(b.customData); } catch(e){}
             let customTds = customCols.map(col => `<td>${customData[col] || ''}</td>`).join('');
             return `
             <tr>
                 <td style="font-weight:bold;">${b.patientName || ''}</td>
                 <td style="font-family:monospace;">${b.patientCode || ''}</td>
                 <td style="text-align:center;">${b.patientAge || ''}</td>
                 <td>${b.providerName || ''}</td>
                 <td style="max-width:350px; white-space:pre-wrap;">${(b.treatmentPlan || '').replace(/\\n/g, '<br>')}</td>
                 <td style="white-space:nowrap;">${b.opcDate || ''}</td>
                 <td style="direction:ltr;">${b.phoneNumber || ''}</td>
                 <td style="text-align:center;">${b.notifiedPatient === 'Y' ? '✅' : ''}</td>
                 <td style="text-align:center;">${b.permit || ''}</td>
                 <td style="text-align:center;">${b.referral || ''}</td>
                 ${customTds}
             </tr>`;
        }).join('');

        let printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة حجوزات ما بعد العيادة</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    th, td { border: 1px solid #333; padding: 8px; text-align: right; vertical-align: top; }
                    th { border-bottom: 2px solid #000; background: #eee; }
                    @media print {
                        @page { size: landscape; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h2 style="text-align:center; margin-bottom: 20px;">جدول حجوزات ما بعد العيادة</h2>
                <table>
                    <thead><tr>${headers}</tr></thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
                <script>
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
};

// END OF UI.JS
"""

# Since UI is declared as `const UI = { ... };`, the very last line is probably `};`
# I will use re to replace the last occurance of `};`
import re
content = re.sub(r'};\s*$', append_logic, content)

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
