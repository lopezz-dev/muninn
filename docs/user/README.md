# Documentación de usuario

Guías para quien **usa** Muninn. Estos ficheros son la fuente de la sección **Documentación** de la app:
se renderizan tal cual, así que se escriben pensando en la persona usuaria, no en quien desarrolla.

## Páginas

| # | Página | Estado |
|---|---|---|
| 1 | [Bienvenida](01-bienvenida.md) | disponible |
| 2 | [Instalación](02-instalacion.md) | parcial |
| 3 | [Proyectos y tablero](03-proyectos-y-tablero.md) | parcial |
| 4 | [Tareas](04-tareas.md) | parcial |
| 5 | [Notas](05-notas.md) | disponible |
| 6 | [Asistentes de IA (Claude, Codex…)](06-asistentes-ia.md) | disponible |
| 7 | [Tus datos y privacidad](07-datos-y-privacidad.md) | disponible |
| 8 | [Moverte por Muninn](08-moverte-por-muninn.md) | parcial |
| 9 | [GitHub](09-github.md) | parcial |

## Cómo se escribe una página

Cada página empieza con metadatos que la app usa para construir el menú:

```md
---
title: Proyectos y tablero
description: Organiza tu trabajo en proyectos con un Kanban a tu medida.
order: 3
status: disponible | parcial | proximamente
---
```

- **Enlaces entre páginas:** `[Notas](05-notas.md)` o `[Archivar](05-notas.md#archivar)`. La app los convierte en
  enlaces dentro de la sección Documentación. No pongas HTML ni imágenes: no se muestran.
- **Tono:** de tú, frases cortas, sin jerga técnica salvo en las secciones avanzadas (marcadas como tales).
- **Estado honesto:** si una función aún no tiene interfaz, se marca con un aviso `> **Próximamente:** …`.
  No se documenta como disponible algo que no lo está.
- **Una tarea por sección:** "Crear un proyecto", "Mover una tarea"… para que se pueda enlazar directamente.
- **Mismo PR:** cualquier cambio visible para el usuario actualiza su página en el mismo PR.
- Las capturas irán en `docs/user/img/` cuando exista la interfaz definitiva.
