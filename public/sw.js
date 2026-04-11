const CACHE_NAME = 'repsheets-v2'

// Install: activate immediately
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Activate: clean old caches, take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache Google auth
  if (url.hostname === 'accounts.google.com') return

  // Network first for API calls
  if (url.hostname === 'sheets.googleapis.com' || url.hostname === 'www.googleapis.com') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  // Network first for navigation (HTML) and hashed assets (JS/CSS)
  // This ensures updates are picked up immediately
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => {
        // Offline fallback to cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline', { status: 503 })
        })
      })
    )
  }
})
