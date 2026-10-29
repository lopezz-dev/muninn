# Documentación de usuario

Guías para quien **usa** Muninn. Estos ficheros son la fuente de la sección **Documentación** de la app:
se renderizan tal cual, así que se escriben pensando en la persona usuaria, no en quien desarrolla.

## Páginas

| # | Página | Grupo | Icono | Estado |
|---|---|---|---|---|
| 1 | [Bienvenida](01-bienvenida.md) | primeros-pasos | flag | disponible |
| 2 | [Instalación](02-instalacion.md) | primeros-pasos | download | parcial |
| 3 | [Proyectos y tablero](03-proyectos-y-tablero.md) | tu-trabajo | projects | parcial |
| 4 | [Tareas](04-tareas.md) | tu-trabajo | checklist | disponible |
| 5 | [Notas](05-notas.md) | tu-trabajo | notes | disponible |
| 6 | [Conectar Claude y otros](06-asistentes-ia.md) | ia | plug | disponible |
| 7 | [Tus datos y privacidad](07-datos-y-privacidad.md) | cuenta | shield | disponible |
| 8 | [Moverte por Muninn](08-moverte-por-muninn.md) | primeros-pasos | compass | parcial |
| 9 | [GitHub](09-github.md) | modulos | github | parcial |
| 10 | [Finanzas](10-finanzas.md) | modulos | finance | parcial |
| 11 | [Asistente](11-asistente.md) | ia | assistant | parcial |
| 12 | [Noticias](12-noticias.md) | modulos | news | parcial |
| 13 | [Notificaciones](13-notificaciones.md) | cuenta | bell | parcial |
| 14 | [Cuenta y seguridad](14-cuenta-y-seguridad.md) | cuenta | shield | disponible |

## Cómo se escribe una página

Cada página empieza con metadatos que la app usa para construir el menú:

```md
---
title: Proyectos y tablero
description: Organiza tu trabajo en proyectos con un Kanban a tu medida.
order: 3
status: disponible | parcial | proximamente
group: primeros-pasos | tu-trabajo | modulos | ia | cuenta
icon: projects
---
```

- **Grupo e icono** ([ADR-0052](../adr/0052-documentacion-con-grupos-iconos-y-portada.md)): el grupo decide en qué apartado del menú sale la guía (dentro de cada grupo, por
  `order`); el icono es un nombre de los iconos de `@muninn/ui`. Una guía sin grupo conocido sale en «Más guías».

- **Enlaces entre páginas:** `[Notas](05-notas.md)` o `[Archivar](05-notas.md#archivar)`. La app los convierte en
  enlaces dentro de la sección Documentación. No pongas HTML ni imágenes: no se muestran.
- **Tono:** de tú, frases cortas, sin jerga técnica salvo en las secciones avanzadas (marcadas como tales).
- **Estado honesto:** si una función aún no tiene interfaz, se marca con un aviso `> **Próximamente:** …`.
  No se documenta como disponible algo que no lo está.
- **Una tarea por sección:** "Crear un proyecto", "Mover una tarea"… para que se pueda enlazar directamente.
- **Mismo PR:** cualquier cambio visible para el usuario actualiza su página en el mismo PR.
- Las capturas irán en `docs/user/img/` cuando exista la interfaz definitiva.
