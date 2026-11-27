/* Certificate Registry: offline support.
   The app page is fetched from the network whenever possible (so updates arrive), and the last good copy is used when
   there is no signal or the connection is very slow. Your certificates are NOT kept here: they live in the browser's own
   database on this device, which this file never touches. */
const VERSION = '2026-11-27a';
const CACHE = 'certificate-registry-' + VERSION;
const FILES = ['index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('certificate-registry-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
function withTimeout(promise, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
async function pageStrategy(req){
  const cache = await caches.open(CACHE);
  try{
    const res = await withTimeout(fetch(req), 4000);
    if(res && res.status === 200) cache.put('index.html', res.clone());
    return res;
  }catch(err){
    return (await cache.match('index.html')) || (await caches.match('index.html')) || Response.error();
  }
}
async function assetStrategy(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res && res.status === 200) cache.put(req, res.clone());
  return res;
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;            // fonts and anything else: left to the browser
  if(url.pathname.includes('/test/')) return;                // the separate test copy is never cached or served from here
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  event.respondWith(isPage ? pageStrategy(req) : assetStrategy(req));
});
