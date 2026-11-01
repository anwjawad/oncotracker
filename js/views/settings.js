// Settings: connection to the Google Sheet, coordinator name, print header, migration, backup.
import { html, todayISO, readFileAs } from '../util.js';
import { settings, DEFAULT_API_URL } from '../settings.js';
import { api, resetLocal } from '../api.js';
import { store, sync, clearCache, pendingCount } from '../store.js';
import { icon, toast, confirmBox } from '../ui.js';
import { seedDemo } from '../demo.js';
import { registerActions } from '../registry.js';

export const title = 'الإعدادات';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function render() {
  const s = settings.all();
  const remote = api.mode() === 'remote';
  return html`
    <form class="stack" style="max-width:860px" data-settings-form>
      <section class="panel">
        <div class="panel-head"><h2>الاتصال بقاعدة البيانات</h2>
          <span class="chip ${!remote ? 'amber' : store.status.oldBackend ? 'red' : 'green'}">${!remote ? 'وضع تجريبي على هذا الجهاز فقط' : store.status.oldBackend ? 'الخادم على النسخة القديمة' : 'متصل بـ Google Sheets'}</span></div>
        <div class="panel-body stack">
          <label class="field"><span>رابط Google Apps Script</span>
            <input name="apiUrl" class="ltr" value="${s.apiUrl || DEFAULT_API_URL}">
            <span class="hint">الرابط مدمج في التطبيق ولا يحتاج أحد أن يكتبه. غيّره فقط إذا أنشأت نشراً جديداً (New deployment) برابط مختلف؛ تفريغ الحقل يعيد الرابط المدمج.</span></label>
          <label class="check"><input type="checkbox" name="localMode" ${s.localMode ? 'checked' : ''}> وضع تجريبي: بيانات وهمية على هذا الجهاز فقط، بدون اتصال بالخادم</label>
          <div class="row">
            <button type="button" class="btn" data-action="st-test">اختبار الاتصال</button>
            ${remote ? html`<button type="button" class="btn" data-action="st-migrate">${icon('upload')} ترحيل بيانات النسخة القديمة</button>` : ''}
          </div>
          ${remote ? html`<p class="small muted">الترحيل يقرأ أوراق PostClinicBookings و NewCasesMeeting القديمة وينشئ منها المرضى والزيارات وحالات اللجنة والمتابعات بالبنية الجديدة. الأوراق القديمة لا تُعدَّل، ويمكن تشغيله أكثر من مرة دون تكرار.</p>` : ''}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>المنسّق وطريقة العمل</h2></div>
        <div class="panel-body grid-2">
          <label class="field"><span>اسمك</span><input name="userName" value="${s.userName}" placeholder="يظهر في سجل التعديلات وملاحق القرارات">
            <span class="hint">كل منسّق يضع اسمه على جهازه.</span></label>
          <label class="field"><span>يوم انعقاد لجنة الحالات الجديدة</span><select name="committeeDay">
            ${DAYS.map((d, i) => html`<option value="${i}" ${Number(s.committeeDay) === i ? 'selected' : ''}>${d}</option>`)}</select></label>
          <label class="field"><span>المهلة الافتراضية للمتابعة الجديدة (أيام)</span><input name="followupDays" type="number" min="0" max="60" value="${s.followupDays}"></label>
          <label class="field"><span>المظهر</span><select name="theme">
            <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>حسب الجهاز</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>فاتح</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>داكن</option></select></label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>ترويسة الطباعة</h2></div>
        <div class="panel-body grid-2">
          <label class="field"><span>اسم المستشفى</span><input name="hospital" value="${s.hospital}"></label>
          <label class="field"><span>القسم</span><input name="department" value="${s.department}"></label>
          <div class="field span-2"><span>الشعار</span>
            <div class="row">${s.logo ? html`<img src="${s.logo}" alt="الشعار" style="max-height:56px; border:1px solid var(--line); border-radius:6px; padding:4px">` : ''}
              <input type="file" accept="image/*" data-logo class="input" style="width:auto">
              ${s.logo ? html`<button type="button" class="btn btn-sm btn-ghost" data-action="st-logo-remove">إزالة</button>` : ''}</div></div>
        </div>
      </section>

      <div class="row"><button type="submit" class="btn btn-primary">حفظ الإعدادات</button></div>

      <section class="panel">
        <div class="panel-head"><h2>النسخ الاحتياطي والصيانة</h2></div>
        <div class="panel-body stack">
          <div class="row">
            <button type="button" class="btn" data-action="st-backup">${icon('download')} تنزيل نسخة احتياطية (JSON)</button>
            <button type="button" class="btn" data-action="st-resync">${icon('undo')} إعادة تحميل البيانات من الخادم</button>
          </div>
          <p class="small muted">آخر مزامنة: ${store.status.lastSync ? new Date(store.status.lastSync).toLocaleString('ar-u-nu-latn') : 'لم تتم بعد'} — تعديلات بانتظار الإرسال: ${pendingCount()}</p>
          ${!remote ? html`<div class="row">
            <button type="button" class="btn" data-action="st-demo">تعبئة بيانات تجريبية</button>
            <button type="button" class="btn" style="color:var(--red)" data-action="st-wipe">مسح البيانات التجريبية</button></div>` : ''}
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
    const patch = {
      apiUrl: url === DEFAULT_API_URL ? '' : url, localMode: f.get('localMode') === 'on', userName: String(f.get('userName') || '').trim(),
      committeeDay: Number(f.get('committeeDay')), followupDays: Number(f.get('followupDays') || 3), theme: f.get('theme'),
      hospital: String(f.get('hospital') || '').trim(), department: String(f.get('department') || '').trim(),
    };
    if (patch.apiUrl && !/^https:\/\/script\.google(usercontent)?\.com\//.test(patch.apiUrl)) { toast('الرابط يجب أن يبدأ بـ https://script.google.com/', { type: 'error' }); return; }
    settings.set(patch);
    toast('حُفظت الإعدادات');
    if (before.apiUrl !== patch.apiUrl || before.localMode !== patch.localMode) {
      if (pendingCount() && !(await confirmBox(`توجد ${pendingCount()} تعديلات لم تُرسل بعد إلى المصدر السابق وستُفقد. متابعة؟`, { danger: true }))) { settings.set(before); return; }
      clearCache();
      sync().catch((err) => toast('تعذّر الاتصال: ' + err.message, { type: 'error' }));
    }
    document.dispatchEvent(new CustomEvent('settings-changed'));
  });
  form.querySelector('[data-logo]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 300 * 1024) { toast('الشعار كبير؛ اختر صورة أصغر من 300 كيلوبايت.', { type: 'error' }); return; }
    settings.set({ logo: await readFileAs(file, 'dataURL') });
    toast('حُفظ الشعار');
    document.dispatchEvent(new CustomEvent('settings-changed'));
  });
}

registerActions({
  'st-test': async () => {
    try { const r = await api.call('PING'); toast(r.mode === 'local' ? 'الوضع المحلي يعمل' : `الاتصال ناجح — ${r.sheet || 'Google Sheets'}`); }
    catch (e) { toast('فشل الاتصال: ' + e.message, { type: 'error' }); }
  },
  'st-migrate': async () => {
    if (!(await confirmBox('ترحيل بيانات النسخة القديمة إلى البنية الجديدة؟ لن تُحذف أو تُعدَّل الأوراق القديمة.', { confirm: 'ترحيل' }))) return;
    toast('جاري الترحيل… قد يستغرق دقيقة');
    try {
      const r = await api.call('MIGRATE_V1');
      await sync();
      toast(`تم الترحيل: ${r.patients} مريض، ${r.visits} زيارة، ${r.committee} حالة لجنة، ${r.followups} متابعة`, { timeout: 12000 });
    } catch (e) { toast('فشل الترحيل: ' + e.message, { type: 'error' }); }
  },
  'st-backup': () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: store.data }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onco-tracker-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  'st-resync': async () => { try { await sync(); toast('حُدّثت البيانات'); } catch (e) { toast('تعذّرت المزامنة: ' + e.message, { type: 'error' }); } },
  'st-logo-remove': () => { settings.set({ logo: '' }); document.dispatchEvent(new CustomEvent('settings-changed')); },
  'st-demo': async () => {
    if (!(await confirmBox('تعبئة بيانات تجريبية (أسماء وهمية) لتجربة التطبيق؟ تُستبدل البيانات التجريبية الحالية.'))) return;
    resetLocal(seedDemo()); clearCache(); await sync(); toast('أُضيفت البيانات التجريبية');
  },
  'st-wipe': async () => {
    if (!(await confirmBox('مسح كل البيانات المحفوظة في الوضع التجريبي على هذا الجهاز؟', { danger: true, confirm: 'مسح' }))) return;
    resetLocal(); clearCache(); await sync(); toast('مُسحت البيانات التجريبية');
  },
});
