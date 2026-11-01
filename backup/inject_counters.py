js_path = r'C:\Users\palliative\.gemini\antigravity\scratch\oncology-workflow-system\frontend\js\ui.js'
with open(js_path, 'r', encoding='utf-8') as f: content = f.read()

# Add animateCounter and call it in buildStatsBar / buildNCStatsBar

old_buildStats = """    buildStatsBar: function(data) {
        const total = data.length;
        const notified = data.filter(d => d.notifiedPatient === 'Y').length;
        const notNotified = total - notified;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>👥 إجمالي المرضى</span>
                <span class="stat-value">${total}</span>
            </div>
            <div class="stat-chip">
                <span>✅ تم تبليغهم</span>
                <span class="stat-value" style="color:#10b981;">${notified}</span>
            </div>
            <div class="stat-chip">
                <span>⏳ لم يتم تبليغهم</span>
                <span class="stat-value" style="color:#f59e0b;">${notNotified}</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value">${withPlan}</span>
            </div>
        </div>`;
    },"""

new_buildStats = """    animateCounters: function() {
        const els = document.querySelectorAll('.stat-value[data-target]');
        els.forEach(el => {
            const target = parseInt(el.getAttribute('data-target'), 10);
            const duration = 600;
            const start = performance.now();
            const step = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                el.textContent = Math.round(eased * target);
                if(progress < 1) requestAnimationFrame(step);
                else { el.textContent = target; el.classList.add('counting'); setTimeout(()=>el.classList.remove('counting'),400); }
            };
            requestAnimationFrame(step);
        });
    },

    buildStatsBar: function(data) {
        const total = data.length;
        const notified = data.filter(d => d.notifiedPatient === 'Y').length;
        const notNotified = total - notified;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;

        setTimeout(() => UI.animateCounters(), 100);

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>👥 إجمالي المرضى</span>
                <span class="stat-value" data-target="${total}">0</span>
            </div>
            <div class="stat-chip">
                <span>✅ تم تبليغهم</span>
                <span class="stat-value" data-target="${notified}" style="color:#10b981;">0</span>
            </div>
            <div class="stat-chip">
                <span>⏳ لم يتم تبليغهم</span>
                <span class="stat-value" data-target="${notNotified}" style="color:#f59e0b;">0</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value" data-target="${withPlan}">0</span>
            </div>
        </div>`;
    },"""

content = content.replace(old_buildStats, new_buildStats)

old_ncStats = """    buildNCStatsBar: function(data) {
        const total = data.length;
        const withHistory = data.filter(d => d.briefHistory && d.briefHistory.trim() !== '').length;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;
        const withNotes = data.filter(d => d.notes && d.notes.trim() !== '').length;

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>📁 إجمالي الحالات</span>
                <span class="stat-value">${total}</span>
            </div>
            <div class="stat-chip">
                <span>📖 لديهم تاريخ طبي</span>
                <span class="stat-value" style="color:#1d4ed8;">${withHistory}</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value" style="color:#b45309;">${withPlan}</span>
            </div>
            <div class="stat-chip">
                <span>📝 لديهم ملاحظات</span>
                <span class="stat-value">${withNotes}</span>
            </div>
        </div>`;
    }"""

new_ncStats = """    buildNCStatsBar: function(data) {
        const total = data.length;
        const withHistory = data.filter(d => d.briefHistory && d.briefHistory.trim() !== '').length;
        const withPlan = data.filter(d => d.treatmentPlan && d.treatmentPlan.trim() !== '').length;
        const withNotes = data.filter(d => d.notes && d.notes.trim() !== '').length;

        setTimeout(() => UI.animateCounters(), 100);

        return `
        <div class="session-stats-bar no-print">
            <div class="stat-chip">
                <span>📁 إجمالي الحالات</span>
                <span class="stat-value" data-target="${total}">0</span>
            </div>
            <div class="stat-chip">
                <span>📖 لديهم تاريخ طبي</span>
                <span class="stat-value" data-target="${withHistory}" style="color:#1d4ed8;">0</span>
            </div>
            <div class="stat-chip">
                <span>📋 لديهم خطة علاج</span>
                <span class="stat-value" data-target="${withPlan}" style="color:#b45309;">0</span>
            </div>
            <div class="stat-chip">
                <span>📝 لديهم ملاحظات</span>
                <span class="stat-value" data-target="${withNotes}">0</span>
            </div>
        </div>`;
    }"""

content = content.replace(old_ncStats, new_ncStats)
with open(js_path, 'w', encoding='utf-8') as f: f.write(content)
print("Animated counters injected.")
