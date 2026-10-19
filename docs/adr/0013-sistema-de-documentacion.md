# ADR-0013: Sistema de documentación: ADRs, gotchas y docs de usuario

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** docs

## Contexto

El proyecto lo desarrollan el autor y agentes (Claude Code, Codex) en sesiones distintas, sin memoria
compartida. Sin documentación, las decisiones se vuelven a debatir y las trampas técnicas se vuelven
a pisar. Además, si Muninn se vende, hace falta documentación para quien la use, y la app tendrá
una sección de Documentación.

## Decisión

Tres tipos de documentación con públicos distintos:

| Tipo | Ubicación | Para quién | Qué contiene |
|---|---|---|---|
| ADRs | `docs/adr/` | Desarrolladores y agentes | Decisiones y su porqué, numeradas e inmutables, indexadas por área |
| Gotchas | `docs/gotchas/<área>.md` | Desarrolladores y agentes | Trampas no obvias: síntoma, causa y solución |
| Docs de usuario | `docs/user/` | Quien usa la app | Guías en lenguaje llano; las mostrará la sección Documentación de la app |

Más `docs/ARCHITECTURE.md` (visión de conjunto) y `docs/ROADMAP.md` (fases).

Reglas (recogidas en `CLAUDE.md`):
- Antes de tocar un área, leer `docs/gotchas/<área>.md`.
- Una decisión estructural lleva un ADR **en el mismo PR**.
- Una trampa encontrada se apunta en gotchas **en el mismo PR**.
- Si un cambio afecta a lo que ve el usuario, se actualiza `docs/user/` en el mismo PR.

## Alternativas consideradas

- **Todo en `CLAUDE.md`:** se carga en cada sesión y crece sin control; mejor un índice corto que enlace.
- **Wiki de GitHub:** queda fuera del repo, no se revisa en los PRs y no la pueden leer los agentes en local.

## Consecuencias

- `CLAUDE.md` se mantiene corto y apunta a la documentación.
- La documentación de usuario en Markdown dentro del repo se puede renderizar en la app y
  versionar con cada release.
