# Roadmap

## F1 · Base + tareas y notas
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
- [ ] Login (Supabase Auth) y sesión en la UI ← siguiente paso (crear el proyecto de Supabase: región y organización)
- [ ] Apariencia y módulos en `user_settings` (hoy la apariencia vive en localStorage)
- [ ] Inicio (hoy, próximo, mis tareas, semana), tablero Kanban con drag & drop, notas
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

## Backlog
- Centro de notificaciones persistente (campana con historial: agentes, GitHub, cobros) además de las píldoras efímeras
- Widgets personalizables por pestaña (qué se ve y en qué orden), ocupando todo el espacio disponible
- Buscador ⌘K sobre tareas, notas y noticias (hoy: secciones, proyectos y acciones)
- Iconos más ligeros: Phosphor incluye los seis grosores de cada icono en el bundle inicial
- Logo definitivo (lo diseña Alex; el actual es provisional)
- Vibrancy nativa en escritorio (Mica/Acrylic en Windows, NSVisualEffect en macOS) además del cristal CSS
- Módulo Focus (temporizador tipo "isla")
- Auto-updater de escritorio (requiere publicar binarios en un repo público o endpoint propio)
- Migración a servidor propio (Supabase self-hosted)
