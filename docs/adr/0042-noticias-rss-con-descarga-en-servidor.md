# ADR-0042: Noticias: fuentes RSS por usuario, descarga en una Edge Function con cron y resumen diario en local

- **Estado:** Aceptado
- **Fecha:** 2026-10-22
- **Área:** core, db, web
- **Relacionado:** [ADR-0041](0041-asistente-local-con-catalogo-unico.md), [ADR-0031](0031-sync-github-issues-tareas.md), [ADR-0028](0028-modulos-activables-solo-en-la-interfaz.md)

## Contexto

La F4 pide Noticias: fuentes RSS que elige el usuario, los artículos y un resumen diario. Restricciones: la descarga tiene que
funcionar **con el ordenador apagado**; el resumen se hace **en local** con el modelo (ADR-0041), así que solo cuando el ordenador
está encendido; todo con `owner_id` + RLS; desde el navegador casi ningún feed se deja leer (no mandan cabeceras CORS); y nada se
despliega en esta fase.

## Decisión

**Modelo de datos** (migración aditiva `20261022140000_news`, con RLS por dueño y en Realtime):
- `news_sources`: URL (única por dueño), título (el dominio al añadirla; el del feed en la primera descarga, salvo que lo cambie el
  usuario), tema opcional, `enabled`, y estado de la descarga (`etag`, `last_modified`, `last_fetched_at`, `last_error`). Quitar una
  fuente la **archiva**; volver a añadir la misma URL la recupera.
- `news_items`: título, enlace, resumen en **texto plano** recortado (600 caracteres), autor, fecha, `read_at` y `saved_at`.
  **Sin duplicados** por `(source_id, guid)`, donde `guid` es el `guid` de RSS, el `id` de Atom o, si no hay, el enlace. La inserción
  es «solo los nuevos» (`upsert … ignoreDuplicates`). Un trigger comprueba que el artículo es del dueño de su fuente.
- `news_digests`: uno por **día** (fecha local) y dueño: Markdown corto, modelo usado e ids de los artículos.

**Quién descarga: la Edge Function `news`** (`supabase/functions/news`, preparada y **sin desplegar**), como la de GitHub (ADR-0031):
- `POST /news/fetch` con el secreto del cron (`x-muninn-sync-secret`): `pg_cron` **cada hora**; recorre los dueños con fuentes activas
  (service role con `owner_id` explícito) y, al final, limpia lo antiguo.
- `POST /news/fetch` con la sesión del usuario: el botón «Actualizar» de la app; solo sus fuentes, con RLS.
- **Solo direcciones públicas (SSRF):** la función descarga URLs que escribe el usuario desde la red de Supabase. Se rechazan `localhost`,
  IPs privadas o reservadas (también IPv6 y mapeadas), nombres sin punto o internos (`.local`, `.internal`…), credenciales en la URL y
  puertos que no sean 80/443; con `Deno.resolveDns`, también los nombres que apuntan dentro. Las redirecciones se siguen a mano (3 como
  mucho) comprobando cada destino, y el cuerpo se corta a 3 MB mientras se lee. Al añadir la fuente ya se avisa.
- Descarga **condicional** (`If-None-Match`/`If-Modified-Since`: un 304 no procesa nada), 10 s por fuente, 3 MB y 50 artículos como
  mucho. El lector de feeds (`@muninn/core/news`, `news-feed.ts`) entiende RSS 2.0, RSS 1.0 y Atom sin DOM ni dependencias (corre en Deno).
- **Mientras no esté desplegada**, la app guarda las fuentes y dice la verdad: «Actualizar» avisa de que la descarga aún no está en marcha.
  No se intenta descargar desde el navegador (CORS) ni desde Tauri (otro camino que mantener para lo mismo).

**Dónde se genera el resumen: en el ordenador, con el modelo local.** La app (escritorio o navegador del mismo equipo) lo genera
la primera vez que se abre Noticias en el día si hay artículos de las últimas 30 h y Ollama está listo, o con «Resumir»/«Rehacer»
(`generateDigest` de `@muninn/assistant`: sin herramientas, 25 artículos como mucho, con su fuente y los proyectos relacionados). Se
guarda en `news_digests`, así se lee también en el iPhone. El informe de la mañana (ADR-0043) también lo pide.

**Relacionadas con un proyecto:** sin modelo, por coincidencia del nombre del proyecto como palabra en el título o el resumen
(`relatedProjects`). Barato, predecible y comprobable.

**Qué se guarda y cuánto:** los artículos **no guardados** se borran a los **30 días** y los resúmenes a los **120** (lo hace el cron con
la service role, `pruneNews`). Es caché de lo que publican otros: lo **guardado** («Leer luego») no caduca nunca. No hay borrados desde la
app, el asistente ni el MCP (ADR-0009): las fuentes se archivan.

**Asistente y MCP:** dos herramientas de solo lectura del catálogo, `list_news` (con fuente y proyectos relacionados) y `news_digest`.

**Módulo:** con `news` desactivado la pantalla no aparece (ADR-0028), el asistente no ofrece sus herramientas y el buscador ⌘K no ofrece
«Buscar en Noticias».

## Alternativas consideradas

- **Descargar desde la app:** sin el ordenador encendido no hay noticias, y en el navegador el CORS lo impide para casi todas las fuentes.
- **Un servicio de terceros (Feedly, Inoreader…) o un proxy público:** tus intereses fuera de casa y otra cuenta; RSS es sencillo.
- **Resumen en el servidor con un modelo en la nube:** contradice «todo local»; se podría ofrecer como opción con otro ADR.
- **Guardar el HTML entero del artículo:** más datos, riesgo de inyección y derechos de autor; basta con el enlace y un extracto.
- **Deduplicar por URL normalizada:** las URLs cambian (parámetros de seguimiento); el `guid` es lo que la fuente garantiza estable.
- **Resumen por fuente o por tema:** más llamadas al modelo; uno por día, agrupando lo parecido, es lo que pide el diseño.

## Consecuencias

- Las noticias llegan con el ordenador apagado **solo cuando la función y su cron estén desplegados** (fase final; pasos en
  [gotchas/db](../gotchas/db.md#noticias-descarga-con-la-edge-function-pasos-manuales)).
- El resumen del día depende de que el ordenador con Ollama se abra ese día; si no, en el iPhone se ve el último que haya.
- Un feed raro puede no leerse bien: queda en `last_error` de la fuente (se ve en la pantalla) y no afecta a las demás.
- Relacionado: `packages/core/src/news.ts`, `news-feed.ts`, `supabase/functions/news/index.ts`, `apps/web/src/screens/Noticias.tsx`.
