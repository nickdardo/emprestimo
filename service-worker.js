// service-worker.js
// PWA do GEPainel — estratégia "network first" para sempre buscar a versão mais recente.
// Cache mínimo só para permitir abertura offline básica.

const CACHE_VERSION = 'gepainel-v1';
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ─── Instalação: cacheia apenas o essencial ─────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting(); // ativa imediatamente, sem esperar abas antigas fecharem
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Falha ao cachear core assets:', err);
      })
    )
  );
});

// ─── Ativação: limpa caches antigos ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: estratégia network-first com fallback offline ───────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só intercepta GET — POST/PUT/etc precisam ir direto pra rede
  if (req.method !== 'GET') return;

  // Não intercepta APIs (Asaas, Supabase, /api/*) — sempre rede
  const url = new URL(req.url);
  const isApi =
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('asaas') ||
    url.hostname.includes('googleapis');
  if (isApi) return;

  // Network-first: tenta rede, se falhar usa cache
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Cacheia a resposta para uso offline futuro (apenas ok 200)
        if (response.ok && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(req, respClone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});
