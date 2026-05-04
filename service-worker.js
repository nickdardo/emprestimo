// GEPainel - Service Worker
// Versão do cache (altere quando atualizar o app)
const CACHE_VERSION = 'gepainel-v1.0.0';
const CACHE_NAME = `gepainel-cache-${CACHE_VERSION}`;

// Arquivos essenciais para cache (offline-first)
const ESSENTIAL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
];

// Instalação - faz cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache aberto, salvando arquivos essenciais...');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('[SW] Arquivos essenciais salvos no cache');
        return self.skipWaiting(); // Ativa imediatamente
      })
      .catch((err) => {
        console.warn('[SW] Erro ao fazer cache:', err);
      })
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker ativado');
        return self.clients.claim(); // Controla todas as páginas imediatamente
      })
  );
});

// Estratégia de cache: Network First (prioriza rede, fallback para cache)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignora requisições que não sejam GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignora requisições para APIs externas (Supabase, etc)
  const url = new URL(request.url);
  if (url.origin.includes('supabase')) {
    return; // Supabase sempre vai direto para a rede
  }

  event.respondWith(
    // Tenta buscar da rede primeiro
    fetch(request)
      .then((networkResponse) => {
        // Se conseguiu da rede, salva no cache e retorna
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se falhou na rede, tenta buscar do cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Servindo do cache:', request.url);
              return cachedResponse;
            }
            
            // Se não tem no cache e é uma navegação, retorna a index.html
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Fallback genérico
            return new Response('Offline - conteúdo não disponível', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Listener para mensagens (ex: forçar atualização)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
