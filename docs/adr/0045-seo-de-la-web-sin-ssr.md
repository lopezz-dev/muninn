# ADR-0045: SEO de la web sin SSR: metas en `index.html` y por página; guías públicas y prerenderizadas, como propuesta

- **Estado:** Aceptado (metas, iconos, `robots.txt` y `sitemap.xml`) · Propuesto (guías públicas y prerenderizadas)
- **Fecha:** 2026-10-26
- **Área:** web

## Contexto

La web es una SPA (Vite, TanStack Router) publicada en Vercel con un solo `index.html` para todas las rutas
([ADR-0040](0040-pwa-instalable-y-web-push.md)). Hasta ahora no declaraba favicon ni descripción, y sus iconos eran provisionales.
Casi todo pide sesión. Hoy, alguien sin sesión ni modo demo, como un buscador, solo ve `/login`: el resto redirige allí.
Eso incluye la documentación (`/documentacion/$pagina`, [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md)), porque cuelga de `_app`.

Quien lee la tarjeta de un enlace compartido (WhatsApp, Slack, X…) no ejecuta JavaScript. Google sí, pero tarde y no siempre.

## Decisión

1. **`index.html` lleva las metas de toda la app:**
   - `lang="es"`, descripción, `theme-color` y `color-scheme`;
   - favicon SVG con respaldo ICO, `apple-touch-icon`, Open Graph y tarjeta de X con `og-image.jpg` (1200×630).
   - Las URLs de la tarjeta son absolutas y del dominio de producción.
2. **Cada página pública ajusta sus metas en el cliente** con `usePageMeta` (`src/lib/seo.ts`):
   - el título, la descripción, `og:*`, `twitter:*` y `<link rel="canonical">`;
   - al salir de la página los devuelve a como estaban;
   - hoy la usan el login y las guías, que toman título y descripción del front matter.
   - No hay `canonical` fijo en `index.html`: como es el mismo HTML en todas las rutas, diría que todas son la misma página.
3. **Iconos generados desde el logo** (`shell/Logo.tsx`) con `scripts/icons.mjs`. El script no usa dependencias: dibuja la geometría
   y escribe PNG e ICO con `zlib`. La imagen social lleva texto en Geist y se dibuja en el navegador (`scripts/og-image.html`).
4. **`robots.txt` bloquea las secciones privadas, y `sitemap.xml` solo lista lo que ve alguien sin sesión** (hoy, `/login`).
5. **Sin SSR ni prerender, de momento.**
6. **Propuesto (decide Alex):** hacer públicas las guías de `docs/user` y prerenderizarlas en el build:
   - **públicas:** una ruta fuera de `_app`, sin el core ni el shell completo, que se vea sin sesión;
   - **prerenderizadas:** un `dist/documentacion/<guía>/index.html` por guía, con su título, su descripción y el texto ya en el HTML,
     generado con `marked` (ya es dependencia) desde un plugin de Vite;
   - **en el sitemap:** se añaden entonces a `sitemap.xml`.
   - Así las guías indexan sin depender del JavaScript y sin meter un framework de SSR.

## Alternativas consideradas

- **SSR o un framework con prerender (TanStack Start, vite-plugin-ssr):** reescribe el arranque y el despliegue para dos o tres páginas
  públicas, y añade un servidor a lo que hoy es estático. Desproporcionado.
- **`canonical` fijo en `index.html`:** con un solo HTML, todas las rutas dirían que son la portada.
- **Iconos con `sharp` o `@vite-pwa/assets-generator`:** traen binarios nativos al repo para un logo de tres formas. El script propio
  se regenera en un segundo y sin instalar nada.
- **Listar ya las guías en el sitemap:** sin sesión redirigen a `/login`, así que Google las vería como duplicados del login.

## Consecuencias

- Positivas: favicon e iconos con el logo de la app (también los `maskable` y el de iOS). Los enlaces compartidos muestran una tarjeta
  con imagen. El login tiene título, descripción y canónica propios. No cambia el JS inicial: el chunk de entrada gana 31 bytes,
  que es el nombre de `seo-*.js` en su mapa de precarga.
- Negativas / costes:
  - El dominio de producción está escrito en tres sitios: `index.html`, `robots.txt` y `sitemap.xml`.
  - Si cambia el logo, hay que regenerar los iconos (y la imagen social, a mano).
  - Mientras la propuesta no se acepte, las guías no indexan.
- Relacionado: [gotchas/web](../gotchas/web.md) («Iconos y favicon salen del logo» y «Metas por página: `usePageMeta`, sin canónica fija»),
  [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) y [ADR-0040](0040-pwa-instalable-y-web-push.md).
