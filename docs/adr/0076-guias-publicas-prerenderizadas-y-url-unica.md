# ADR-0076: Guías públicas y prerenderizadas en el build, y la URL pública en un solo sitio

- **Estado:** Aceptado
- **Fecha:** 2026-11-03
- **Área:** web
- **Reemplaza a:** la parte *propuesta* de [ADR-0045](0045-seo-de-la-web-sin-ssr.md) (guías públicas y prerenderizadas); lo demás del 0045 sigue vigente

## Contexto

Con el ADR-0045, la web tiene metas, iconos, `robots.txt` y `sitemap.xml`, pero lo único que ve un buscador es `/login`: el resto,
también la documentación, redirige allí sin sesión. Las guías de `docs/user` son el contenido público con más texto que tenemos y
lo que antes se puede indexar de cara a publicar la app.

Además, el dominio de producción estaba escrito a mano en `index.html`, `robots.txt` y `sitemap.xml`, y va a cambiar al dominio propio.

## Decisión

1. **La documentación es pública.** `/documentacion` y `/documentacion/$pagina` siguen colgando de `_app`, pero sin sesión (o con el
   segundo factor pendiente) el `beforeLoad` de `_app` no redirige en esas rutas: devuelve `auth: null`, el loader no carga el core y
   `AppFrame` pinta `PublicShell` (cabecera con la marca y «Entrar», que vuelve a la misma guía) en lugar de `AppShell`. Con sesión o
   en demo, todo igual que antes. Las pantallas de la documentación no usan `useMuninn()`.
2. **Prerender en el build, sin SSR.** El plugin `vite/seo.ts`, al terminar el build, lee las guías con el mismo `buildDocs` que la
   pantalla y escribe `dist/documentacion/index.html` y `dist/documentacion/<guía>/index.html` a partir del `index.html` compilado:
   título, descripción, `og:*`, `twitter:*`, canónica, datos estructurados (`TechArticle` y `BreadcrumbList`) y el texto de la guía en
   HTML (con `marked`) dentro de `#root`. React lo sustituye al arrancar. Vercel sirve esos ficheros con *rewrites* propios.
3. **La URL pública sale de `SITE_URL`** (`vite/seo.ts`, sobrescribible con `MUNINN_SITE_URL`). El build la pone en `index.html`
   (`%SITE_URL%`) y genera con ella `robots.txt` y `sitemap.xml` (la entrada, la portada de la documentación y cada guía). Ya no hay
   ficheros de SEO escritos a mano en `public/`.
4. **Lo que no existe no se indexa:** `NotFound` y la guía inexistente ponen `<meta name="robots" content="noindex">` (`useNoIndex`), y
   el build escribe `404.html` (la app con `noindex`), que Vercel sirve con estado 404 a una guía que no existe.
5. **`index.html` lleva datos estructurados** de la app (`WebSite` y `SoftwareApplication`).
6. El *service worker* no precachea las páginas prerenderizadas ni `404.html`: dentro de la app, el router pinta lo mismo.

## Alternativas consideradas

- **Una ruta pública aparte (`/ayuda/…`):** dos URLs con el mismo texto (duplicados) y enlaces distintos según haya sesión.
- **SSR o un framework con prerender (TanStack Start, vite-plugin-ssr):** ya descartado en el ADR-0045, por las mismas razones.
- **Prerender con un navegador sin cabeza (Puppeteer):** fiel al 100 % con lo que pinta React, pero mete Chromium en el build de
  Vercel. El HTML de `marked` basta para buscadores y tarjetas.
- **Texto en `<noscript>` o escondido:** Google lo valora poco o lo trata como contenido oculto.
- **La URL en una variable `VITE_*`:** también funciona, pero no la necesita el código de la app, solo el build.

## Consecuencias

- Positivas:
  - Las guías se indexan y sus enlaces compartidos llevan título y descripción propios, sin ejecutar JavaScript.
  - Cambiar de dominio en el repo es cambiar una línea (o una variable en Vercel).
  - El JS inicial no cambia: el marco público es un componente pequeño del bundle del router.
- Negativas / costes:
  - Quien abre un enlace a una guía por primera vez ve un instante el texto prerenderizado, con estilo mínimo, antes de que pinte React.
  - El HTML prerenderizado no es idéntico al de la app (sin iconos, avisos ni índice lateral): es el mismo texto, no la misma maqueta.
  - Las *rewrites* de `vercel.json` y el `globIgnores` del PWA dependen de la ruta `/documentacion`: si cambia, hay que tocarlas.
- Relacionado: [gotchas/web](../gotchas/web.md) («Guías prerenderizadas: lo que hay que saber» y «Cambiar el dominio de la web»),
  [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md), [ADR-0052](0052-documentacion-con-grupos-iconos-y-portada.md).
