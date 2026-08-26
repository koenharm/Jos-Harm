// Firebase Cloud Messaging — ontvangt pushberichten terwijl de app dicht is
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: "AIzaSyAlBj9lTKbI6I1Cl4HTGIVS9A5hiCzPQ14",
  databaseURL: "https://jos-harm-werkplaats-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "jos-harm-werkplaats",
  messagingSenderId: "125238066819",
  appId: "1:125238066819:web:942b468c85591691cc65b6"
});
try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = (payload.data && payload.data.title) || (payload.notification && payload.notification.title) || 'Werkplaats';
    const body = (payload.data && payload.data.body) || (payload.notification && payload.notification.body) || '';
    self.registration.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png' });
  });
} catch (e) { /* messaging niet beschikbaar */ }

const CACHE_NAME = 'werkplaats-v29';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes('index.html'));
      if (existing) return existing.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
