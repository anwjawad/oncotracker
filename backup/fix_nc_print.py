js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

old_nc = """        let printWindow = window.open('', '_blank');
        let ncPrintHeader = UI.getPrintHeader('جدول لجنة الحالات الجديدة');
        printWindow.document.write(`
            <html>
            <head>
                <title>طباعة لجنة الحالات الجديدة</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    th, td { border: 1px solid #333; padding: 10px; text-align: right; vertical-align: middle; }
                    th { border-bottom: 2px solid #000; background: #f1f5f9; font-size:15px; }
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${ncPrintHeader}
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
        printWindow.document.close();"""

new_nc = """        let ncPrintHeader = UI.getPrintHeader('جدول لجنة الحالات الجديدة');
        let ncHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>طباعة لجنة الحالات</title><style>'
            + 'body{font-family:Tahoma,sans-serif;direction:rtl;padding:20px;}'
            + 'table{width:100%;border-collapse:collapse;font-size:13px;}'
            + 'th,td{border:1px solid #333;padding:10px;text-align:right;vertical-align:top;}'
            + 'th{background:#f1f5f9;font-size:14px;}'
            + '@media print{@page{size:landscape;margin:8mm;}body{padding:0;}}'
            + '</style></head><body>'
            + ncPrintHeader
            + '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rowsHTML + '</tbody></table>'
            + '<scr' + 'ipt>setTimeout(function(){window.print();window.close();},400);</scr' + 'ipt>'
            + '</body></html>';

        let printWindow = window.open('', '_blank');
        if (!printWindow) { UI.showToast('يرجى السماح بفتح النوافذ المنبثقة لعمل الطباعة', 'error'); return; }
        printWindow.document.write(ncHTML);
        printWindow.document.close();"""

if old_nc in content:
    content = content.replace(old_nc, new_nc)
    print("Fixed NC print block")
else:
    print("NC block not found")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
