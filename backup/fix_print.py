import re

js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Find and replace the PC print block
old_block = """        let printWindow = window.open('', '_blank');
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
                ${pcPrintHeader}
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

new_block = """        let pcPrintHeader = UI.getPrintHeader('جدول حجوزات ما بعد العيادة');
        let pcHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>طباعة</title><style>'
            + 'body{font-family:Tahoma,sans-serif;direction:rtl;padding:20px;}'
            + 'table{width:100%;border-collapse:collapse;font-size:13px;}'
            + 'th,td{border:1px solid #333;padding:8px;text-align:right;vertical-align:top;}'
            + 'th{background:#eee;}'
            + '@media print{@page{size:landscape;margin:8mm;}body{padding:0;}}'
            + '</style></head><body>'
            + pcPrintHeader
            + '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rowsHTML + '</tbody></table>'
            + '<scr' + 'ipt>setTimeout(function(){window.print();window.close();},400);</scr' + 'ipt>'
            + '</body></html>';

        let printWindow = window.open('', '_blank');
        if (!printWindow) { UI.showToast('يرجى السماح بفتح النوافذ المنبثقة لعمل الطباعة', 'error'); return; }
        printWindow.document.write(pcHTML);
        printWindow.document.close();"""

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fixed PC print block")
else:
    print("PC print block NOT found - searching for partial match:")
    idx = content.find("let printWindow = window.open('', '_blank');\n        printWindow.document.write(`")
    print(f"Found at index: {idx}")
    # Try a simpler replacement
    old_simple = "let printWindow = window.open('', '_blank');\n        printWindow.document.write(`"
    new_simple = "let pcPrintHeader = UI.getPrintHeader('جدول حجوزات ما بعد العيادة');\n        let printWindow = window.open('', '_blank'); // PC print\n        printWindow.document.write(`"
    content = content.replace(old_simple, new_simple, 1)
    print("Applied simple fallback replacement")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
