# ADRs (Architecture Decision Records)

Un ADR registra **una decisión** que condiciona el proyecto: qué se decidió, por qué y qué
alternativas se descartaron. Sirven para no volver a debatir lo ya decidido y para que cualquier
persona o agente entienda el porqué del código.

## Cuándo escribir uno

- Elegir o cambiar una tecnología, librería o servicio.
- Cambiar el modelo de datos de forma estructural o una convención transversal.
- Aceptar un compromiso (*trade-off*) que alguien podría querer "arreglar" sin conocer el contexto.

No hace falta para detalles locales y reversibles. Si es una trampa técnica y no una decisión,
va en [gotchas](../gotchas/README.md).

## Cómo

1. Copia [`_plantilla.md`](_plantilla.md) a `NNNN-titulo-en-kebab-case.md` con el siguiente número libre.
2. Rellena `Área` con una o varias entidades de la tabla de abajo.
3. Añádelo al índice de su área en este fichero.
4. Los ADRs no se reescriben: si una decisión cambia, se crea uno nuevo con `Reemplaza a ADR-NNNN`
   y el antiguo pasa a `Reemplazado por ADR-MMMM`.

Estados: `Propuesto` · `Aceptado` · `Reemplazado por ADR-NNNN` · `Descartado`.

## Áreas (entidades)

| Área | Ámbito |
|---|---|
| `core` | `packages/core`: API de dominio, stores, validación |
| `db` | `supabase/`: esquema, RLS, migraciones, Realtime |
| `mcp` | `packages/mcp`: servidor MCP |
| `ui` | `packages/ui`: tokens de diseño, tema de Tailwind, iconos, apariencia |
| `web` | `apps/web`: PWA y frontend compartido |
| `desktop` | `apps/desktop`: Tauri |
| `ci` | GitHub Actions, ramas, releases |
| `tooling` | Monorepo, TypeScript, lint, build |
| `docs` | Documentación del proyecto y de usuario |

## Índice por área

### core
- [ADR-0002](0002-api-de-dominio-unica.md) — API de dominio única (`createMuninn`)
- [ADR-0003](0003-stores-intercambiables-supabase.md) — Stores intercambiables, con Supabase como backend inicial
- [ADR-0005](0005-columnas-con-kind-semantico.md) — Columnas personalizables con `kind` semántico
- [ADR-0006](0006-orden-con-fractional-indexing.md) — Orden con fractional indexing
- [ADR-0007](0007-registro-de-actividad.md) — Registro de actividad inmutable con actor
- [ADR-0018](0018-dinero-en-centimos.md) — El dinero se maneja en céntimos enteros
- [ADR-0022](0022-auth-y-sesion.md) — Auth y gestión de sesión: código por correo y GitHub con Supabase Auth *(GitHub en escritorio: ADR-0059)*
- [ADR-0025](0025-escrituras-optimistas-y-deshacer.md) — Escrituras optimistas, serializadas por proyecto y con «Deshacer»
- [ADR-0026](0026-markdown-marked-a-react-y-textarea.md) — Markdown con marked a elementos de React y un editor sobre `textarea`
- [ADR-0031](0031-sync-github-issues-tareas.md) — Sync GitHub: issues ↔ tareas con webhook y reconciliación en una Edge Function
- [ADR-0032](0032-columna-para-el-agente.md) — Columna «Para el agente»: etiqueta en la issue, Claude Code GitHub Action y PR que mueve la tarea
- [ADR-0035](0035-repos-de-github-desde-la-funcion.md) — El selector de repos pide la lista a la Edge Function `github`, con la sesión del dueño
- [ADR-0037](0037-modelo-de-datos-de-finanzas.md) — Finanzas: cuentas, categorías y movimientos, con el saldo derivado
- [ADR-0038](0038-suscripciones-avisan-y-se-confirman.md) — Las suscripciones avisan antes del cobro y el movimiento lo confirma el usuario
- [ADR-0039](0039-panel-mensual-y-tasa-de-ahorro.md) — Panel mensual calculado en el core, con la tasa de ahorro como lo que no gastas
- [ADR-0041](0041-asistente-local-con-catalogo-unico.md) — Asistente con modelo local (Ollama) en la app, con un catálogo único de herramientas compartido con el MCP
- [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md) — Noticias: fuentes RSS por usuario, descarga en una Edge Function con cron y resumen diario en local
- [ADR-0043](0043-informe-de-la-manana-en-local.md) — Informe de la mañana generado en el ordenador y guardado como nota fijada
- [ADR-0051](0051-imagenes-en-el-asistente.md) — Imágenes en el asistente: reducidas en el navegador, solo con modelos con visión y una sola vez
- [ADR-0054](0054-shell-responsive-en-tres-tamanos.md) — Shell en tres tamaños: barra de pestañas en el teléfono, raíl en tablet y barra lateral en el ordenador
- [ADR-0055](0055-imagen-de-proyecto-en-storage.md) — Imagen de proyecto en Supabase Storage, reducida en el navegador y sin borrar la anterior *(reemplazado en parte por ADR-0056)*
- [ADR-0056](0056-logo-y-portada-de-proyecto-con-color-del-logo.md) — Logo y portada de proyecto por separado, con el color del logo como color del proyecto
- [ADR-0061](0061-seguridad-de-la-cuenta.md) — Seguridad de la cuenta (sesiones, segundo factor y permisos OAuth) en Ajustes › Cuenta, a través del core
- [ADR-0062](0062-aal2-para-integraciones-sensibles.md) — El servidor exige el segundo factor (AAL2) para los datos y para conectar integraciones sensibles

### db
- [ADR-0003](0003-stores-intercambiables-supabase.md) — Stores intercambiables, con Supabase como backend inicial
- [ADR-0004](0004-multiusuario-con-rls.md) — Multiusuario con `owner_id` y RLS desde el día uno
- [ADR-0005](0005-columnas-con-kind-semantico.md) — Columnas personalizables con `kind` semántico
- [ADR-0006](0006-orden-con-fractional-indexing.md) — Orden con fractional indexing
- [ADR-0007](0007-registro-de-actividad.md) — Registro de actividad inmutable con actor
- [ADR-0018](0018-dinero-en-centimos.md) — El dinero se maneja en céntimos enteros
- [ADR-0022](0022-auth-y-sesion.md) — Auth y gestión de sesión: código por correo y GitHub con Supabase Auth *(GitHub en escritorio: ADR-0059)*
- [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md) — Tiempo real por invalidación de caché y caché de solo lectura sin conexión
- [ADR-0031](0031-sync-github-issues-tareas.md) — Sync GitHub: issues ↔ tareas con webhook y reconciliación en una Edge Function
- [ADR-0032](0032-columna-para-el-agente.md) — Columna «Para el agente»: etiqueta en la issue, Claude Code GitHub Action y PR que mueve la tarea
- [ADR-0037](0037-modelo-de-datos-de-finanzas.md) — Finanzas: cuentas, categorías y movimientos, con el saldo derivado
- [ADR-0038](0038-suscripciones-avisan-y-se-confirman.md) — Las suscripciones avisan antes del cobro y el movimiento lo confirma el usuario
- [ADR-0040](0040-pwa-instalable-y-web-push.md) — PWA publicada en Vercel y avisos Web Push desde una Edge Function con cron *(hosting aceptado; Web Push, propuesto)*
- [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md) — Noticias: fuentes RSS por usuario, descarga en una Edge Function con cron y resumen diario en local
- [ADR-0055](0055-imagen-de-proyecto-en-storage.md) — Imagen de proyecto en Supabase Storage, reducida en el navegador y sin borrar la anterior *(reemplazado en parte por ADR-0056)*
- [ADR-0056](0056-logo-y-portada-de-proyecto-con-color-del-logo.md) — Logo y portada de proyecto por separado, con el color del logo como color del proyecto
- [ADR-0061](0061-seguridad-de-la-cuenta.md) — Seguridad de la cuenta (sesiones, segundo factor y permisos OAuth) en Ajustes › Cuenta, a través del core
- [ADR-0062](0062-aal2-para-integraciones-sensibles.md) — El servidor exige el segundo factor (AAL2) para los datos y para conectar integraciones sensibles

### mcp
- [ADR-0009](0009-mcp-stdio-sin-borrados.md) — MCP por stdio, sin borrados definitivos y con resolución por nombre
- [ADR-0012](0012-paquetes-internos-como-fuente.md) — Paquetes internos como TS fuente; el MCP se empaqueta
- [ADR-0033](0033-mcp-remoto-http.md) — MCP remoto por Streamable HTTP, sin estado, con el token de Supabase del usuario y alojado en una Edge Function
- [ADR-0036](0036-pantalla-de-autorizacion-oauth.md) — La autorización OAuth del MCP remoto la aprueba una pantalla propia de la web, `/oauth/consent`
- [ADR-0041](0041-asistente-local-con-catalogo-unico.md) — Asistente con modelo local (Ollama) en la app, con un catálogo único de herramientas compartido con el MCP
- [ADR-0062](0062-aal2-para-integraciones-sensibles.md) — El servidor exige el segundo factor (AAL2) para los datos y para conectar integraciones sensibles

### ui
- [ADR-0014](0014-tokens-y-tailwind-v4.md) — Tokens en TypeScript → variables CSS, con Tailwind v4 como capa de utilidades
- [ADR-0015](0015-modo-cristal.md) — Modo cristal (blur) global, activable
- [ADR-0016](0016-iconos-phosphor-y-geist.md) — Iconos Phosphor y fuente Geist autoalojada
- [ADR-0017](0017-componentes-radix-cva.md) — Componentes base sobre Radix, con variantes cva y `cn()`
- [ADR-0018](0018-dinero-en-centimos.md) — El dinero se maneja en céntimos enteros
- [ADR-0019](0019-feedback-con-notificaciones.md) — Toda acción da feedback: notificaciones en píldora con «Deshacer»
- [ADR-0021](0021-shell-de-la-app.md) — Shell de la app: barra lateral en escritorio, dock con menisco en móvil y ⌘K *(reemplazado en parte por ADR-0054)*
- [ADR-0039](0039-panel-mensual-y-tasa-de-ahorro.md) — Panel mensual calculado en el core, con la tasa de ahorro como lo que no gastas
- [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md) — Las pantallas ocupan todo el ancho y, en escritorio, todo el alto
- [ADR-0058](0058-iconos-generados-con-los-grosores-que-se-usan.md) — Iconos de Phosphor generados con solo los grosores que se usan
- [ADR-0049](0049-calendario-propio-con-raton-nativo-en-tactil.md) — Fechas con un calendario propio con ratón y el selector nativo en táctil
- [ADR-0050](0050-scroll-dentro-de-la-pantalla-en-escritorio.md) — En escritorio la pantalla cabe en la ventana y el scroll va dentro de las listas
- [ADR-0053](0053-ajustes-por-grupos-buscador-y-restablecer.md) — Ajustes por grupos, con buscador, marca de «cambiado» y «Restablecer» con Deshacer
- [ADR-0054](0054-shell-responsive-en-tres-tamanos.md) — Shell en tres tamaños: barra de pestañas en el teléfono, raíl en tablet y barra lateral en el ordenador

### web
- [ADR-0008](0008-tauri-escritorio-pwa-movil.md) — Tauri 2 para escritorio y PWA para móvil
- [ADR-0014](0014-tokens-y-tailwind-v4.md) — Tokens en TypeScript → variables CSS, con Tailwind v4 como capa de utilidades
- [ADR-0020](0020-tanstack-router-carga-diferida.md) — TanStack Router con rutas en código y una pantalla por chunk
- [ADR-0021](0021-shell-de-la-app.md) — Shell de la app: barra lateral en escritorio, dock con menisco en móvil y ⌘K *(reemplazado en parte por ADR-0054)*
- [ADR-0022](0022-auth-y-sesion.md) — Auth y gestión de sesión: código por correo y GitHub con Supabase Auth *(GitHub en escritorio: ADR-0059)*
- [ADR-0023](0023-drag-and-drop-con-dnd-kit.md) — Drag & drop del tablero con dnd-kit
- [ADR-0024](0024-detalle-de-tarea-como-ruta.md) — Detalle de tarea como ruta, con panel en escritorio y pantalla en móvil
- [ADR-0025](0025-escrituras-optimistas-y-deshacer.md) — Escrituras optimistas, serializadas por proyecto y con «Deshacer»
- [ADR-0026](0026-markdown-marked-a-react-y-textarea.md) — Markdown con marked a elementos de React y un editor sobre `textarea`
- [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) — La sección Documentación se genera con `docs/user/*.md` importados al compilar
- [ADR-0028](0028-modulos-activables-solo-en-la-interfaz.md) — Los módulos activables ocultan la interfaz; los datos y el MCP no cambian
- [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md) — Tiempo real por invalidación de caché y caché de solo lectura sin conexión
- [ADR-0030](0030-vista-lista-del-tablero.md) — Vista Lista del tablero: la misma consulta, sin arrastre, recordada por dispositivo
- [ADR-0034](0034-escribir-sin-conexion.md) — Escribir sin conexión con una cola de intenciones persistente e ids generados en el cliente *(propuesto)*
- [ADR-0035](0035-repos-de-github-desde-la-funcion.md) — El selector de repos pide la lista a la Edge Function `github`, con la sesión del dueño
- [ADR-0036](0036-pantalla-de-autorizacion-oauth.md) — La autorización OAuth del MCP remoto la aprueba una pantalla propia de la web, `/oauth/consent`
- [ADR-0038](0038-suscripciones-avisan-y-se-confirman.md) — Las suscripciones avisan antes del cobro y el movimiento lo confirma el usuario
- [ADR-0040](0040-pwa-instalable-y-web-push.md) — PWA publicada en Vercel y avisos Web Push desde una Edge Function con cron *(hosting aceptado; Web Push, propuesto)*
- [ADR-0041](0041-asistente-local-con-catalogo-unico.md) — Asistente con modelo local (Ollama) en la app, con un catálogo único de herramientas compartido con el MCP
- [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md) — Noticias: fuentes RSS por usuario, descarga en una Edge Function con cron y resumen diario en local
- [ADR-0043](0043-informe-de-la-manana-en-local.md) — Informe de la mañana generado en el ordenador y guardado como nota fijada
- [ADR-0044](0044-voz-local-whisper-y-piper.md) — Voz en local: whisper.cpp para dictar y Piper para hablar, como procesos aparte en el escritorio *(propuesto)*
- [ADR-0045](0045-seo-de-la-web-sin-ssr.md) — SEO sin SSR: metas en `index.html` y por página, iconos desde el logo *(guías públicas y prerenderizadas, propuesto)*
- [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md) — Las pantallas ocupan todo el ancho y, en escritorio, todo el alto
- [ADR-0049](0049-calendario-propio-con-raton-nativo-en-tactil.md) — Fechas con un calendario propio con ratón y el selector nativo en táctil
- [ADR-0050](0050-scroll-dentro-de-la-pantalla-en-escritorio.md) — En escritorio la pantalla cabe en la ventana y el scroll va dentro de las listas
- [ADR-0051](0051-imagenes-en-el-asistente.md) — Imágenes en el asistente: reducidas en el navegador, solo con modelos con visión y una sola vez
- [ADR-0052](0052-documentacion-con-grupos-iconos-y-portada.md) — Documentación con grupos e iconos en el front matter, portada y búsqueda por apartado
- [ADR-0053](0053-ajustes-por-grupos-buscador-y-restablecer.md) — Ajustes por grupos, con buscador, marca de «cambiado» y «Restablecer» con Deshacer
- [ADR-0054](0054-shell-responsive-en-tres-tamanos.md) — Shell en tres tamaños: barra de pestañas en el teléfono, raíl en tablet y barra lateral en el ordenador
- [ADR-0055](0055-imagen-de-proyecto-en-storage.md) — Imagen de proyecto en Supabase Storage, reducida en el navegador y sin borrar la anterior *(reemplazado en parte por ADR-0056)*
- [ADR-0056](0056-logo-y-portada-de-proyecto-con-color-del-logo.md) — Logo y portada de proyecto por separado, con el color del logo como color del proyecto
- [ADR-0061](0061-seguridad-de-la-cuenta.md) — Seguridad de la cuenta (sesiones, segundo factor y permisos OAuth) en Ajustes › Cuenta, a través del core
- [ADR-0062](0062-aal2-para-integraciones-sensibles.md) — El servidor exige el segundo factor (AAL2) para los datos y para conectar integraciones sensibles
- [ADR-0057](0057-lector-de-noticias-integrado.md) — Lector de noticias integrado: modo lectura con el contenido del feed, sin iframe *(propuesto)*
- [ADR-0059](0059-deep-links-para-oauth-en-escritorio.md) — GitHub OAuth en escritorio con el deep link `muninn://auth/callback`
- [ADR-0060](0060-captcha-con-turnstile-en-la-entrada.md) — CAPTCHA de la entrada con Cloudflare Turnstile, invisible y opcional por variable

### desktop
- [ADR-0008](0008-tauri-escritorio-pwa-movil.md) — Tauri 2 para escritorio y PWA para móvil
- [ADR-0041](0041-asistente-local-con-catalogo-unico.md) — Asistente con modelo local (Ollama) en la app, con un catálogo único de herramientas compartido con el MCP
- [ADR-0044](0044-voz-local-whisper-y-piper.md) — Voz en local: whisper.cpp para dictar y Piper para hablar, como procesos aparte en el escritorio *(propuesto)*
- [ADR-0047](0047-actualizaciones-de-escritorio-firmadas.md) — Actualizaciones de escritorio firmadas, publicadas en la GitHub Release y aplicadas con «Reiniciar»
- [ADR-0057](0057-lector-de-noticias-integrado.md) — Lector de noticias integrado: modo lectura con el contenido del feed, sin iframe *(propuesto)*
- [ADR-0059](0059-deep-links-para-oauth-en-escritorio.md) — GitHub OAuth en escritorio con el deep link `muninn://auth/callback`
- [ADR-0060](0060-captcha-con-turnstile-en-la-entrada.md) — CAPTCHA de la entrada con Cloudflare Turnstile, invisible y opcional por variable

### ci
- [ADR-0010](0010-ramas-y-releases.md) — Ramas `main`/`develop`, Conventional Commits y release-please *(el repo privado y el updater pendiente, reemplazados por ADR-0046 y ADR-0047)*
- [ADR-0040](0040-pwa-instalable-y-web-push.md) — PWA publicada en Vercel y avisos Web Push desde una Edge Function con cron *(hosting aceptado; Web Push, propuesto)*
- [ADR-0032](0032-columna-para-el-agente.md) — Columna «Para el agente»: etiqueta en la issue, Claude Code GitHub Action y PR que mueve la tarea
- [ADR-0046](0046-repo-publico-con-licencia-mit.md) — El repositorio es público, con licencia MIT y política de seguridad
- [ADR-0047](0047-actualizaciones-de-escritorio-firmadas.md) — Actualizaciones de escritorio firmadas, publicadas en la GitHub Release y aplicadas con «Reiniciar»

### tooling
- [ADR-0001](0001-monorepo-pnpm-turborepo.md) — Monorepo con pnpm y Turborepo
- [ADR-0011](0011-biome.md) — Biome como linter y formateador
- [ADR-0012](0012-paquetes-internos-como-fuente.md) — Paquetes internos como TS fuente; el MCP se empaqueta

### docs
- [ADR-0013](0013-sistema-de-documentacion.md) — Sistema de documentación: ADRs, gotchas y docs de usuario
- [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) — La sección Documentación se genera con `docs/user/*.md` importados al compilar
- [ADR-0046](0046-repo-publico-con-licencia-mit.md) — El repositorio es público, con licencia MIT y política de seguridad
- [ADR-0052](0052-documentacion-con-grupos-iconos-y-portada.md) — Documentación con grupos e iconos en el front matter, portada y búsqueda por apartado
