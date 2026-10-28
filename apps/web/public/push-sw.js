// Avisos Web Push (ADR-0040). El service worker de Workbox lo importa (`workbox.importScripts` en vite.config.ts):
// solo escucha `push` y `notificationclick`, sin tocar la caché. Los avisos los manda la Edge Function `push`
// (cobros de suscripciones, y el de prueba de Ajustes › Notificaciones); el texto lo arma el core (`push.ts`).
//
// Carga esperada (JSON): { "title": "…", "body": "…", "url": "/finanzas?vista=suscripciones", "tag": "…" }

/**
 * Solo enlaces dentro de Muninn. Un camino como `//otro.com` o `/\otro.com` empieza por «/» pero `new URL` lo
 * resuelve en otro dominio: se descarta, y tras resolverlo se vuelve a exigir el mismo origen.
 */
function sameOriginUrl(raw) {
  const path = typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : '/'
  try {
    const parsed = new URL(path, self.location.origin)
    return parsed.origin === self.location.origin ? parsed.href : `${self.location.origin}/`
  } catch {
    return `${self.location.origin}/`
  }
}

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
      data: { url: sameOriginUrl(data.url) },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Se valida otra vez al pulsar: `data` lo guarda el navegador y se lee tal cual.
  const url = sameOriginUrl(
    (() => {
      try {
        const u = new URL(event.notification.data?.url ?? '/', self.location.origin)
        return u.origin === self.location.origin ? u.pathname + u.search + u.hash : '/'
      } catch {
        return '/'
      }
    })(),
  )
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
