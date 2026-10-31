# Roadmap

## F1 · Base + tareas y notas
> **Estado:** el código de la F1 está completo y GitHub OAuth ya está activo. Solo queda pasar la
> [lista de pruebas del iPhone](pruebas-iphone.md), que está en la pila de [Pruebas finales](#pruebas-finales).
- [x] Monorepo (pnpm + Turborepo), Biome, TypeScript estricto
- [x] Esquema Supabase con RLS y Realtime
- [x] `@muninn/core`: proyectos, columnas personalizables, tareas, checklist, notas, actividad, informes
- [x] Stores: Supabase, fichero local y memoria
- [x] CI (lint, typecheck, test, build) y releases (release-please + tauri-action: Win/Linux/macOS)
- [x] Esqueleto de Tauri 2 y de la PWA
- [x] Sistema de documentación: ADRs, gotchas por área y docs de usuario
- [x] Diseño de todas las pantallas (escritorio + móvil): [lienzo «Muninn — Pantallas»](https://claude.ai/artifact/BdNFHNmB8E3dxV2u7o27xB)
- [x] Rediseño del móvil: [lienzo «Muninn — Móvil 2.0»](https://claude.ai/artifact/2T6zpnVrJUfTU7xvBUi9zg) (esquinas con el radio
  del sistema y logo de Muninn en el botón del Asistente, como se acordó al revisarlo)
- [x] `@muninn/ui`: tokens → CSS vars, tema Tailwind v4, iconos Phosphor, Geist autoalojada, modo cristal y acento
- [x] Componentes base (`@muninn/ui`): Button, IconButton, Chip, ColorDot, Kbd, Avatar, ProgressBar, Separator, Card, TextField, TextArea, Switch, Checkbox, SegmentedControl, AmountField, Dialog, Sheet, Menu, Tooltip, notificaciones (`notify` + `Toaster`)
- [x] Shell de la app: router con una pantalla por chunk (TanStack Router), barra lateral (escritorio), dock
  con menisco (móvil, sustituido por la barra de pestañas del ADR-0054), buscador ⌘K, pantallas vacías de todas las secciones y Ajustes › Apariencia
- [x] Proyecto de Supabase (`muninn`, eu-west-3 París) con el esquema y los avisos del asesor resueltos
- [x] Login con Supabase Auth: código por correo y GitHub (solo web), sesión persistente, rutas protegidas,
  cerrar sesión y modo demo sin cuenta ([ADR-0022](adr/0022-auth-y-sesion.md))
- [x] Apariencia en `user_settings.preferences` (localStorage como caché del primer render)
- [x] Correos de acceso con SMTP propio (Resend) y plantillas con la marca de Muninn
  ([gotchas/db](gotchas/db.md))
- [x] Activar GitHub OAuth en el panel de Supabase (OAuth App de GitHub + Redirect URLs): pasos en
  [gotchas/db](gotchas/db.md#activar-github-oauth-paso-manual)
- [ ] Pasar la [lista de pruebas del iPhone](pruebas-iphone.md) y corregir lo que falle → en [Pruebas finales](#pruebas-finales)
- [x] Módulos en `user_settings.enabled_modules` (Ajustes › Módulos): el menú, las pestañas y el buscador solo enseñan lo activo
- [x] Ajustes rediseñados: menú por grupos con buscador, cabecera por sección, tarjetas con subtítulo, marca de «cambiado» y
  «Restablecer sección» con Deshacer ([ADR-0053](adr/0053-ajustes-por-grupos-buscador-y-restablecer.md))
  ([ADR-0028](adr/0028-modulos-activables-solo-en-la-interfaz.md))
- [x] Inicio (hoy, vencidas, en curso, próximos días, hechas hoy y gráfica de 7 días) con datos reales
- [x] Tablero Kanban con drag & drop (ratón, tacto y teclado; [ADR-0023](adr/0023-drag-and-drop-con-dnd-kit.md)), columnas
  personalizables, límite WIP, detalle de tarea como ruta ([ADR-0024](adr/0024-detalle-de-tarea-como-ruta.md)), subtareas
  y «Deshacer» en cada acción ([ADR-0025](adr/0025-escrituras-optimistas-y-deshacer.md))
- [x] Tareas archivadas (menú **⋯** del tablero): recuperarlas o eliminarlas para siempre, con «Deshacer» diferido como los
  proyectos archivados ([ADR-0067](adr/0067-eliminar-tareas-archivadas.md); sale del backlog)
- [x] Notas: editor Markdown con barra de formato y vista previa, autoguardado, lista con búsqueda, fijadas y filtro por
  proyecto, y notas vinculadas a proyecto o tarea ([ADR-0026](adr/0026-markdown-marked-a-react-y-textarea.md))
- [x] Sección **Documentación** en la app: renderiza `docs/user/*.md` (menú a partir del front matter, buscador, marca de
  estado, índice de la página; [ADR-0027](adr/0027-documentacion-en-la-app-desde-docs-user.md))
  - [x] Rediseño: portada con las guías por grupos e iconos, guía centrada en pantallas anchas, búsqueda que lleva al
    apartado y anterior/siguiente por grupo ([ADR-0052](adr/0052-documentacion-con-grupos-iconos-y-portada.md))
- [x] Sincronización en tiempo real entre dispositivos (Realtime por tabla, invalidando la caché) y caché de lectura sin conexión
  en IndexedDB ([ADR-0029](adr/0029-tiempo-real-y-cache-sin-conexion.md))

## F2 · Claude y GitHub
> **Estado:** en curso. La tanda del 19 de octubre ([#15](https://github.com/lopezz-dev/muninn/pull/15) a [#20](https://github.com/lopezz-dev/muninn/pull/20)) ya está en `develop`.
> La sincronización con GitHub está en marcha y **probada con issues reales** (20 de octubre, con `huginnDB`), y el agente también (21 de octubre: PR real fusionado, cancelación e issue imposible). El MCP remoto está **desplegado** (21 de octubre) y **conectado a claude.ai** por OAuth (28 de octubre). Lo pendiente, en [Pruebas finales](#pruebas-finales).
- [x] Servidor MCP (stdio) con herramientas de lectura y escritura
- [x] Tablero: vista **Lista** (selector Tablero · Lista recordado por proyecto y dispositivo, agrupada por columna, con los filtros y
  sin arrastre; ADR-0030, [#15](https://github.com/lopezz-dev/muninn/pull/15))
- [x] Tablero: vista **Calendario** (mes y semana, arrastrar cambia la fecha con «Deshacer», bandeja «Sin fecha», crear en un día;
  en el móvil, mes compacto y hoja «Cambiar fecha» sin arrastre; ADR-0068, diseño en el lienzo
  [«Muninn — Calendario»](https://claude.ai/artifact/5a4s3wiHqsZVG88jZKwAMB))
- [ ] Sync GitHub: issues → tareas, cerrar issue ↔ completar (ADR-0031, [#16](https://github.com/lopezz-dev/muninn/pull/16))
  - [x] Diseño, reglas en el core con tests, cola de salida, Edge Function `github` y migración preparadas
  - [x] Insignia «GitHub #n», enlace a la issue en el detalle y Ajustes › Integraciones (repo por proyecto)
  - [x] Selector de repos en Integraciones; los públicos se comprueban al elegirlos (ADR-0035)
  - [x] Puesta en marcha (migración, token, secretos, despliegue, webhook, cron) y prueba real (20 de octubre, [Pruebas finales](#pruebas-finales))
  - [x] Pantalla **GitHub** del diseño: repos vinculados y sin vincular (vincular, mover y soltar con «Deshacer»), «Sincronizar
    ahora», columna del agente por proyecto y «Ejecuciones recientes» sacadas de la actividad. Sin el interruptor de pausa por repo
    del diseño (no existe en el modelo de datos)
- [x] Columna «Para el agente»: etiqueta el issue → Claude Code GitHub Action → PR → la tarea se actualiza (ADR-0032, aceptado el
  20 de octubre con la revisión de [#17](https://github.com/lopezz-dev/muninn/pull/17)); probada de punta a punta el 21 de octubre
  - [x] Columna marcada por proyecto, etiqueta `muninn:agent` que sigue a la columna, PRs del agente que mueven la tarea, cola al
    momento tras mover (`/sync` con `scope`), migración, función desplegada y webhook suscrito a `pull_request`
  - [x] En `huginnDB`: GitHub App de Claude, secreto y workflow en `main`; primer PR real del agente el 21 de octubre
    (huginnDB [#260](https://github.com/lopezz-dev/huginnDB/pull/260)); pruebas en [Pruebas finales](#pruebas-finales)
- [ ] MCP remoto (HTTP) para usarlo desde el móvil o desde claude.ai (ADR-0033, [#18](https://github.com/lopezz-dev/muninn/pull/18))
  - [x] Transporte HTTP sin estado con el token de Supabase del usuario, detrás de `--http`, con tests; Edge Function `mcp` preparada
  - [x] Función `mcp` desplegada el 21 de octubre (CLI de Supabase) y comprobada con `curl`
  - [x] Pantalla de autorización `/oauth/consent` para el servidor OAuth de Supabase (ADR-0036): sin ella, OAuth no funciona
  - [x] Servidor OAuth activado en Supabase el 21 de octubre (*Authorization Path* `/oauth/consent`, registro dinámico, *Site URL*
    `localhost:5174`); el descubrimiento responde 200
  - [x] Conectar claude.ai: **funciona desde el 28 de octubre** (conector personalizado en la organización del trabajo, con registro dinámico;
    ve las 36 herramientas). Falta el iPhone → [Pruebas finales](#pruebas-finales)
- [ ] **Escribir sin conexión:** cola de intenciones persistente, UUID del cliente, orden por ancla, conflictos y «Deshacer» sobre lo
  pendiente. ADR-0034 **propuesto** ([#19](https://github.com/lopezz-dev/muninn/pull/19)), para revisarlo juntos antes de implementar; hoy sin red solo se puede leer
  ([ADR-0029](adr/0029-tiempo-real-y-cache-sin-conexion.md))

## Pruebas finales

Pila única de lo que hay que comprobar **a mano** (no se puede verificar desde el ordenador o necesita secretos y despliegues). Cada bloque
que se cierra añade aquí sus comprobaciones; así se revisa todo de una vez. Marca cada línea al pasarla y abre una tarea si algo falla.

> **Para pasarla, sigue [fase-final.md](fase-final.md):** la misma pila más los pasos de instalar, desplegar y publicar, en el orden en que
> conviene hacerlos (cada paso deja listo lo que necesita el siguiente). Las secciones de abajo guardan el detalle y lo ya comprobado; se ponen
> al día al acabar la fase final.

### F1 · iPhone
- [ ] Pasar la [lista de pruebas del iPhone](pruebas-iphone.md) entera (instalar, teclado de iOS, gestos del tablero, sin conexión) y corregir lo que falle

### F2 · Vista Lista ([#15](https://github.com/lopezz-dev/muninn/pull/15))
> En el navegador (Playwright, 1440×900 y 390×844) pasa el 20 de octubre: casilla con «Deshacer», grupos plegables, filtros, sin scroll
> horizontal y zona táctil de 46 px; la vista se recuerda al recargar (`muninn.boardView`, solo el proyecto que está en Lista). La fila
> no mostraba el número de issue («GitHub» a secas): arreglado. Queda lo del iPhone real:
- [ ] En el iPhone: cambiar a **Lista** en un proyecto; la casilla de cada fila se toca bien (zona de 44 px) y completa con «Deshacer»
- [ ] Cerrar y abrir la app: el proyecto sigue en Lista (se recuerda por dispositivo); en el ordenador sigue en Tablero

### F2 · Vista Calendario (ADR-0068)
> En el navegador (Playwright, 1440×900 y 390×844, modo demo) pasa el 30 de octubre: crear en un día y sin fecha, arrastrar de la bandeja a
> un día y de un día a la bandeja con «Deshacer», teclado (Espacio, flechas, Espacio), «+N más», «N vencidas», semana, mes vacío, hoja
> «Cambiar fecha» en el móvil y sin conexión (sin arrastre ni «+»). Queda lo del iPhone real:
- [ ] En el iPhone: cambiar a **Calendario**; tocar un día enseña sus tareas; **mantener pulsada** una tarea abre «Cambiar fecha» (y no el
  menú de enlace de Safari); «Otra fecha» abre la rueda de iOS; deslizar a la izquierda completa
- [ ] En el ordenador, con datos reales: arrastrar entre meses parándose sobre ‹ ›; la vista se recuerda en mes o semana al recargar

### F2 · Sincronización con GitHub ([#16](https://github.com/lopezz-dev/muninn/pull/16))
> Probado el 20 de octubre con `lopezz-dev/huginnDB` (issues de prueba #253 y #254, ya cerradas y con sus tareas archivadas): `gh` para
> GitHub, Playwright para la app y SQL para `tasks`, `github_outbox` y `net._http_response`.
- [x] Puesta en marcha: los 7 pasos de [gotchas/db](gotchas/db.md) › «Sincronización con GitHub (pasos manuales)». El paso 7 (activar el
  módulo GitHub) faltaba y se hizo durante la prueba
- [x] El `ping` del webhook da 200 (`gh api …/hooks/<id>/deliveries`); una entrega con la firma cambiada da 401 (`curl`)
- [x] Ajustes › Integraciones: elegir un repo **público** al que el token no llega avisa «El token no tiene acceso…» y no lo vincula; `huginnDB` se vincula. Uno ya vinculado sale «en …» y en gris
- [x] Abrir una issue en el repo vinculado → aparece en la primera columna «Por hacer» («Pendiente») en ~6 s y sin recargar, con «GitHub #n», sus etiquetas y el enlace a la issue
- [x] Editar el título de la issue → cambia en Muninn; en el detalle, título y descripción no se pueden editar
- [x] Cerrar la issue → la tarea pasa a «Hecho»; reabrirla → vuelve a «Por hacer»
- [x] Completar la tarea en Muninn → la issue se cierra en ≤ 5 min; reabrirla en Muninn → la issue se reabre. Varios cambios seguidos se
  resuelven en un solo envío con el estado del momento, y lo que llega de GitHub no se apunta en la cola (no hay ida y vuelta)
- [x] Borrar la issue (o transferirla) → la tarea se archiva (probado borrando, en ~4 s)
- [x] Ajustes › Integraciones dice cuántas tareas han llegado y cuándo fue el último cambio
- [x] `select * from github_outbox where processed_at is null` queda vacío tras un ciclo del cron

### F2 · Columna «Para el agente» (ADR-0032)
> Probado el 20 de octubre en la app (Playwright) y en `huginnDB` (issue #256) sin el workflow: la etiqueta llega en ~6 s al mover y se
> va en ~4 s al sacar; una tarea manual no entra («Solo las tareas de GitHub…»); con webhooks `pull_request` firmados (PRs ficticios
> #9998 y #9999): abierto → «Revisión» con «Ver el PR», cerrado → «Pendiente», fusionado → «Hecho» y la issue se cierra; quitar la
> etiqueta sin PR → «Pendiente» con «terminó sin abrir un PR».
>
> El 21 de octubre, con el workflow de verdad (issues #258, #261, #263 y #265, ya cerradas y con sus tareas archivadas): la primera ejecución falló en 2 s sin
> llegar al modelo (la Action oculta el motivo; ver [gotchas/ci](gotchas/ci.md#el-agente-falla-en-segundos-sin-decir-por-qué)) y la tarea
> volvió sola a «Pendiente»; la segunda abrió [#260](https://github.com/lopezz-dev/huginnDB/pull/260) (autor `app/claude`, una línea).
- [x] Puesta en marcha en `huginnDB`: [gotchas/ci](gotchas/ci.md#columna-para-el-agente-pasos-manuales) › pasos 4 y 5 (App de Claude,
  `CLAUDE_CODE_OAUTH_TOKEN` y el workflow en `main`)
- [x] Mover una issue sencilla a la columna: arranca «Muninn · agente» en Actions y abre un PR contra `develop` con `Closes #n`; la
  tarea pasa a «Revisión» y la CI del repo corre en el PR
- [x] Fusionar el PR del agente: la tarea pasa a «Hecho» y la issue se cierra (#260 en `develop`: «Hecho» en 5 s, issue cerrada en 71 s
  por la cola, que queda vacía)
- [x] Sacar la tarea de la columna con el agente en marcha: la ejecución se cancela (job `stop`). Con #261 la cancelación llegó ~30 s
  tarde y el PR (#262) ya estaba abierto ([gotchas/ci](gotchas/ci.md#sacar-la-tarea-no-siempre-cancela-a-tiempo)), y se añadió el paso
  «Cerrar el PR si sacaste la tarea» (huginnDB [#264](https://github.com/lopezz-dev/huginnDB/pull/264)). Repetido con #265: el paso de
  Claude quedó cancelado ~1 min después de sacarla, sin PR ni rama, y la tarea se quedó donde la dejé. Ese paso corrió sin nada que
  cerrar: el cierre automático de un PR que llegue antes de la cancelación aún no se ha visto en real
- [x] Cerrar el PR del agente sin fusionar: la tarea vuelve a «Pendiente» (`agent_pr_closed`, #262 cerrado a mano)
- [x] Una issue que el agente no puede resolver: comenta, no abre PR, y la tarea vuelve a «Por hacer» (#263, «Connections sometimes
  don't work»: pidió driver, error exacto y cuándo pasa; `agent_stopped`)

### F2 · MCP remoto ([#18](https://github.com/lopezz-dev/muninn/pull/18))
- [x] Desplegar la función `mcp` y comprobar con `curl` el 401 y los metadatos: [gotchas/mcp](gotchas/mcp.md) › «MCP remoto (pasos manuales)».
  Hecho el 21 de octubre: sin token 401 con `resource_metadata`, metadatos 200, GET 405, token inventado 401 y `Origin` no permitido 403
- [ ] Claude Code con `--header "Authorization: Bearer <token>"`: «¿Cómo voy hoy?» responde con tus datos; con el token caducado, 401
- [x] Pantalla `/oauth/consent` con una solicitud real (28 de octubre, desde claude.ai). Antes, la autorización aún redirigía a
  `localhost:5174`: la *Site URL* de Supabase no estaba en la web publicada ([gotchas/mcp](gotchas/mcp.md#el-servidor-oauth-manda-a-localhost))
- [x] Activar el servidor OAuth (paso 4 de gotchas/mcp): hecho el 21 de octubre; `/.well-known/oauth-authorization-server/auth/v1` da 200
  con `registration_endpoint` (tarda un par de minutos en aplicarse tras guardar)
- [ ] OAuth sin claude.ai, con Claude Code: `claude mcp add --transport http muninn-remoto <URL>` sin cabecera y, en una sesión interactiva,
  `/mcp` › muninn-remoto › *Authenticate*: abre el navegador en `/oauth/consent` y, tras «Permitir acceso», lista tus proyectos
- [x] Añadir el conector en claude.ai: te lleva a `/oauth/consent`, «Permitir acceso» vuelve a claude.ai y salen las herramientas (28 de
  octubre: 15 de lectura y 21 de escritura, el catálogo actual). Salía con el icono de Supabase: el servidor ya declara el logo de Muninn (falta redesplegar `mcp`, fase final)
- [ ] Lo mismo desde la app de Claude en el iPhone (necesita la PWA publicada)

### F3 · Finanzas
> Migración aplicada el 21 de octubre con `apply_migration` (versión alineada a `20261021120000`); RLS comprobada en SQL con una sesión
> simulada (0 filas ajenas en tablas y vista) y las tres tablas en `supabase_realtime`. El MCP de stdio y el paquete de la Edge están
> recompilados. La función `mcp` se redesplegó el 26 de octubre.
- [x] Redesplegar la función `mcp` para que el MCP remoto tenga Finanzas: `pnpm --filter @muninn/mcp build:edge` y
  `npx supabase@2 functions deploy mcp --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt --use-api` ([gotchas/mcp](gotchas/mcp.md))
- [ ] Con tu sesión (en el 5174): activar Finanzas, crear una cuenta «Prueba F3 …», apuntar, editar y archivar con «Deshacer», y
  archivar la cuenta al acabar. En la demo (5175) y con SQL dentro de `rollback` pasa el 21 de octubre; con tu sesión no se pudo porque
  el 5174 lo tenía ocupado otra sesión
- [ ] En el iPhone: la hoja «Nuevo movimiento» se abre desde abajo, el importe saca el teclado decimal y no hace zoom; con dos
  dispositivos, lo apuntado en uno aparece en el otro sin recargar
- [ ] Suscripciones con tu sesión: crear «Prueba F3 …» con el cobro mañana; sale en Inicio › «Próximos cobros»; «Apuntar» crea el gasto
  con el icono de repetición y «Deshacer» lo quita; archivarla al acabar. En la demo pasa el 22 de octubre, y la unicidad del cobro en SQL
  (`rollback`)
- [ ] Con Claude conectado (stdio con tus datos de la nube, reiniciando el cliente tras compilar): «He gastado 24,90 en el cine» apunta un
  gasto en tu cuenta corriente con la categoría Ocio, y «¿cuánto tengo?» da los mismos saldos que la app

### F3 · Avisos push (fase final)
> Montado el 28 de octubre sin desplegar: falta todo lo de [gotchas/web › Web Push](gotchas/web.md#publicar-la-pwa-y-activar-web-push-pasos-manuales)
> (claves, migración, función, cron, variable en Vercel). Pasos en [fase-final.md](fase-final.md), 4b y 5.
- [ ] `curl` a `/push/send` sin secreto da 401; con secreto, `{ users, results, pruned }`
- [ ] En el iPhone instalado: Ajustes › Notificaciones › activar, **Permitir**, «Enviar prueba» llega y al tocarlo abre Notificaciones
- [ ] Una suscripción «Prueba final» que cobra mañana: tras lanzar el cron a mano, llega «Mañana te cobran…» y abre Finanzas › Suscripciones
- [ ] Lanzar el cron otra vez no repite el aviso; quitar el dispositivo con «Deshacer» lo recupera; cerrar sesión lo quita de la lista
- [ ] Safari sin instalar enseña «Añade Muninn a tu pantalla de inicio»; tras «No permitir», «Avisos bloqueados»

### F4 · Asistente (fase final)
> El MCP de stdio y el paquete de la Edge están recompilados con el catálogo único; la función `mcp` se redesplegó el 26 de octubre. La
> migración del actor `assistant` está aplicada (versión alineada).
- [ ] Instalar Ollama, `OLLAMA_ORIGINS` y `ollama pull qwen3:8b`: [gotchas/desktop](gotchas/desktop.md#instalar-ollama-y-el-modelo-del-asistente-pasos-manuales-fase-final)
- [ ] Banco de pruebas contra el modelo: `pnpm --filter @muninn/assistant bench -- --model qwen3:8b` (y `qwen3:14b` para comparar); apunta
  aquí cuántos casos pasan y el tiempo, y deja el que mejor vaya como modelo por defecto
- [x] Redesplegar la función `mcp` con el catálogo único: `pnpm --filter @muninn/mcp build:edge` y
  `npx supabase@2 functions deploy mcp --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt --use-api` (lleva también lo de Finanzas)
- [ ] Con Claude conectado por stdio (reiniciando el cliente tras compilar): las mismas herramientas de siempre responden igual
- [ ] Con tu sesión en el ordenador (5174 o la app de escritorio) y Ollama listo: «¿Cómo voy hoy?» responde con tus datos; «Crea una tarea
  «Prueba F4 …» en <proyecto>» la crea con «El asistente» en su historial y «Deshacer» la archiva. Archívala al acabar. En la demo (5175)
  pasa el 22 de octubre: resumen, gasto con «Deshacer» (actividad `assistant` → `user`), ⌘K con `?q=` y el módulo desactivado
- [ ] Sin Ollama abierto: sale «No encuentro Ollama…» con los pasos y, al abrirlo, el punto se pone verde solo (≤ 8 s); en la app de
  escritorio (Tauri), lo mismo (comprueba que `OLLAMA_ORIGINS` admite `tauri.localhost`)
- [ ] En el iPhone: la pantalla dice que el asistente usa el modelo del ordenador y no intenta conectar

### F4 · Noticias (fase final)
> Tablas aplicadas el 22 de octubre (versión alineada) y RLS comprobada en SQL con `rollback` (el dueño ve lo suyo, otra sesión 0 filas, sin
> duplicados por `guid`). En la demo (5175, «Prueba F4 …») pasa: activar el módulo, temas, guardadas, pausar fuente con «Deshacer», «Crear
> tarea» con el título, ⌘K «Buscar en Noticias» y móvil sin scroll horizontal.
- [x] Desplegar la función `news` y su cron: [gotchas/db](gotchas/db.md#noticias-descarga-con-la-edge-function-pasos-manuales) (pasos 1–4)
- [ ] Con tu sesión: añadir 2–3 fuentes reales (una Atom, una RSS, una que falle) y «Actualizar»: llegan artículos; la que falla enseña el
  error; volver a «Actualizar» no duplica nada
- [ ] Con Ollama: abrir Noticias genera «Lo importante de hoy» solo; «Rehacer» lo cambia y «Deshacer» devuelve el anterior; en el iPhone se ve
  el mismo resumen
- [ ] Con el ordenador apagado una noche: por la mañana, en el iPhone, hay artículos nuevos (el cron funciona sin el ordenador)
- [x] Redesplegar `mcp` (lleva `list_news` y `news_digest`)

### F4 · Informe de la mañana (fase final)
> En la demo (5175) pasa el 25 de octubre: activarlo con «Deshacer», «Hacer ahora» crea la nota fijada con actor `assistant`, a las 12:58
> dice que a las 08:30 no estaba abierto, y sale arriba en el Asistente.
- [ ] Con tu sesión en el ordenador: activarlo para dentro de 2 minutos con Muninn abierto; llega el aviso «Tu informe de la mañana está
  listo», la nota está fijada y lleva la entradilla del modelo (con Ollama) y el resumen de noticias
- [ ] Al día siguiente, con el ordenador apagado a esa hora: al abrir Muninn se hace solo y dice a qué hora; el de ayer ya no está fijado
- [ ] En el iPhone: el informe se lee en Notas y en el Asistente, y el iPhone no genera ninguno

### Escritorio · primera versión y actualizaciones (ADR-0046, ADR-0047)
> Probado el 28 de octubre: repo público, [v0.2.0](https://github.com/lopezz-dev/muninn/releases/tag/v0.2.0) y
> [v0.2.1](https://github.com/lopezz-dev/muninn/releases/tag/v0.2.1). La 0.2.0 salió sin las variables de Supabase (solo modo demo);
> la 0.2.1 lo arregla ([#55](https://github.com/lopezz-dev/muninn/pull/55)) y llegó a Windows con el propio actualizador.
- [x] La release lleva los instaladores firmados y `latest.json`, descargable sin sesión
- [x] El `-setup.exe` se instala en Windows sin administrador (tras «Ejecutar de todas formas») y entra con tu cuenta
- [x] Con una versión más nueva publicada, al abrir sale «Hay una versión nueva · Reiniciar» y al pulsarlo se reinicia en la versión nueva
- [ ] Sin conexión, al abrir no sale ningún aviso

### Enlaces externos (`tauri-plugin-opener`)
> Antes, en escritorio ningún enlace externo abría nada (`target="_blank"` no hace nada en Tauri). Ahora todos pasan por `openExternal`.
> Probado con tests (escritorio o web, y el aviso si falla) y `cargo check`; nada a mano todavía.
- [ ] Escritorio (`pnpm dev:desktop` y la app instalada tras la siguiente versión): en Noticias, el título y «Abrir» abren el artículo en el
  navegador del sistema y la noticia queda leída; también la issue y «Ver el PR» del detalle de una tarea, «PR #n» de la pantalla GitHub,
  un enlace dentro de una nota y «GitHub» de Ajustes › Acerca de
- [ ] Escritorio: las imágenes adjuntas en el Asistente se ven en la burbuja y no llevan enlace
- [ ] Navegador: los mismos enlaces abren otra pestaña y la noticia queda leída; Ctrl/⌘-clic sigue abriendo en segundo plano; una imagen
  adjunta del Asistente se abre a tamaño real en otra pestaña
- [ ] iPhone (PWA instalada): «Abrir» y el título de una noticia abren el artículo en Safari (o en la hoja de Safari) sin cerrar Muninn, y al
  volver la noticia sale leída; lo mismo con un enlace de una nota; una imagen adjunta del Asistente se abre

## F3 · Móvil y finanzas
> **Estado:** cerrada en código el 22 de octubre (decisión de Alex). Finanzas (modelo, pantalla, suscripciones y panel) en
> [#30](https://github.com/lopezz-dev/muninn/pull/30) → [#31](https://github.com/lopezz-dev/muninn/pull/31) →
> [#32](https://github.com/lopezz-dev/muninn/pull/32) → [#33](https://github.com/lopezz-dev/muninn/pull/33) (apilados, en ese orden) y el
> diseño de la PWA con Web Push en [#34](https://github.com/lopezz-dev/muninn/pull/34). Primero se monta toda la app **sin publicar**:
> publicar la web, los avisos push (que necesitan la web publicada) y la pila [Pruebas finales](#pruebas-finales) quedan para la fase final.
- [ ] PWA instalable en iPhone con Web Push (iOS 16.4+)
  - [x] Diseño en ADR-0040 (hosting en Vercel **aceptado** el 26 de octubre; `push-sw.js`, suscripciones por dispositivo, Edge Function
    `push` con cron y VAPID, **propuesto**); preparado `apps/web/vercel.json` y el manejador de `push` en el service worker
  - [x] Publicar la web: **https://muninn-sepia.vercel.app** desde el 26 de octubre (equipo Kodemaru, rama `develop` mientras dura la fase
    final). Falta la *Site URL* de Supabase y probarla en el iPhone: [fase final](fase-final.md), pasos 4 y 5
  - [x] Implementar la suscripción (Ajustes › Notificaciones, con dispositivos y «Deshacer»), las tablas `push_subscriptions` y `push_log`
    (migración `20261028180000_push_subscriptions`, **sin aplicar**), `m.push` en el core con tests y la Edge Function `push` con cron
    diario (28 de octubre); guía [Notificaciones](user/13-notificaciones.md)
  - [ ] Claves VAPID, migración, despliegue de `push`, cron y `VITE_VAPID_PUBLIC_KEY` en Vercel, y probarlo en el iPhone:
    [fase final](fase-final.md), paso 4b
- [ ] Finanzas: cuentas, gastos, ingresos, ahorro, inversión, categorías
  - [x] Modelo de datos (ADR-0037): cuentas con saldo derivado, categorías de serie y propias, movimientos (gasto, ingreso, traspaso)
    en céntimos; migración `20261021120000_finance` aplicada el 21 de octubre; core con tests y herramientas del MCP sin borrados
  - [x] Pantalla Finanzas: Resumen (cuentas y últimos movimientos), Movimientos (mes, filtros, alta fija en escritorio y hoja en móvil)
    y Cuentas (cuentas y categorías editables), con escrituras optimistas, «Deshacer» y tiempo real; guía [Finanzas](user/10-finanzas.md)
  - [ ] Ajuste de valor de una inversión (hoy, un ingreso o gasto en esa cuenta) y multidivisa: fuera de esta fase
- [ ] Suscripciones recurrentes con aviso antes del cobro
  - [x] Suscripciones semanales, mensuales y anuales (ADR-0038): al llegar la fecha la app **avisa** (Inicio y Finanzas) y el cobro se
    apunta o se salta con un toque, con «Deshacer»; nunca se apunta solo. Migración `20261021140000_finance_subscriptions` aplicada el
    21 de octubre. MCP: listar, crear, apuntar, saltar y archivar
  - [x] Aviso push antes del cobro: la función `push` avisa cada mañana de los cobros dentro de sus días de aviso, una vez por cobro
    (28 de octubre; se prueba en la fase final con el resto de Web Push)
- [x] Panel mensual (entradas, salidas, tasa de ahorro): calculado en el core (ADR-0039), con el mes anterior, gasto por categoría y
  los últimos 6 meses; en Finanzas › Resumen y en el MCP (`finance_month_report`)
- [ ] (v2) Importar CSV de Imagin / conexión bancaria. Fuera de la sesión del 21–22 de octubre por alcance; el modelo ya lo admite
  (movimientos en céntimos con concepto y fecha: `parseAmount`/`centsFromEuros` en el borde)
- [ ] Rediseño responsive en tres tamaños (teléfono, tablet y ordenador), por fases. Diseño: [lienzo «Muninn — Móvil 2.0»](https://claude.ai/artifact/2T6zpnVrJUfTU7xvBUi9zg)
  - [x] Fase 1 ([ADR-0054](adr/0054-shell-responsive-en-tres-tamanos.md)): barra de pestañas con el logo de Muninn para el Asistente
    (teléfono), raíl de iconos (tablet), barra lateral completa (≥ 1024 px); Inicio sin desbordarse, con una franja de números,
    «Día despejado» y sin tareas repetidas; rejillas con columnas declaradas en Finanzas, Proyectos y Cuentas
  - [x] Fase 2a: Proyectos en tres tamaños (tarjetas con portada, barra por estados, avisos, lo próximo y actividad; filtros,
    orden y Archivados con «Recuperar»), editar proyecto (nombre, descripción, color e imagen) desde la tarjeta y el tablero, e
    imagen de proyecto en Storage ([ADR-0055](adr/0055-imagen-de-proyecto-en-storage.md)). Migración
    `20261028120000_project_images` aplicada el 28 de octubre. Logo y portada por separado, con el color del logo como color del proyecto
    ([ADR-0056](adr/0056-logo-y-portada-de-proyecto-con-color-del-logo.md), migración `20261028150000_project_cover`)
  - [ ] Fase 2b: tablero en el teléfono (cabecera con «‹ Proyectos», columnas como chips, «Añadir» dentro de la columna)
    - [x] Cabecera del proyecto en dos filas: «‹ Proyectos» con el selector de vista en iconos, y el título con filtro, + y ⋯
      (31 de octubre)
  - [ ] Fase 3: detalle de tarea con las acciones abajo, al alcance del pulgar; nueva tarea y nuevo movimiento como hojas
  - [x] Barra de abajo configurable (1–4 pestañas, en tu cuenta) con tu avatar en lugar del botón del Asistente, hoja «Tu cuenta»
    en lugar de «Más» y de la pantalla de Ajustes en el móvil, y menú de usuario (⌘⇧U) y «Plegar barra» en el ordenador
    ([ADR-0072](adr/0072-dock-configurable-hoja-de-cuenta-y-menu-de-usuario.md); 30 de octubre)
  - [ ] Fase 4: Finanzas, Notas y el Asistente como hoja; repasar todas las pantallas a 390, 820 y 1280 px

## F4 · Jarvis
> **Estado:** en código, salvo la voz. Cerebro, Asistente, Noticias e informe de la mañana están en `develop` desde el 26 de octubre
> ([#35](https://github.com/lopezz-dev/muninn/pull/35) a [#38](https://github.com/lopezz-dev/muninn/pull/38), más el arreglo de SSRF de
> Noticias en [#40](https://github.com/lopezz-dev/muninn/pull/40)); la voz, solo diseñada en [#39](https://github.com/lopezz-dev/muninn/pull/39)
> (ADR-0044, propuesto). Nada instalado ni desplegado: Ollama, el modelo, las funciones `news` y `mcp` y las pruebas con tu sesión van en la
> [fase final](fase-final.md) (pasos 1–3 y 5–8). No se cierra hasta elegir el modelo con el banco y decidir qué hacer con la voz.
- [ ] Ollama + modelo de 8–14B con tool calling sobre el MCP de Muninn
  - [x] Cerebro (ADR-0041): el bucle corre en la app con el core y la sesión del usuario y habla con Ollama en `localhost:11434`; catálogo
    único de herramientas en `@muninn/assistant` compartido con el MCP (que ya no tiene herramientas propias); actor `assistant` con
    `payload.context` (migración `20261022120000_assistant_actor`, aplicada el 22 de octubre); proveedor de Ollama y guionizado; banco de
    pruebas en `pnpm test` con el guion ideal
  - [x] Pantalla **Asistente** (lienzo): conversación en streaming, chips de las herramientas usadas, «Ha cambiado» con «Abrir» y
    «Deshacer», ⌘K «Preguntar a Muninn» (`?q=`, se envía solo), estados «Ollama no responde», «Falta el modelo» y «en el móvil no hay
    modelo» con los pasos, historial de las últimas 30 conversaciones en el dispositivo y Ajustes › Asistente e IA (dirección y modelo).
    En la demo responde con un guion. Guía [Asistente](user/11-asistente.md). Sin el selector «Local · Claude» del diseño: el cerebro es
    siempre local (Claude se usa por MCP) y el proveedor en la nube queda como opción futura (ADR-0041)
  - [ ] Elegir el modelo con el banco contra Ollama (`qwen3:8b` por defecto; `qwen3:14b` y `llama3.1:8b` como alternativas) → [Pruebas finales](#pruebas-finales)
- [ ] Voz: Whisper (STT) + Piper/Kokoro (TTS), todo en local
  - [x] Diseño en ADR-0044 (**propuesto**): whisper.cpp (`whisper-server`, large-v3-turbo-q5_0) y Piper (`es_ES-davefx-medium`) como
    servicios locales aparte que llama la app de escritorio desde Rust (sin CORS); mantener para hablar con el texto en el campo sin enviar;
    en web/iPhone, sin dictado propio (la Web Speech API no es local) y «Escuchar» con `speechSynthesis` del dispositivo. Pasos de
    instalación en [gotchas/desktop](gotchas/desktop.md#instalar-la-voz-whispercpp-y-piper-pasos-manuales-cuando-se-implemente)
  - [ ] Implementarlo (comandos de Tauri, grabación a WAV, botón de mantener, «Escuchar» en Noticias y en el informe). No entró en la sesión
    del 22–26 de octubre por tiempo; necesita además instalar Python, Piper y whisper.cpp en tu equipo (tuyo) para probarlo
- [ ] Noticias: fuentes RSS elegidas + resumen diario
  - [x] Diseño (ADR-0042): tablas `news_sources`, `news_items` y `news_digests` con RLS y en Realtime (migración `20261022140000_news`,
    aplicada el 22 de octubre), lector RSS/Atom en el core con tests, sin duplicados por `guid`, limpieza a los 30 días de lo no guardado
  - [x] Edge Function `news` (cron cada hora y «Actualizar» con la sesión) **desplegada el 26 de octubre**, con su cron: pasos en
    [gotchas/db](gotchas/db.md#noticias-descarga-con-la-edge-function-pasos-manuales)
  - [x] Pantalla **Noticias** (lienzo): resumen del día generado en local, temas, guardadas, búsqueda, artículos con «Relacionada con…»,
    «Crear tarea», «Guardar como nota», «Leer luego» y fuentes (añadir, pausar y quitar con «Deshacer»). Guía [Noticias](user/12-noticias.md).
    Sin «Escuchar» del diseño: llega con la voz (bloque E)
  - [x] Asistente y MCP: `list_news` y `news_digest` (solo lectura); ⌘K «Buscar en Noticias»
- [ ] Agentes programados que informan del estado de las tareas
  - [x] Informe de la mañana (ADR-0043): a la hora elegida (Ajustes › Asistente e IA, desactivado por defecto) el ordenador prepara tareas
    vencidas, de hoy y en curso, cobros de 7 días y el resumen de noticias (más una entradilla del modelo si está) y lo guarda como **nota
    fijada** con actor `assistant`. Si el ordenador estaba apagado, se hace al abrir Muninn ese día y lo dice; no recupera días pasados.
    Sale arriba en la lista del Asistente. Probado en la demo y con tests
  - [ ] Otros agentes (p. ej. resumen semanal, avisos de tareas atascadas): fuera de esta sesión; el mismo esquema sirve

## Acceso y seguridad
Hoy se entra con un código por correo o con GitHub ([ADR-0022](adr/0022-auth-y-sesion.md)). Siguientes pasos,
más o menos en este orden:
- [x] **CAPTCHA en la entrada** con Cloudflare Turnstile antes de abrir el registro
  ([ADR-0060](adr/0060-captcha-con-turnstile-en-la-entrada.md)). Montado; falta activarlo (fase final, paso 4c)
- [ ] Dominio propio de Muninn como remitente (hoy, provisional: `no-reply@shion.es`)
- [ ] **Claves de acceso (passkeys, WebAuthn):** entrar con Face ID, Touch ID, Windows Hello o una llave
  física, sin correo ni contraseña. Funciona en la PWA del iPhone y en el navegador; en Tauri, según el
  soporte de WebAuthn de cada sistema
- [x] **Segundo factor (MFA) con app de códigos (TOTP)**, opcional: alta con QR y clave, código al entrar y desactivar con un
  código ([ADR-0061](adr/0061-seguridad-de-la-cuenta.md)). Montado y con tests del core; la prueba real, en la fase final (4d)
  - [x] Exigirlo en el servidor (RLS, también en las funciones de sesiones) y para conectar GitHub
    ([ADR-0062](adr/0062-aal2-para-integraciones-sensibles.md)). Finanzas, cuando conecte algo externo. La prueba real, en la fase final (4d)
  - [ ] Códigos de recuperación (en supabase-js aún experimentales)
- [x] **Apps con acceso** en Ajustes › Cuenta: ver y quitar los permisos OAuth dados a otras apps, como claude.ai
  ([ADR-0061](adr/0061-seguridad-de-la-cuenta.md); venía del Backlog). La prueba real, en la fase final (4d)
- [x] **Sesiones y dispositivos** en Ajustes › Cuenta: ver dónde tienes la sesión abierta y cerrarla en uno
  o en todos ([ADR-0061](adr/0061-seguridad-de-la-cuenta.md)). Montado y con tests del core; la migración y la
  prueba real, en la fase final (4d)
- [ ] **Bloqueo de la app** al abrirla o tras un rato inactiva: biometría del sistema en escritorio (Tauri)
  y clave de acceso en el móvil, sin cerrar la sesión
- [ ] Aviso por correo cuando se inicia sesión desde un dispositivo nuevo
- [x] Deep links en Tauri para GitHub OAuth en escritorio (`muninn://auth/callback`, [ADR-0059](adr/0059-deep-links-para-oauth-en-escritorio.md)). Falta probarlo instalado: [fase final](fase-final.md), paso 3
- [ ] Más proveedores: Apple (útil en iPhone) y Google
- [ ] Protección anti-bots en el formulario (CAPTCHA de Supabase Auth) antes de abrir el registro al público

## Backlog
- GitHub para varios usuarios: GitHub App con instalación por usuario en lugar de un token personal (ADR-0031, consecuencias)
- MCP remoto sin OAuth: tokens personales de Muninn creados y revocados desde Ajustes (plan B de ADR-0033)
- Tablero: color propio de columna, y reordenar las subtareas arrastrándolas
- Modo local persistente sin cuenta (IndexedDB), en lugar de la demo en memoria
- Posición de las notificaciones configurable en Ajustes › Apariencia (arriba o abajo; en móvil, abajo queda
  encima del dock). Hoy van arriba en el centro por ADR-0019: el cambio necesita un ADR que lo actualice
- Centro de notificaciones persistente (campana con historial: agentes, GitHub, cobros) además de las píldoras efímeras
- Widgets personalizables por pestaña (qué se ve y en qué orden), ocupando todo el espacio disponible
- Logo definitivo (lo diseña Alex; el actual es provisional). Al cambiarlo, regenerar el favicon y los iconos de la web
  (`pnpm --filter @muninn/web icons` y la imagen social), los de escritorio (`pnpm --filter @muninn/desktop icons`) y el del
  conector MCP (`packages/mcp/src/icon.ts`)
- Guías de ayuda públicas (sin sesión) y prerenderizadas, para que los buscadores las indexen (ADR-0045, *propuesto*). Se hará
  junto con la landing page; entonces, añadirlas a `sitemap.xml` y dar de alta Search Console
- Vibrancy nativa en escritorio (Mica/Acrylic en Windows, NSVisualEffect en macOS) además del cristal CSS
- Módulo Focus (temporizador tipo "isla")
- Migración a servidor propio (Supabase self-hosted)
