// Avisos Web Push (ADR-0040). El service worker de Workbox lo importa (`workbox.importScripts` en vite.config.ts):
// solo escucha `push` y `notificationclick`, sin tocar la caché. Hasta que haya suscripciones y una función que
// envíe avisos, no hace nada.
//
// Carga esperada (JSON): { "title": "…", "body": "…", "url": "/finanzas?vista=suscripciones", "tag": "…" }

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Muninn'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // El mismo `tag` sustituye al aviso anterior en lugar de apilarse.
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Si la app ya está abierta, se lleva allí; si no, se abre.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
