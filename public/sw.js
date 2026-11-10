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
  // Abrir o aplicativo pelo ícone (começa em "/"): sem internet, vai para a tela do músico guardada
  if (req.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(fetch(req).catch(async () => {
      const cache = await caches.open('missa-celebracao-v1');
      const musico = (await cache.keys()).map(k => new URL(k.url).pathname).find(p => p.startsWith('/m/'));
      if (!musico) return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px;background:#f7f1e4;color:#3a2c1c"><h2>Sem internet</h2><p>Para abrir o app sem internet, antes baixe uma missa para uso sem internet, com internet.</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return new Response('<!doctype html><meta charset="utf-8"><script>location.replace(' + JSON.stringify(musico) + ')</script>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }));
    return;
  }
  const pagina = req.mode === 'navigate' && (url.pathname.startsWith('/missa/') || url.pathname.startsWith('/m/') || url.pathname.startsWith('/evento/'));
  const arquivo = url.pathname.startsWith('/_next/static/') || url.pathname === '/emblema.webp';
  if (!pagina && !arquivo) return;
  event.respondWith(
    fetch(req).catch(() => caches.match(pagina ? url.pathname : req, { ignoreSearch: pagina })
      .then(r => r || Response.error()))
  );
});
