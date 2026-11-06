# Documentación de usuario

Guías para quien **usa** Muninn. Estos ficheros son la fuente de la sección **Documentación** de la app:
se renderizan tal cual, así que se escriben pensando en la persona usuaria, no en quien desarrolla.

Cada guía está en dos idiomas ([ADR-0077](../adr/0077-i18n-ingles-por-defecto-con-i18next.md)): `en/` (en
`/docs/<slug>`) y `es/` (en `/es/docs/<slug>`). Las dos versiones de una guía comparten el **número** del fichero
(`05-notes.md` y `05-notas.md`), que es lo que las empareja, y cada una tiene el slug de su idioma. La lista de
guías con su clave y sus dos slugs está en `apps/web/src/lib/doc-slugs.ts`; un test comprueba que coincide con los
ficheros. La tabla de abajo usa los nombres en español.

## Páginas

| # | Página | Grupo | Icono | Estado |
|---|---|---|---|---|
| 1 | [Bienvenida](es/01-bienvenida.md) | primeros-pasos | flag | disponible |
| 2 | [Instalación](es/02-instalacion.md) | primeros-pasos | download | parcial |
| 3 | [Proyectos y tablero](es/03-proyectos-y-tablero.md) | tu-trabajo | projects | parcial |
| 4 | [Tareas](es/04-tareas.md) | tu-trabajo | checklist | disponible |
| 5 | [Notas](es/05-notas.md) | tu-trabajo | notes | disponible |
| 6 | [Conectar Claude y otros](es/06-asistentes-ia.md) | ia | plug | disponible |
| 7 | [Tus datos y privacidad](es/07-datos-y-privacidad.md) | cuenta | shield | disponible |
| 8 | [Moverte por Muninn](es/08-moverte-por-muninn.md) | primeros-pasos | compass | parcial |
| 9 | [GitHub](es/09-github.md) | modulos | github | parcial |
| 10 | [Finanzas](es/10-finanzas.md) | modulos | finance | parcial |
| 11 | [Asistente](es/11-asistente.md) | ia | assistant | parcial |
| 12 | [Noticias](es/12-noticias.md) | modulos | news | parcial |
| 13 | [Notificaciones](es/13-notificaciones.md) | cuenta | bell | parcial |
| 14 | [Cuenta y seguridad](es/14-cuenta-y-seguridad.md) | cuenta | shield | disponible |

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

- **Enlaces entre páginas:** `[Notas](es/05-notas.md)` o `[Archivar](05-notas.md#archivar)`, con el nombre de fichero
  de su idioma (en inglés, `05-notes.md#…`). La app los resuelve por el número y los convierte en enlaces dentro de la
  sección Documentación. El ancla es el título del apartado en minúsculas, sin tildes y con guiones (`What's new` →
  `what-s-new`); un test comprueba que cada enlace y cada ancla existen. No pongas HTML ni imágenes: no se muestran.
- **Dos idiomas, mismo PR:** un cambio en una guía se hace en las dos versiones, con los mismos apartados y los mismos
  metadatos (`order`, `status`, `group`, `icon`); solo cambian `title` y `description`. Los nombres de botones y
  menús, tal como los dice la app en cada idioma (`apps/web/src/i18n/locales`). Los avisos, con su etiqueta fija:
  `Próximamente` / `Coming soon` y `Estado` / `Status` cambian el icono; el resto (`Importante` / `Important`…) sale
  con el de información.
- **Tono:** de tú, frases cortas, sin jerga técnica salvo en las secciones avanzadas (marcadas como tales).
- **Estado honesto:** si una función aún no tiene interfaz, se marca con un aviso `> **Próximamente:** …`.
  No se documenta como disponible algo que no lo está.
- **Una tarea por sección:** "Crear un proyecto", "Mover una tarea"… para que se pueda enlazar directamente.
- **Mismo PR:** cualquier cambio visible para el usuario actualiza su página en el mismo PR.
- Las capturas irán en `docs/user/img/` cuando exista la interfaz definitiva.
