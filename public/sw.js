// Legacy League Service Worker: Spiel bei wackligem Messe-WLAN offline spielbar; Bestenliste und KI laufen live über /api.
const C = 'legacy-league-v22';
const CORE = ['/', '/index.html', '/css/style.css', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/img/realcore-wordmark.png',
  '/js/main.js', '/js/manager.js', '/js/match.js', '/js/pitch.js', '/js/data.js', '/js/audio.js', '/js/i18n.js', '/js/i18n-en.js', '/js/pitch3d.js', '/js/intro.js', '/js/ui.js', '/js/voice.js', '/js/commentary.js', '/js/fx.js', '/js/ceremony.js', '/js/achievements.js', '/vendor/babylon-lite-9.js', '/models/player.glb?v=4'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api') || u.pathname.startsWith('/admin')) return;
  const put = res => { if (res && res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; };
  // Unveränderliche Dateien (Modelle, Bibliothek, Stimmen, Bilder): zuerst aus dem Speicher – schont schwaches WLAN
  const immutable = u.search.includes('v=') || /^\/(vendor|models|audio\/voice|img)\//.test(u.pathname);
  if (immutable) { e.respondWith(caches.match(r).then(m => m || fetch(r).then(put))); return; }
  e.respondWith(fetch(r).then(put).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('/index.html') : undefined))));
});
