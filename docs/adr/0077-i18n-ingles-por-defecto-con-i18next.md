# ADR-0077: La app en varios idiomas con i18next: inglés por defecto, español con prefijo `/es` y rutas en inglés

- **Estado:** Aceptado (decidido por Alex el 2026-11-03; se implementa por fases)
- **Fecha:** 2026-11-03
- **Área:** web
- **Reemplaza a:** en parte, [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) (una guía por idioma) y
  [ADR-0076](0076-guias-publicas-prerenderizadas-y-url-unica.md) (la ruta `/documentacion` y el prerender de un solo idioma); y,
  solo para el aviso de idioma, la posición de [ADR-0019](0019-feedback-con-notificaciones.md)

## Contexto

Muninn está pensado para venderse y hoy solo habla español: todos los textos de la interfaz están escritos a mano en los componentes,
las rutas son españolas (`/proyectos`, `/documentacion`…) y las guías de `docs/user` solo existen en español. Para competir fuera
hace falta otro idioma, y el mercado grande es el inglés.

Para el SEO solo cuenta lo público (landing y guías): las rutas privadas piden sesión y `robots.txt` las bloquea. Aún no hay nada
indexado (el dominio propio y Search Console llegan en diciembre), así que cambiar las URLs públicas ahora no cuesta posiciones.

Google desaconseja redirigir a otro idioma solo por el idioma del navegador: el buscador rastrea casi siempre en inglés y no vería
la otra versión.

## Decisión

1. **Inglés por defecto, español como segundo idioma.**
   - URLs públicas con prefijo de ruta en el mismo dominio: el inglés sin prefijo (`/docs/notes`) y el español con `/es`
     (`/es/docs/notas`). Las URLs de las guías también se traducen.
   - Cada página pública declara sus versiones con `<link rel="alternate" hreflang="en|es|x-default">` (con `x-default` en
     inglés), también en `sitemap.xml`. `og:locale` y `og:locale:alternate`, y `inLanguage` del JSON-LD, según el idioma.
   - El prerender de `vite/seo.ts` genera cada página en los dos idiomas.
2. **Sin redirecciones por idioma: un aviso.**
   - Si el navegador está en español (`navigator.languages`) y la página está en inglés, sale un aviso: «Esta página también está
     en español», con «Cambiar» y «No, gracias». Al revés, lo mismo.
   - En el ordenador va abajo a la derecha; en el móvil, abajo, encima del dock. Es la única excepción a la posición de ADR-0019:
     no es un aviso de una acción del usuario sino una oferta que puede ignorar, y no debe tapar la cabecera de la página.
   - La respuesta se recuerda en el dispositivo (`localStorage`) y el aviso no vuelve a salir. «Cambiar» guarda el idioma como
     preferencia.
3. **i18next con `react-i18next`.**
   - Un namespace por pantalla (`board`, `notes`, `finance`…) y uno `common` para el shell. Los namespaces de pantalla se cargan
     en diferido con su chunk (`i18next-resources-to-backend` con `import()`), como las pantallas (ADR-0020).
   - Claves tipadas con `CustomTypeOptions` desde los diccionarios en inglés, que son la fuente: una clave que no existe no compila.
   - Plurales e interpolación de i18next. Fechas, números y moneda siempre con `Intl` y el idioma activo (el dinero sigue en
     céntimos, ADR-0018).
4. **Rutas privadas en inglés** (`/projects`, `/notes`, `/finance`, `/settings`, `/docs`…) **sin prefijo de idioma**: con sesión
   manda el idioma de la cuenta, no la URL. Las rutas antiguas en español redirigen a las nuevas (enlaces compartidos, PWA
   instaladas, deep links). `/oauth/consent` no cambia: lo usa Supabase.
5. **El idioma de la interfaz** se elige en Ajustes › Apariencia y se guarda en la cuenta (`preferences`). Sin elegirlo, el del
   navegador si es `es`, y si no, inglés. Sin sesión, el de la URL.
6. **Lo interno sigue en español:** comentarios, commits, ADRs, gotchas y `CLAUDE.md`. Los identificadores de código ya están en
   inglés. Las guías de usuario se escriben en los dos idiomas.

### Fases

1. Infraestructura (i18next, tipos, carga diferida, idioma de la cuenta) y el shell en los dos idiomas.
2. Extracción pantalla a pantalla, un PR por grupo de pantallas, con la pantalla en inglés y en español.
3. Rutas en inglés con las redirecciones de las antiguas.
4. Guías: `docs/user/en/` y `docs/user/es/`, prerender por idioma, `hreflang`, sitemap y el aviso de idioma.
5. Lo que sale del servidor: correos de Supabase, notificaciones push y lo que escribe el asistente o el MCP para el usuario.

## Alternativas consideradas

- **Español por defecto con `/en`:** cambia menos lo que hay, pero deja el mercado grande como secundario.
- **Subdominios (`es.dominio`):** más configuración por subdominio (Vercel, Supabase *Redirect URLs*, Turnstile, cookies) y la
  autoridad del dominio se reparte. Para empezar, el prefijo es lo que recomienda Google.
- **Redirigir por el idioma del navegador:** el rastreador de Google no vería la versión en español, y quien comparte un enlace en
  inglés con alguien de habla hispana no controla lo que este ve.
- **Una solución propia de diccionarios tipados:** más ligera (cientos de bytes frente a unos 16 kB comprimidos), pero sin las
  herramientas de traducción, extracción y plurales de i18next. Alex elige i18next.
- **Lingui:** muy ligero en ejecución, pero añade un macro y un paso de compilación de catálogos.
- **Todo lo interno en inglés:** mejor para colaboradores de fuera, pero reescribir 76 ADRs y los gotchas no aporta al producto.
  Se puede revisar si el repo se abre a más gente.

## Consecuencias

- Positivas:
  - Las páginas públicas compiten en inglés sin perder el español, y Google entiende qué versión enseñar a quién.
  - Las rutas y el código quedan en el mismo idioma.
- Negativas / costes:
  - i18next y `react-i18next` suman unos 16 kB comprimidos al arranque (los textos del shell se necesitan en el primer pintado).
    Medir con `pnpm --filter @muninn/web size` en la fase 1.
  - Todo texto nuevo de la interfaz se escribe dos veces (clave en inglés y traducción). Un texto suelto en un componente es un fallo.
  - Las guías se mantienen en los dos idiomas: una guía nueva o un cambio visible para el usuario actualiza ambas en el mismo PR.
  - Cambiar las rutas toca `robots` y el sitemap (`vite/seo.ts`), `vercel.json`, el `globIgnores` del PWA, `isPublicPath`, los
    enlaces de las guías, los deep links de escritorio y los atajos del buscador.
- **Medido en la fase 1:** el JS inicial pasa de 175,6 a 199,3 kB comprimidos (+23,7 kB: i18next 26, `react-i18next`, el backend
  diferido y los dos diccionarios de `common`), más que los ~16 kB estimados arriba.
- Al implementar la fase 1, actualizar `CLAUDE.md` (regla de textos con `t()`) y añadir los gotchas de i18n en `docs/gotchas/web.md`.
- Relacionado: [ADR-0019](0019-feedback-con-notificaciones.md), [ADR-0020](0020-tanstack-router-carga-diferida.md),
  [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md), [ADR-0045](0045-seo-de-la-web-sin-ssr.md),
  [ADR-0076](0076-guias-publicas-prerenderizadas-y-url-unica.md).
