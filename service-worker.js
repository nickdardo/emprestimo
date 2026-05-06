// ════════════════════════════════════════════════════════════════
// GEPainel — Service Worker
// Cache de assets para funcionamento offline básico do PWA.
// ════════════════════════════════════════════════════════════════

const CACHE_NAME = 'gepainel-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/login.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/themes.css',
  '/css/responsive.css',
  '/js/config.js',
  '/js/state.js',
  '/js/session.js',
  '/js/utils.js',
  '/js/sidebar.js',
  '/js/auth.js',
  '/js/indicacao.js',
  '/js/whatsapp.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/emprestimos.js',
  '/js/parcelas.js',
  '/js/clientes.js',
  '/js/simulador.js',
  '/js/perfil.js',
  '/js/usuarios.js',
  '/js/notificacoes.js',
  '/js/pagamento.js',
  '/js/relatorios.js',
  '/js/init.js',
  '/js/pwa.js',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png',
  '/icons/apple-touch-icon.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/site.webmanifest'
];

// Instalação: faz cache dos assets essenciais.
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Falha ao cachear alguns assets:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos.
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: estratégia "Network First" para HTML/JS/CSS, "Cache First" para imagens/fontes.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignora requisições que não são GET ou que vão para outras origens (Supabase, CDNs)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network First para HTML / JS / CSS
  if (/\.(html|js|css)$|\/$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache First para imagens, fontes, ícones
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      return res;
    }))
  );
});
