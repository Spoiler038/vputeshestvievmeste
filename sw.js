// ============================================================
// ВПУТЕШЕСТВИЕВМЕСТЕ — Service Worker
// ============================================================
const CACHE_NAME = 'vputi-v5';
const CACHE_ASSETS = [
  '/vputeshestvievmeste/',
  '/vputeshestvievmeste/index.html',
  '/vputeshestvievmeste/manifest.json',
  '/vputeshestvievmeste/icons/android/72.png',
  '/vputeshestvievmeste/icons/android/192.png',
  '/vputeshestvievmeste/icons/android/512.png',
  '/vputeshestvievmeste/icons/ios/180.png',
];

// ── Установка ────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('📦 SW install:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Кеширование...');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('✅ Кеширование завершено');
        return self.skipWaiting();
      })
      .catch(err => {
        console.warn('⚠️ Ошибка кеширования:', err);
      })
  );
});

// ── Активация ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('🚀 SW activate:', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('🗑 Удаление:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('✅ Активация завершена');
        return self.clients.claim();
      })
  );
});

// ── Перехват запросов ────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Пропускаем внешние API
  if (url.includes('supabase.co') || 
      url.includes('cloudinary.com') ||
      url.includes('googleapis.com') ||
      url.includes('api.anthropic') ||
      url.includes('raw.githubusercontent.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('/vputeshestvievmeste/index.html');
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
    icon: '/vputeshestvievmeste/icons/android/192.png' 
  };
  
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/vputeshestvievmeste/icons/android/192.png',
    badge: '/vputeshestvievmeste/icons/android/72.png',
    tag: data.tag || 'vputi-notification',
    data: { url: data.url || '/vputeshestvievmeste/' },
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
  const targetUrl = (event.notification.data && event.notification.data.url) || '/vputeshestvievmeste/';

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
