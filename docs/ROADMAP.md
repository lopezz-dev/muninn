# Roadmap

## F1 · Base + tareas y notas
> **Estado:** el código de la F1 está completo (ver las casillas). Quedan **dos pasos manuales** antes de darla por cerrada:
> activar GitHub OAuth en el panel de Supabase y pasar la [lista de pruebas del iPhone](pruebas-iphone.md).
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
- [ ] Activar GitHub OAuth en el panel de Supabase (OAuth App de GitHub + Redirect URLs): pasos en
  [gotchas/db](gotchas/db.md#activar-github-oauth-paso-manual)
- [ ] Pasar la [lista de pruebas del iPhone](pruebas-iphone.md) (gestos, teclado de iOS, sin conexión) y corregir lo que falle
- [ ] Módulos en `user_settings.enabled_modules` (Ajustes › Módulos)
- [x] Inicio (hoy, vencidas, en curso, próximos días, hechas hoy y gráfica de 7 días) con datos reales
- [x] Tablero Kanban con drag & drop (ratón, tacto y teclado; [ADR-0023](adr/0023-drag-and-drop-con-dnd-kit.md)), columnas
  personalizables, límite WIP, detalle de tarea como ruta ([ADR-0024](adr/0024-detalle-de-tarea-como-ruta.md)), subtareas
  y «Deshacer» en cada acción ([ADR-0025](adr/0025-escrituras-optimistas-y-deshacer.md))
- [ ] Notas (editor Markdown, notas vinculadas a proyecto o tarea) ← siguiente paso
- [ ] Sección **Documentación** en la app: renderiza `docs/user/*.md` (menú a partir del front matter, buscador)
- [ ] Sincronización en tiempo real entre dispositivos + caché offline

## F2 · Claude y GitHub
- [x] Servidor MCP (stdio) con herramientas de lectura y escritura
- [ ] Sync GitHub: issues → tareas (insignia GitHub, proyecto por `github_repo`), cerrar issue ↔ completar
- [ ] Columna "Para el agente": etiqueta el issue → Claude Code GitHub Action → PR → la tarea se actualiza
- [ ] MCP remoto (HTTP) para usarlo desde el móvil o desde claude.ai

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
- Tablero: filtros (texto, prioridad, etiquetas, origen, fecha) y vistas Lista y Calendario del diseño
- Tablero: color propio de columna, y reordenar las subtareas arrastrándolas
- Borrado definitivo de tareas desde la app (hoy solo se archivan)
- Descripción de tarea en Markdown
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
