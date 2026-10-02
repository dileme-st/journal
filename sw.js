// ============================================================
// DILEME JOURNAL — Service Worker
// Estratégia: HTML network-first, assets cache-first
// ============================================================

const CACHE_VERSION = 'dileme-v3'; // ← só mude aqui se quiser forçar reset
const CACHE_NAME = 'dileme-cache-' + CACHE_VERSION;

// Assets pré-cacheados (não inclui index.html de propósito)
const PRECACHE_URLS = [
  './logo.png',
  './manifest.json'
];

// ---------- INSTALL ----------
self.addEventListener('install', event => {
  self.skipWaiting(); // Ativa imediatamente, não espera fechar abas antigas
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Se algum asset faltar, segue sem quebrar
      });
    })
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim()) // Toma controle imediato das abas
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignora requisições não-GET, do Google Apps Script, Drive, ou extensões
  if (req.method !== 'GET') return;
  if (url.hostname.includes('script.google.com')) return;
  if (url.hostname.includes('googleusercontent.com')) return;
  if (url.hostname.includes('drive.google.com')) return;
  if (url.hostname.includes('fonts.googleapis.com')) return;
  if (url.hostname.includes('fonts.gstatic.com')) return;
  if (url.protocol === 'chrome-extension:') return;

  // ---------- HTML: NETWORK-FIRST ----------
  // Navigation requests (abrir a página, F5, link direto)
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(response => {
          // Guarda uma cópia atualizada no cache como fallback offline
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req)) // Sem internet: usa cache
    );
    return;
  }

  // ---------- Assets: STALE-WHILE-REVALIDATE ----------
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ---------- MENSAGENS DO CLIENT ----------
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
