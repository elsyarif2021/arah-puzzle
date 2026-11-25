const cacheName = 'arah-v8';
const shell = ['./', './index.html', './style.css?v=8', './app.mjs?v=8', './puzzle.mjs', './quiz.mjs', './leaderboard.mjs',
  './benar.mp3', './salah.mp3', './melesat.mp3', './mentok.mp3', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('arah-') && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (new URL(request.url).pathname.endsWith('/api/leaderboard')) return;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(serve(request));
});

async function serve(request) {
  const cache = await caches.open(cacheName);
  if (request.mode === 'navigate') {
    return fetch(request).catch(() => cache.match('./index.html'));
  }
  const response = await cache.match(request);
  if (!response) return fetch(request);
  if (!request.headers.has('range') || !new URL(request.url).pathname.endsWith('.mp3')) return response;
  return audioRange(request.headers.get('range'), response);
}

async function audioRange(header, response) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  const data = await response.arrayBuffer();
  const size = data.byteLength;
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!match || start >= size || end < start) {
    return new Response(null, {status:416, headers:{'Content-Range':'bytes */' + size}});
  }
  return new Response(data.slice(start, end + 1), {
    status:206,
    headers:{
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1)
    }
  });
}
