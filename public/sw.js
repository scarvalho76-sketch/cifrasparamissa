// Ativa a versão nova do service worker imediatamente
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Modo celebração sem internet: com internet tudo segue normal; sem internet, a página da missa
// (e a tela do músico) e os arquivos delas saem do que foi guardado no aparelho.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const pagina = req.mode === 'navigate' && (url.pathname.startsWith('/missa/') || url.pathname.startsWith('/m/'));
  const arquivo = url.pathname.startsWith('/_next/static/');
  if (!pagina && !arquivo) return;
  event.respondWith(
    fetch(req).catch(() => caches.match(pagina ? url.pathname : req, { ignoreSearch: pagina })
      .then(r => r || Response.error()))
  );
});
