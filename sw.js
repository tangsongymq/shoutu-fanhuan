// 离线缓存：页面联网时优先取最新版（3 秒没回应就先用缓存），图标等静态文件直接用缓存
const CACHE = 'shoutu-v1'
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function page(req) {
  const cache = await caches.open(CACHE)
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put('./index.html', res.clone())
    return res
  })
  network.catch(() => {})
  const slow = new Promise((r) => setTimeout(r, 3000)).then(() => cache.match('./index.html'))
  try {
    return (await Promise.race([network, slow])) || (await network)
  } catch {
    return (await cache.match('./index.html')) || Response.error()
  }
}

async function asset(req) {
  const hit = await caches.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(req.mode === 'navigate' ? page(req) : asset(req))
})
