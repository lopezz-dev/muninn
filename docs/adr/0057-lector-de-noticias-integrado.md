# ADR-0057: Lector de noticias integrado: modo lectura con el contenido del feed, sin iframe

- **Estado:** Propuesto
- **Fecha:** 2026-10-28
- **Área:** web, desktop
- **Relacionado:** [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md), [ADR-0008](0008-tauri-escritorio-pwa-movil.md), [ADR-0026](0026-markdown-marked-a-react-y-textarea.md)

## Contexto

En Noticias, el título y «Abrir» llevan el artículo al navegador del sistema (`openExternal`, con `tauri-plugin-opener` en escritorio;
ver [gotchas/desktop](../gotchas/desktop.md#los-enlaces-externos-no-abren-nada-en-escritorio)). Funciona, pero saca al usuario de Muninn.
La tarea pedía valorar un lector dentro de la app. Restricciones: la misma web corre en Tauri (WebView2/WKWebView), en el navegador y en la
PWA del iPhone; el Markdown y el HTML ajeno no se pintan como HTML (ADR-0026); y hoy `news_items.summary` guarda el resumen en **texto plano
recortado a 600 caracteres** (ADR-0042), aunque el parser ya lee `content:encoded`.

## Decisión (propuesta, sin implementar)

Si se hace, el lector es un **modo lectura** con el contenido que trae el propio feed:
- La función `news` guarda `content:encoded` / `content` de Atom **saneado en el servidor** a un subconjunto pequeño (párrafos, títulos,
  listas, enlaces, imágenes `https`), en una columna nueva con su migración, con un tope de tamaño.
- La web lo pinta con un renderizador propio, como el Markdown (nada de `dangerouslySetInnerHTML`). Las imágenes cargan desde su servidor
  (ya lo permite `img-src https:` de la CSP de escritorio) y los enlaces pasan por `openExternal`.
- «Abrir en el navegador» sigue a mano en el lector. Si el feed solo trae un extracto, el lector lo dice y ofrece abrir el original.

## Alternativas consideradas

- **`<iframe src={item.url}>`:** no sirve. Casi todos los periódicos mandan `X-Frame-Options: DENY/SAMEORIGIN` o CSP `frame-ancestors`
  y el iframe sale en blanco; los que se dejan cargan sus cookies y anuncios de terceros, que Safari y WebView2 bloquean a medias; la CSP de
  escritorio no tiene `frame-src` (habría que abrirla a cualquier origen); y el `markRead` no sabría si se ha leído. Sin control y sin
  forma de detectar el fallo de forma fiable.
- **`WebviewWindow` aparte en Tauri:** una ventana nativa con la URL del artículo, que sí carga cualquier web (no es un iframe). Contras:
  solo existe en escritorio (en la web y la PWA seguiría siendo el navegador), es un navegador sin barra de dirección ni bloqueador de
  anuncios, necesita permisos de ventanas en capabilities y cuidar que esa ventana no herede los permisos de la principal (`windows: ["main"]`
  ya lo limita). Aporta poco frente a abrir el navegador del sistema, que tiene las sesiones y las extensiones del usuario.
- **Descargar y extraer el artículo (tipo Readability) en el servidor:** daría el texto completo aunque el feed solo traiga un extracto, pero
  es *scraping* de sitios ajenos desde nuestra función (rendimiento, términos de uso, muros de pago). Descartado por ahora.

## Consecuencias

- Positivas: leer sin salir de Muninn en los tres sitios por igual; sin red de terceros salvo las imágenes; el «leído» se marca al abrir.
- Negativas / costes: una migración y más bytes por artículo en `news_items`; un saneador más que mantener en el servidor; muchos feeds solo
  traen un extracto, y ahí el lector se queda corto.
- Relacionado: `packages/core/src/news-feed.ts` (ya lee `encoded`), `supabase/functions/news`, `apps/web/src/screens/Noticias.tsx`,
  `apps/web/src/lib/external-link.ts`.
