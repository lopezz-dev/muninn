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
- [x] `@muninn/ui`: tokens → CSS vars, tema Tailwind v4, iconos Phosphor, Geist autoalojada, modo cristal y acento
- [x] Componentes base (`@muninn/ui`): Button, IconButton, Chip, ColorDot, Kbd, Avatar, ProgressBar, Separator, Card, TextField, TextArea, Switch, Checkbox, SegmentedControl, AmountField, Dialog, Sheet, Menu, Tooltip, notificaciones (`notify` + `Toaster`)
- [x] Shell de la app: router con una pantalla por chunk (TanStack Router), barra lateral (escritorio), dock
  con menisco (móvil), buscador ⌘K, pantallas vacías de todas las secciones y Ajustes › Apariencia
- [x] Proyecto de Supabase (`muninn`, eu-west-3 París) con el esquema y los avisos del asesor resueltos
- [x] Login con Supabase Auth: código por correo y GitHub (solo web), sesión persistente, rutas protegidas,
  cerrar sesión y modo demo sin cuenta ([ADR-0022](adr/0022-auth-y-sesion.md))
- [x] Apariencia en `user_settings.preferences` (localStorage como caché del primer render)
- [x] Correos de acceso con SMTP propio (Resend) y plantillas con la marca de Muninn
  ([gotchas/db](gotchas/db.md))
- [x] Activar GitHub OAuth en el panel de Supabase (OAuth App de GitHub + Redirect URLs): pasos en
  [gotchas/db](gotchas/db.md#activar-github-oauth-paso-manual)
- [ ] Pasar la [lista de pruebas del iPhone](pruebas-iphone.md) y corregir lo que falle → en [Pruebas finales](#pruebas-finales)
- [x] Módulos en `user_settings.enabled_modules` (Ajustes › Módulos): el menú, el dock y el buscador solo enseñan lo activo
  ([ADR-0028](adr/0028-modulos-activables-solo-en-la-interfaz.md))
- [x] Inicio (hoy, vencidas, en curso, próximos días, hechas hoy y gráfica de 7 días) con datos reales
- [x] Tablero Kanban con drag & drop (ratón, tacto y teclado; [ADR-0023](adr/0023-drag-and-drop-con-dnd-kit.md)), columnas
  personalizables, límite WIP, detalle de tarea como ruta ([ADR-0024](adr/0024-detalle-de-tarea-como-ruta.md)), subtareas
  y «Deshacer» en cada acción ([ADR-0025](adr/0025-escrituras-optimistas-y-deshacer.md))
- [x] Notas: editor Markdown con barra de formato y vista previa, autoguardado, lista con búsqueda, fijadas y filtro por
  proyecto, y notas vinculadas a proyecto o tarea ([ADR-0026](adr/0026-markdown-marked-a-react-y-textarea.md))
- [x] Sección **Documentación** en la app: renderiza `docs/user/*.md` (menú a partir del front matter, buscador, marca de
  estado, índice de la página; [ADR-0027](adr/0027-documentacion-en-la-app-desde-docs-user.md))
- [x] Sincronización en tiempo real entre dispositivos (Realtime por tabla, invalidando la caché) y caché de lectura sin conexión
  en IndexedDB ([ADR-0029](adr/0029-tiempo-real-y-cache-sin-conexion.md))

## F2 · Claude y GitHub
> **Estado:** en curso. La tanda del 19 de octubre ([#15](https://github.com/lopezz-dev/muninn/pull/15) a [#20](https://github.com/lopezz-dev/muninn/pull/20)) ya está en `develop`.
> La sincronización con GitHub está en marcha y **probada con issues reales** (20 de octubre, con `huginnDB`). El MCP remoto tiene el código listo pero **no está en marcha**. Lo pendiente, en [Pruebas finales](#pruebas-finales).
- [x] Servidor MCP (stdio) con herramientas de lectura y escritura
- [x] Tablero: vista **Lista** (selector Tablero · Lista recordado por proyecto y dispositivo, agrupada por columna, con los filtros y
  sin arrastre; ADR-0030, [#15](https://github.com/lopezz-dev/muninn/pull/15))
- [ ] Tablero: vista **Calendario**. No entra todavía: necesita decidir cómo se arrastra una fecha y dónde van las tareas sin fecha
- [ ] Sync GitHub: issues → tareas, cerrar issue ↔ completar (ADR-0031, [#16](https://github.com/lopezz-dev/muninn/pull/16))
  - [x] Diseño, reglas en el core con tests, cola de salida, Edge Function `github` y migración preparadas
  - [x] Insignia «GitHub #n», enlace a la issue en el detalle y Ajustes › Integraciones (repo por proyecto)
  - [x] Selector de repos en Integraciones; los públicos se comprueban al elegirlos (ADR-0035)
  - [x] Puesta en marcha (migración, token, secretos, despliegue, webhook, cron) y prueba real (20 de octubre, [Pruebas finales](#pruebas-finales))
  - [x] Pantalla **GitHub** del diseño: repos vinculados y sin vincular (vincular, mover y soltar con «Deshacer»), «Sincronizar
    ahora», columna del agente por proyecto y «Ejecuciones recientes» sacadas de la actividad. Sin el interruptor de pausa por repo
    del diseño (no existe en el modelo de datos)
- [ ] Columna «Para el agente»: etiqueta el issue → Claude Code GitHub Action → PR → la tarea se actualiza (ADR-0032, aceptado el
  20 de octubre con la revisión de [#17](https://github.com/lopezz-dev/muninn/pull/17))
  - [x] Columna marcada por proyecto, etiqueta `muninn:agent` que sigue a la columna, PRs del agente que mueven la tarea, cola al
    momento tras mover (`/sync` con `scope`), migración, función desplegada y webhook suscrito a `pull_request`
  - [x] En `huginnDB`: GitHub App de Claude, secreto y workflow en `main`; primer PR real del agente el 21 de octubre
    (huginnDB [#260](https://github.com/lopezz-dev/huginnDB/pull/260)). Queda repetir la cancelación en [Pruebas finales](#pruebas-finales)
- [ ] MCP remoto (HTTP) para usarlo desde el móvil o desde claude.ai (ADR-0033, [#18](https://github.com/lopezz-dev/muninn/pull/18))
  - [x] Transporte HTTP sin estado con el token de Supabase del usuario, detrás de `--http`, con tests; Edge Function `mcp` preparada
  - [ ] Despliegue y OAuth con Supabase para claude.ai y el móvil (sin verificar) → [Pruebas finales](#pruebas-finales)
- [ ] **Escribir sin conexión:** cola de intenciones persistente, UUID del cliente, orden por ancla, conflictos y «Deshacer» sobre lo
  pendiente. ADR-0034 **propuesto** ([#19](https://github.com/lopezz-dev/muninn/pull/19)), para revisarlo juntos antes de implementar; hoy sin red solo se puede leer
  ([ADR-0029](adr/0029-tiempo-real-y-cache-sin-conexion.md))

## Pruebas finales

Pila única de lo que hay que comprobar **a mano** (no se puede verificar desde el ordenador o necesita secretos y despliegues). Cada bloque
que se cierra añade aquí sus comprobaciones; así se revisa todo de una vez. Marca cada línea al pasarla y abre una tarea si algo falla.

### F1 · iPhone
- [ ] Pasar la [lista de pruebas del iPhone](pruebas-iphone.md) entera (instalar, teclado de iOS, gestos del tablero, sin conexión) y corregir lo que falle

### F2 · Vista Lista ([#15](https://github.com/lopezz-dev/muninn/pull/15))
> En el navegador (Playwright, 1440×900 y 390×844) pasa el 20 de octubre: casilla con «Deshacer», grupos plegables, filtros, sin scroll
> horizontal y zona táctil de 46 px; la vista se recuerda al recargar (`muninn.boardView`, solo el proyecto que está en Lista). La fila
> no mostraba el número de issue («GitHub» a secas): arreglado. Queda lo del iPhone real:
- [ ] En el iPhone: cambiar a **Lista** en un proyecto; la casilla de cada fila se toca bien (zona de 44 px) y completa con «Deshacer»
- [ ] Cerrar y abrir la app: el proyecto sigue en Lista (se recuerda por dispositivo); en el ordenador sigue en Tablero

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
> El 21 de octubre, con el workflow de verdad (issues #258, #261 y #263, ya cerradas y con sus tareas archivadas): la primera ejecución falló en 2 s sin
> llegar al modelo (la Action oculta el motivo; ver [gotchas/ci](gotchas/ci.md#el-agente-falla-en-segundos-sin-decir-por-qué)) y la tarea
> volvió sola a «Pendiente»; la segunda abrió [#260](https://github.com/lopezz-dev/huginnDB/pull/260) (autor `app/claude`, una línea).
- [x] Puesta en marcha en `huginnDB`: [gotchas/ci](gotchas/ci.md#columna-para-el-agente-pasos-manuales) › pasos 4 y 5 (App de Claude,
  `CLAUDE_CODE_OAUTH_TOKEN` y el workflow en `main`)
- [x] Mover una issue sencilla a la columna: arranca «Muninn · agente» en Actions y abre un PR contra `develop` con `Closes #n`; la
  tarea pasa a «Revisión» y la CI del repo corre en el PR
- [x] Fusionar el PR del agente: la tarea pasa a «Hecho» y la issue se cierra (#260 en `develop`: «Hecho» en 5 s, issue cerrada en 71 s
  por la cola, que queda vacía)
- [ ] Sacar la tarea de la columna con el agente en marcha: la ejecución se cancela (job `stop`). Probado con #261: la cancelación llegó
  ~30 s tarde y el PR (#262) ya estaba abierto ([gotchas/ci](gotchas/ci.md#sacar-la-tarea-no-siempre-cancela-a-tiempo)). Con el paso
  «Cerrar el PR si sacaste la tarea» (huginnDB [#264](https://github.com/lopezz-dev/huginnDB/pull/264)) falta repetirla: o se cancela,
  o el PR se cierra solo y la tarea vuelve a «Por hacer»
- [x] Cerrar el PR del agente sin fusionar: la tarea vuelve a «Pendiente» (`agent_pr_closed`, #262 cerrado a mano)
- [x] Una issue que el agente no puede resolver: comenta, no abre PR, y la tarea vuelve a «Por hacer» (#263, «Connections sometimes
  don't work»: pidió driver, error exacto y cuándo pasa; `agent_stopped`)

### F2 · MCP remoto ([#18](https://github.com/lopezz-dev/muninn/pull/18))
- [ ] Desplegar la función `mcp` y comprobar con `curl` el 401 y los metadatos: [gotchas/mcp](gotchas/mcp.md) › «MCP remoto (pasos manuales)» (llega con [#18](https://github.com/lopezz-dev/muninn/pull/18))
- [ ] Claude Code con `--header "Authorization: Bearer <token>"`: «¿Cómo voy hoy?» responde con tus datos; con el token caducado, 401
- [ ] Activar OAuth en Supabase y añadir el conector en claude.ai: inicia sesión con tu cuenta de Muninn y lista tus proyectos (**sin verificar**)
- [ ] Lo mismo desde la app de Claude en el iPhone

## F3 · Móvil y finanzas
- [ ] PWA instalable en iPhone con Web Push (iOS 16.4+)
- [ ] Finanzas: cuentas, gastos, ingresos, ahorro, inversión, categorías
- [ ] Suscripciones recurrentes con aviso antes del cobro
- [ ] Panel mensual (entradas, salidas, tasa de ahorro)
- [ ] (v2) Importar CSV de Imagin / conexión bancaria

## F4 · Jarvis
- [ ] Ollama + modelo de 8–14B con tool calling sobre el MCP de Muninn
- [ ] Voz: Whisper (STT) + Piper/Kokoro (TTS), todo en local
- [ ] Noticias: fuentes RSS elegidas + resumen diario
- [ ] Agentes programados que informan del estado de las tareas

## Acceso y seguridad
Hoy se entra con un código por correo o con GitHub ([ADR-0022](adr/0022-auth-y-sesion.md)). Siguientes pasos,
más o menos en este orden:
- [ ] Dominio propio de Muninn como remitente (hoy, provisional: `no-reply@shion.es`)
- [ ] **Claves de acceso (passkeys, WebAuthn):** entrar con Face ID, Touch ID, Windows Hello o una llave
  física, sin correo ni contraseña. Funciona en la PWA del iPhone y en el navegador; en Tauri, según el
  soporte de WebAuthn de cada sistema
- [ ] **Segundo factor (MFA) con app de códigos (TOTP)**, opcional, y obligatorio para conectar integraciones
  sensibles (finanzas, GitHub con permisos de escritura)
- [ ] **Sesiones y dispositivos** en Ajustes › Cuenta: ver dónde tienes la sesión abierta y cerrarla en uno
  o en todos (`signOut({ scope: 'global' })`)
- [ ] **Bloqueo de la app** al abrirla o tras un rato inactiva: biometría del sistema en escritorio (Tauri)
  y clave de acceso en el móvil, sin cerrar la sesión
- [ ] Aviso por correo cuando se inicia sesión desde un dispositivo nuevo
- [ ] Deep links en Tauri para GitHub OAuth en escritorio (hoy el botón se oculta)
- [ ] Más proveedores: Apple (útil en iPhone) y Google
- [ ] Protección anti-bots en el formulario (CAPTCHA de Supabase Auth) antes de abrir el registro al público

## Backlog
- GitHub para varios usuarios: GitHub App con instalación por usuario en lugar de un token personal (ADR-0031, consecuencias)
- MCP remoto sin OAuth: tokens personales de Muninn creados y revocados desde Ajustes (plan B de ADR-0033)
- Tablero: color propio de columna, y reordenar las subtareas arrastrándolas
- Borrado definitivo de tareas desde la app (hoy solo se archivan)
- Modo local persistente sin cuenta (IndexedDB), en lugar de la demo en memoria
- Posición de las notificaciones configurable en Ajustes › Apariencia (arriba o abajo; en móvil, abajo queda
  encima del dock). Hoy van arriba en el centro por ADR-0019: el cambio necesita un ADR que lo actualice
- Centro de notificaciones persistente (campana con historial: agentes, GitHub, cobros) además de las píldoras efímeras
- Widgets personalizables por pestaña (qué se ve y en qué orden), ocupando todo el espacio disponible
- Buscador ⌘K sobre tareas, notas y noticias, y acción «Nueva nota» (hoy: secciones, proyectos y acciones)
- Iconos más ligeros: Phosphor incluye los seis grosores de cada icono en el bundle inicial
- Logo definitivo (lo diseña Alex; el actual es provisional)
- Vibrancy nativa en escritorio (Mica/Acrylic en Windows, NSVisualEffect en macOS) además del cristal CSS
- Módulo Focus (temporizador tipo "isla")
- Auto-updater de escritorio (requiere publicar binarios en un repo público o endpoint propio)
- Migración a servidor propio (Supabase self-hosted)
