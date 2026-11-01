import os
js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Chunk 2: Add formatFirstName
target_2 = "                // Helper to get strictly First and Last Name"
replace_2 = """                // Helper to get exactly First Name
                const formatFirstName = (fullName) => {
                    if(!fullName) return '';
                    let str = String(fullName).trim().replace(/\\s+/g, ' ');
                    return str.split(' ')[0];
                };

                // Helper to get strictly First and Last Name"""
if "formatFirstName" not in content and target_2 in content:
    content = content.replace(target_2, replace_2)
    print("Chunk 2 applied")
elif "formatFirstName" in content:
    print("Chunk 2 already exists")

# Chunk 3: Fix Age Column matching logic
target_3 = "cStr === 'age' || cStr === 'patientage' || cStr.includes('عمر')"
replace_3 = "(cStr.includes('age') && !cStr.includes('page')) || cStr.includes('عمر')"
if target_3 in content:
    content = content.replace(target_3, replace_3)
    print("Chunk 3 applied")

# Chunk 4: Use formatFirstName in object creation
import re
# Regex to find: providerName: formatName(provider),
target_4 = r"providerName:\s*formatName\(provider\),"
replace_4 = r"providerName: formatFirstName(provider),"
if re.search(target_4, content):
    content = re.sub(target_4, replace_4, content)
    print("Chunk 4 applied")

with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
