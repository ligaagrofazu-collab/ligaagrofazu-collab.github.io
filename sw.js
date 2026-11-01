// AGRO FAZU — app instalável. Guarda só a tela de abertura e os ícones;
// os dados do portal vêm sempre do servidor (nada da liga fica salvo aqui).
// Também recebe as notificações: quando uma chega, pergunta ao portal quais são os avisos novos e mostra na tela.
const CACHE = 'agrofazu-v2';
const ARQUIVOS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png', '/favicon.png'];
const API = 'https://script.google.com/macros/s/AKfycbyIhh2gbRN4V_uqxy9U3yzJP-GT4PbIiMVhXxbZ_omgEyVcIfTPwL8zVVRdWKHke_jnnw/exec';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Sempre tenta a internet primeiro (para pegar atualizações); sem internet, usa a cópia guardada.
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (resp) {
    if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
    return resp;
  }).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match('/index.html'); });
  }));
});

// Notificação recebida
self.addEventListener('push', function (e) {
  e.waitUntil(self.registration.pushManager.getSubscription().then(function (s) {
    if (!s) return { avisos: [] };
    return fetch(API, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'pushPendentes', args: [s.endpoint] }) })
      .then(function (r) { return r.json(); });
  }).catch(function () { return { avisos: [] }; }).then(function (r) {
    let lista = (r && r.avisos) || [];
    if (!lista.length) lista = [{ id: 'geral', titulo: 'AGRO FAZU', texto: 'Você tem um aviso novo no portal.', tela: '' }];
    return Promise.all(lista.map(function (a) {
      return self.registration.showNotification(a.titulo, { body: a.texto, tag: a.id, icon: '/icon-192.png', data: { tela: a.tela || '' } });
    })).then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (janelas) {
      janelas.forEach(function (j) { j.postMessage({ tipo: 'aviso' }); });
    });
  }));
});

// Toque na notificação: abre o app na tela do aviso
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const tela = (e.notification.data && e.notification.data.tela) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (let i = 0; i < janelas.length; i++) {
      if ('focus' in janelas[i]) { janelas[i].postMessage({ tipo: 'abrir', tela: tela }); return janelas[i].focus(); }
    }
    return self.clients.openWindow('/' + (tela ? '#' + tela : ''));
  }));
});
