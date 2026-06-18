// ============================================================
// ВПУТЕШЕСТВИЕВМЕСТЕ — Service Worker
// ============================================================
const CACHE_NAME = 'vputi-v3';
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ── Установка ────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Кеширование ресурсов...');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── Активация ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// ── Запросы ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Пропускаем запросы к внешним API
  const url = event.request.url;
  if (url.includes('supabase.co') || 
      url.includes('cloudinary.com') ||
      url.includes('googleapis.com') ||
      url.includes('api.anthropic')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Кешируем только успешные ответы с нашего сайта
        if (response.ok && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Если нет сети — пытаемся отдать из кеша
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            // Если нет в кеше — показываем офлайн-страницу
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Офлайн', { status: 503 });
          });
      })
  );
});

// ── Push уведомления ─────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { 
    title: 'ВПУТЕШЕСТВИЕВМЕСТЕ', 
    body: 'Новое уведомление', 
    icon: './icons/android/192.png' 
  };
  
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || './icons/android/192.png',
    badge: './icons/android/72.png',
    tag: data.tag || 'vputi-notification',
    data: { url: data.url || './' },
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Клик по уведомлению ──────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
