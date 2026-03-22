/* Echoes Service Worker v1.1 */
const CACHE = 'echoes-v1';

/* Only cache files that actually exist */
const SHELL = [
  '/',
  '/index.html',
  '/style/style.css',
  '/style/footer.css',
  '/scripts/supabase-config.js',
  '/scripts/script.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => {
        /* addAll fails if ANY file 404s — use individual add with catch instead */
        return Promise.allSettled(
          SHELL.map(url => c.add(url).catch(() => {}))
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Never cache Supabase API calls */
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  /* Cache-first for everything else */
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
      .catch(() => caches.match('/index.html'))
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title || 'Echoes', {
    body: data.body || 'A memory is waiting for you.',
    icon: '/icons/icon-192.png',
    tag: data.tag || 'echoes',
    data: data.url || '/'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data));
});