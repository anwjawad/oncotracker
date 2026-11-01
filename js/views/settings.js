// Settings: connection to the Google Sheet, language, doctors, print header, migration, backup.
import { html, todayISO, readFileAs, cleanPhysician, uniq } from '../util.js';
import { settings, DEFAULT_API_URL, DEFAULT_PHYSICIANS } from '../settings.js';
import { api, resetLocal } from '../api.js';
import { store, sync, clearCache, pendingCount } from '../store.js';
import { icon, toast, confirmBox, physicianList } from '../ui.js';
import { seedDemo } from '../demo.js';
import { registerActions } from '../registry.js';
import { tr, lang } from '../i18n.js';

export const title = () => tr('الإعدادات', 'Settings');

const DAYS = () => (lang() === 'en'
  ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  : ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']);

export function render() {
  const s = settings.all();
  const remote = api.mode() === 'remote';
  return html`
    <form class="stack" style="max-width:860px" data-settings-form>
      <section class="panel">
        <div class="panel-head"><h2>${tr('اللغة', 'Language')}</h2></div>
        <div class="panel-body">
          <div class="row">
            <label class="check chip outline" style="padding:6px 14px"><input type="radio" name="lang" value="ar" ${lang() === 'ar' ? 'checked' : ''}> العربية</label>
            <label class="check chip outline" style="padding:6px 14px"><input type="radio" name="lang" value="en" ${lang() === 'en' ? 'checked' : ''}> English</label>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${tr('الاتصال بقاعدة البيانات', 'Database connection')}</h2>
          <span class="chip ${!remote ? 'amber' : store.status.oldBackend ? 'red' : 'green'}">${!remote ? tr('وضع تجريبي على هذا الجهاز فقط', 'Demo mode, this device only') : store.status.oldBackend ? tr('الخادم على النسخة القديمة', 'Server runs the old script') : tr('متصل بـ Google Sheets', 'Connected to Google Sheets')}</span></div>
        <div class="panel-body stack">
          <label class="field"><span>${tr('رابط Google Apps Script', 'Google Apps Script link')}</span>
            <input name="apiUrl" class="ltr" value="${s.apiUrl || DEFAULT_API_URL}">
            <span class="hint">${tr('الرابط مدمج في التطبيق ولا يحتاج أحد أن يكتبه. غيّره فقط إذا أنشأت نشراً جديداً (New deployment) برابط مختلف؛ تفريغ الحقل يعيد الرابط المدمج.', 'The link is built into the app; nobody needs to type it. Change it only if you create a New deployment with a different link. Clearing the field restores the built-in link.')}</span></label>
          <label class="check"><input type="checkbox" name="localMode" ${s.localMode ? 'checked' : ''}> ${tr('وضع تجريبي: بيانات وهمية على هذا الجهاز فقط، بدون اتصال بالخادم', 'Demo mode: sample data on this device only, no server connection')}</label>
          <div class="row">
            <button type="button" class="btn" data-action="st-test">${tr('اختبار الاتصال', 'Test connection')}</button>
            ${remote ? html`<button type="button" class="btn" data-action="st-migrate">${icon('upload')} ${tr('ترحيل بيانات النسخة القديمة', 'Migrate data from the old version')}</button>` : ''}
          </div>
          ${remote ? html`<p class="small muted">${tr('الترحيل يقرأ أوراق PostClinicBookings و NewCasesMeeting القديمة وينشئ منها المرضى والزيارات وحالات اللجنة والمتابعات بالبنية الجديدة. الأوراق القديمة لا تُعدَّل، ويمكن تشغيله أكثر من مرة دون تكرار.', 'Migration reads the old PostClinicBookings and NewCasesMeeting sheets and builds patients, visits, committee cases and follow-ups from them. The old sheets are not changed, and running it again creates no duplicates.')}</p>` : ''}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${tr('الأطباء', 'Doctors')}</h2></div>
        <div class="panel-body stack">
          <label class="field"><span>${tr('أسماء الأطباء في قائمة الاختيار (اسم في كل سطر)', 'Doctors in the dropdown (one per line)')}</span>
            <textarea name="physicians" class="ltr" rows="6">${physicianList().join('\n')}</textarea>
            <span class="hint">${tr('تظهر عند إضافة مريض للجنة أو العيادة، مع خيار «آخر» لكتابة اسم غير موجود. يُعبّأ تلقائياً آخر طبيب استخدمته.', 'Shown when adding a patient to the committee or clinic, with "Other" for a name not on the list. The last doctor you used is pre-filled.')}</span></label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${tr('المنسّق وطريقة العمل', 'Coordinator and workflow')}</h2></div>
        <div class="panel-body grid-2">
          <label class="field"><span>${tr('اسمك', 'Your name')}</span><input name="userName" value="${s.userName}" placeholder="${tr('يظهر في سجل التعديلات وملاحق القرارات', 'Shown in the change log and on addenda')}">
            <span class="hint">${tr('كل منسّق يضع اسمه على جهازه.', 'Each coordinator sets their own name on their device.')}</span></label>
          <label class="field"><span>${tr('يوم انعقاد لجنة الحالات الجديدة', 'Committee meeting day')}</span><select name="committeeDay">
            ${DAYS().map((d, i) => html`<option value="${i}" ${Number(s.committeeDay) === i ? 'selected' : ''}>${d}</option>`)}</select></label>
          <label class="field"><span>${tr('المهلة الافتراضية للمتابعة الجديدة (أيام)', 'Default due time for new follow-ups (days)')}</span><input name="followupDays" type="number" min="0" max="60" value="${s.followupDays}"></label>
          <label class="field"><span>${tr('المظهر', 'Appearance')}</span><select name="theme">
            <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>${tr('حسب الجهاز', 'Match device')}</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>${tr('فاتح', 'Light')}</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>${tr('داكن', 'Dark')}</option></select></label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${tr('ترويسة الطباعة', 'Print header')}</h2></div>
        <div class="panel-body grid-2">
          <label class="field"><span>${tr('اسم المستشفى', 'Hospital')}</span><input name="hospital" value="${s.hospital}"></label>
          <label class="field"><span>${tr('القسم', 'Department')}</span><input name="department" value="${s.department}"></label>
          <div class="field span-2"><span>${tr('الشعار', 'Logo')}</span>
            <div class="row">${s.logo ? html`<img src="${s.logo}" alt="${tr('الشعار', 'Logo')}" style="max-height:56px; border:1px solid var(--line); border-radius:6px; padding:4px">` : ''}
              <input type="file" accept="image/*" data-logo class="input" style="width:auto">
              ${s.logo ? html`<button type="button" class="btn btn-sm btn-ghost" data-action="st-logo-remove">${tr('إزالة', 'Remove')}</button>` : ''}</div></div>
        </div>
      </section>

      <div class="row"><button type="submit" class="btn btn-primary">${tr('حفظ الإعدادات', 'Save settings')}</button></div>

      <section class="panel">
        <div class="panel-head"><h2>${tr('النسخ الاحتياطي والصيانة', 'Backup and maintenance')}</h2></div>
        <div class="panel-body stack">
          <div class="row">
            <button type="button" class="btn" data-action="st-backup">${icon('download')} ${tr('تنزيل نسخة احتياطية (JSON)', 'Download backup (JSON)')}</button>
            <button type="button" class="btn" data-action="st-resync">${icon('undo')} ${tr('إعادة تحميل البيانات من الخادم', 'Reload data from server')}</button>
          </div>
          <p class="small muted">${tr('آخر مزامنة', 'Last sync')}: ${store.status.lastSync ? new Date(store.status.lastSync).toLocaleString(lang() === 'en' ? 'en-GB' : 'ar-u-nu-latn') : tr('لم تتم بعد', 'not yet')} — ${tr('تعديلات بانتظار الإرسال', 'changes waiting to send')}: ${pendingCount()}</p>
          ${!remote ? html`<div class="row">
            <button type="button" class="btn" data-action="st-demo">${tr('تعبئة بيانات تجريبية', 'Load sample data')}</button>
            <button type="button" class="btn" style="color:var(--red)" data-action="st-wipe">${tr('مسح البيانات التجريبية', 'Clear sample data')}</button></div>` : ''}
        </div>
      </section>
    </form>`;
}

export function mount(root) {
  const form = root.querySelector('[data-settings-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const before = { apiUrl: settings.get('apiUrl'), localMode: settings.get('localMode') };
    const url = String(f.get('apiUrl') || '').trim();
    const docs = uniq(String(f.get('physicians') || '').split(/[\n,]+/).map(cleanPhysician).filter(Boolean));
    const patch = {
      apiUrl: url === DEFAULT_API_URL ? '' : url, localMode: f.get('localMode') === 'on', userName: String(f.get('userName') || '').trim(),
      lang: f.get('lang') === 'en' ? 'en' : 'ar', physicians: docs.length ? docs : DEFAULT_PHYSICIANS,
      committeeDay: Number(f.get('committeeDay')), followupDays: Number(f.get('followupDays') || 3), theme: f.get('theme'),
      hospital: String(f.get('hospital') || '').trim(), department: String(f.get('department') || '').trim(),
    };
    if (patch.apiUrl && !/^https:\/\/script\.google(usercontent)?\.com\//.test(patch.apiUrl)) { toast(tr('الرابط يجب أن يبدأ بـ https://script.google.com/', 'The link must start with https://script.google.com/'), { type: 'error' }); return; }
    settings.set(patch);
    toast(tr('حُفظت الإعدادات', 'Settings saved'));
    if (before.apiUrl !== patch.apiUrl || before.localMode !== patch.localMode) {
      if (pendingCount() && !(await confirmBox(tr(`توجد ${pendingCount()} تعديلات لم تُرسل بعد إلى المصدر السابق وستُفقد. متابعة؟`, `${pendingCount()} changes have not been sent to the previous source and will be lost. Continue?`), { danger: true }))) { settings.set(before); return; }
      clearCache();
      sync().catch((err) => toast(`${tr('تعذّر الاتصال', 'Could not connect')}: ${err.message}`, { type: 'error' }));
    }
    document.dispatchEvent(new CustomEvent('settings-changed'));
  });
  // Language applies immediately, without pressing save.
  form.querySelectorAll('[name=lang]').forEach((r) => r.addEventListener('change', () => {
    settings.set({ lang: r.value });
    document.dispatchEvent(new CustomEvent('settings-changed'));
  }));
  form.querySelector('[data-logo]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 300 * 1024) { toast(tr('الشعار كبير؛ اختر صورة أصغر من 300 كيلوبايت.', 'The logo is too large; choose an image under 300 KB.'), { type: 'error' }); return; }
    settings.set({ logo: await readFileAs(file, 'dataURL') });
    toast(tr('حُفظ الشعار', 'Logo saved'));
    document.dispatchEvent(new CustomEvent('settings-changed'));
  });
}

registerActions({
  'st-test': async () => {
    try { const r = await api.call('PING'); toast(r.mode === 'local' ? tr('الوضع المحلي يعمل', 'Demo mode is working') : `${tr('الاتصال ناجح', 'Connected')} — ${r.sheet || 'Google Sheets'}`); }
    catch (e) { toast(`${tr('فشل الاتصال', 'Connection failed')}: ${e.message}`, { type: 'error' }); }
  },
  'st-migrate': async () => {
    if (!(await confirmBox(tr('ترحيل بيانات النسخة القديمة إلى البنية الجديدة؟ لن تُحذف أو تُعدَّل الأوراق القديمة.', 'Migrate the old version\'s data to the new structure? The old sheets are not deleted or changed.'), { confirm: tr('ترحيل', 'Migrate') }))) return;
    toast(tr('جاري الترحيل… قد يستغرق دقيقة', 'Migrating… this can take a minute'));
    try {
      const r = await api.call('MIGRATE_V1');
      await sync();
      toast(tr(`تم الترحيل: ${r.patients} مريض، ${r.visits} زيارة، ${r.committee} حالة لجنة، ${r.followups} متابعة`, `Migrated: ${r.patients} patients, ${r.visits} visits, ${r.committee} committee cases, ${r.followups} follow-ups`), { timeout: 12000 });
    } catch (e) { toast(`${tr('فشل الترحيل', 'Migration failed')}: ${e.message}`, { type: 'error' }); }
  },
  'st-backup': () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: store.data }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onco-tracker-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  'st-resync': async () => { try { await sync(); toast(tr('حُدّثت البيانات', 'Data reloaded')); } catch (e) { toast(`${tr('تعذّرت المزامنة', 'Sync failed')}: ${e.message}`, { type: 'error' }); } },
  'st-logo-remove': () => { settings.set({ logo: '' }); document.dispatchEvent(new CustomEvent('settings-changed')); },
  'st-demo': async () => {
    if (!(await confirmBox(tr('تعبئة بيانات تجريبية (أسماء وهمية) لتجربة التطبيق؟ تُستبدل البيانات التجريبية الحالية.', 'Load sample data (fictional names) to try the app? Current sample data is replaced.')))) return;
    resetLocal(seedDemo()); clearCache(); await sync(); toast(tr('أُضيفت البيانات التجريبية', 'Sample data loaded'));
  },
  'st-wipe': async () => {
    if (!(await confirmBox(tr('مسح كل البيانات المحفوظة في الوضع التجريبي على هذا الجهاز؟', 'Clear all demo-mode data on this device?'), { danger: true, confirm: tr('مسح', 'Clear') }))) return;
    resetLocal(); clearCache(); await sync(); toast(tr('مُسحت البيانات التجريبية', 'Sample data cleared'));
  },
});
