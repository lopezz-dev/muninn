# Roadmap

## F1 · Base + tareas y notas
- [x] Monorepo (pnpm + Turborepo), Biome, TypeScript estricto
- [x] Esquema Supabase con RLS y Realtime
- [x] `@muninn/core`: proyectos, columnas personalizables, tareas, checklist, notas, actividad, informes
- [x] Stores: Supabase, fichero local y memoria
- [x] CI (lint, typecheck, test, build) y releases (release-please + tauri-action: Win/Linux/macOS)
- [x] Esqueleto de Tauri 2 y de la PWA
- [ ] **Sistema de diseño** ← siguiente paso, con el enfoque propio que quiere Alex
- [ ] Login (Supabase Auth) y sesión en la UI
- [ ] Inicio (hoy, próximo, mis tareas, semana), tablero Kanban con drag & drop, notas
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
- Módulo Focus (temporizador tipo "isla")
- Auto-updater de escritorio (requiere publicar binarios en un repo público o endpoint propio)
- Migración a servidor propio (Supabase self-hosted)
