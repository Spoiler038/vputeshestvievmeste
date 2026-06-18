// ============================================================
// ВПУТЕШЕСТВИЕВМЕСТЕ — Service Worker
// Версию обновлять при каждом деплое для инвалидации кеша
// ============================================================
const CACHE_NAME   = 'vputi-v2';
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ── Установка: кешируем ключевые ресурсы с обработкой ошибок ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Кешируем каждый файл по отдельности, игнорируя ошибки
        return Promise.allSettled(
          CACHE_ASSETS.map(url => {
            return fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
              console.warn('Failed to cache:', url, response.status);
              return Promise.resolve();
            }).catch(err => {
              console.warn('Failed to cache:', url, err);
              return Promise.resolve();
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── Активация: удаляем старые кеши ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Запросы: network-first, fallback кеш ─────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('supabase.co') || url.includes('cloudinary.com') ||
      url.includes('googleapis.com') || url.includes('api.anthropic')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push уведомления ──────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'ВПУТЕШЕСТВИЕВМЕСТЕ', body: 'Новое уведомление', icon: '/vputeshestvievmeste/icons/android/192.png' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body:    data.body,
    icon:    data.icon || '/vputeshestvievmeste/icons/android/192.png',
    badge:   '/vputeshestvievmeste/icons/android/72.png',
    tag:     data.tag  || 'vputi-notification',
    data:    { url: data.url || '/' },
    actions: data.actions || [],
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
          if (client.url === targetUrl && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
