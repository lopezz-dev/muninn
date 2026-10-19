# ADR-0028: Los módulos activables ocultan la interfaz; los datos y el MCP no cambian

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web

## Contexto

`user_settings.enabled_modules` existe desde el esquema inicial ([ARCHITECTURE](../ARCHITECTURE.md)) y el diseño de
Ajustes › Módulos pide que «lo desactivado desaparezca del menú». Hay que decidir qué significa desactivar: ¿se borran
datos?, ¿se bloquea el acceso?, ¿afecta al asistente?

## Decisión

- **Desactivar es ocultar, no borrar ni impedir.** La barra lateral, el dock, el centro «Más», el buscador ⌘K y la tecla
  **N** solo muestran lo de los módulos activos. Los datos siguen en la base y vuelven al reactivar el módulo.
- Cada sección declara su módulo (`SECTION_MODULE` en `shell/nav.ts`): Proyectos → `tasks`, Notas → `notes`, Finanzas →
  `finance`, Noticias → `news`, GitHub → `github`. Inicio, Asistente, Documentación y Ajustes no dependen de ninguno.
- Quien llega por un enlace a un módulo desactivado ve «X está desactivado», con «Activar» y un enlace a Módulos
  (`shell/ModuleOff.tsx`, en diferido). No se redirige: el enlace es suyo y puede activarlo ahí mismo.
- Los ajustes se leen **una vez, en el loader de `_app`** (`lib/muninn.ts`, donde ya se leía la apariencia) y se dejan en la
  caché de react-query (`keys.settings`) antes del primer pintado: el menú no parpadea. Mientras no se sepan (`null`), se
  enseña todo.
- Activar o desactivar cambia la caché al instante, escribe en el core de una en una y avisa con «Deshacer»
  ([ADR-0025](0025-escrituras-optimistas-y-deshacer.md)).
- El dock se reparte entre las pestañas que quedan (su geometría ya aceptaba otro número de pestañas).
- Los módulos con pantalla aún sin hacer (Finanzas, GitHub, Noticias) se pueden activar y enseñan su pantalla «Próximamente»;
  Concentración no se puede activar todavía. Por defecto, solo `tasks` y `notes` (el valor de la tabla).

## Alternativas consideradas

- **Impedirlo en el core o en la base** (RLS por módulo): sería seguridad que nadie pide, y complicaría el MCP y los agentes.
- **Redirigir a Inicio** al entrar en un módulo desactivado: esconde por qué no se ve y no deja activarlo.
- **Filtrar también las herramientas del MCP:** el MCP es de stdio, local, y no lee los ajustes del usuario; si hace falta,
  será parte del asistente de la fase 4.

## Consecuencias

- Un asistente conectado por MCP sigue viendo y editando todo, aunque el módulo esté oculto en la app.
- Inicio sigue siempre y, con `tasks` desactivado, es una pantalla casi vacía: lo asumimos hasta tener widgets configurables.
- Al cambiar de cuenta, la caché se vacía y se vuelve a sembrar con los ajustes de la cuenta nueva.
- Relacionado: [gotchas/web](../gotchas/web.md).
