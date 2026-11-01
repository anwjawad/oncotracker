// Offline shell: network first for app files, cached copy when offline.
// Data never goes through this cache — it lives in the Google Sheet.
const CACHE = 'onco-v2-shell-2';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/main.js', 'js/i18n.js', 'js/util.js', 'js/settings.js', 'js/api.js', 'js/store.js', 'js/rules.js', 'js/ui.js', 'js/registry.js',
  'js/patient.js', 'js/print.js', 'js/importer.js', 'js/demo.js',
  'js/views/today.js', 'js/views/committee.js', 'js/views/clinic.js', 'js/views/followups.js',
  'js/views/patients.js', 'js/views/quality.js', 'js/views/reports.js', 'js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Removes caches left by this and the previous version of the app.
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
