const fs = require('fs');
const file = 'C:/Users/palliative/.gemini/antigravity/scratch/oncology-workflow-system/frontend/js/ui.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Master Registry focus restoration
let targetMR = `    renderMasterRegistry: async function() {
        this.title.textContent = 'السجل التاريخي الشامل للعيادات';`;

let replacementMR = `    renderMasterRegistry: async function() {
        this.title.textContent = 'السجل التاريخي الشامل للعيادات';
        
        let activeEl = document.activeElement;
        let isFocused = activeEl && activeEl.id === 'registry-search';
        let focusPos = isFocused ? activeEl.selectionStart : 0;`;

content = content.replace(targetMR, replacementMR);

let targetMR_End = `                <div style="overflow-x:auto;">
                    <table>`;

let replacementMR_End = `                <div style="overflow-x:auto;">
                    <table>`;
// Wait, I need to put the setTimeout focus restorer at the very end of renderMasterRegistry.
// Let's find the end of renderMasterRegistry instead.

let targetMR_Footer = `        this.container.innerHTML = \`
            <div class="card">`;
// Wait, innerHTML assignment is big. Let's do it after innerHTML assignment.

// Actually, I can just use regular expressions or precise replacements.
