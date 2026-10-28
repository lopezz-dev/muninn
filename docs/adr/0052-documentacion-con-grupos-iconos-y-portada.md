# ADR-0052: Documentación con grupos e iconos en el front matter, portada y búsqueda por apartado

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** web, docs
- **Reemplaza a:** la parte de [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md) que limita los metadatos a
  cuatro claves y la que abre la primera guía al entrar en escritorio.

## Contexto

Con doce guías, el menú de Documentación era una lista numerada sin jerarquía. En escritorio, entrar llevaba
directo a la primera guía, y el texto se quedaba a la izquierda con un hueco grande a la derecha en monitores
anchos. Queremos agrupar las guías (Primeros pasos, Tu trabajo, Módulos…), darle a cada una su icono (como
el resto de la app y como huginnDB) y que el buscador lleve al apartado, no solo a la guía.

El grupo y el icono son datos de cada guía. Guardarlos en otro sitio separa la guía de lo que la describe y
obliga a tocar dos ficheros al añadir una.

## Decisión

- El *front matter* de `docs/user/NN-nombre.md` admite dos claves más, igual de planas:
  - `group`: `primeros-pasos`, `tu-trabajo`, `modulos`, `ia` o `cuenta`. La lista, su orden y sus nombres están
    en `DOC_GROUPS` (`apps/web/src/lib/docs.ts`). Un valor desconocido o ausente va a «Más guías», al final.
  - `icon`: el nombre de un icono de `icons` o `screenIcons` de `@muninn/ui`. Si no existe, se usa el libro.
  - Un test recorre las guías reales y falla si una no tiene grupo o su icono no existe.
- El menú ordena por grupo y, dentro, por `order`. Anterior/siguiente sigue ese mismo orden.
- `/documentacion` es una **portada** también en escritorio: buscador grande, «Empieza aquí» (el primer grupo)
  y el resto por grupos. El índice de la izquierda solo sale con una guía abierta.
- La guía se centra entre el índice y «En esta página», con el tope de lectura de [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md)
  (760 px). En móvil, «En esta página» es un desplegable.
- El buscador parte cada guía por sus títulos (con los mismos ids que pinta el renderizador) y cada resultado
  dice en qué apartado está y lleva a él. Se abre con `/` y se maneja con ↑ ↓ ↵ y Esc.
- Los avisos de las guías (`> **Estado:**`, `> **Próximamente:**`) llevan icono y tono propio. `Markdown`
  acepta una función en `callouts` que decide el aspecto según la etiqueta en negrita.

## Alternativas consideradas

- **Un mapa de grupos e iconos en el código:** no hay que tocar el analizador, pero el grupo de cada guía vive
  lejos de la guía y es fácil olvidarlo al añadir una.
- **Grupos por tramos de `order` (1–9, 10–19…):** obliga a renumerar ficheros al mover una guía de grupo.
- **Seguir abriendo la primera guía en escritorio:** sin portada no hay sitio para ver todas las guías ni sus
  estados de un vistazo.

## Consecuencias

- Positivas: menú con jerarquía, iconos coherentes con el resto de la app y búsqueda que aterriza en el sitio.
- Negativas / costes: seis claves de metadatos en vez de cuatro, aún sin YAML. Los iconos que solo usa esta
  pantalla (`compass`, `plug`, `shield`, `partial`) van en `screenIcons` y en `SCREEN_ICONS` de `vite.config.ts`.
- Relacionado: [ADR-0027](0027-documentacion-en-la-app-desde-docs-user.md), [ADR-0048](0048-pantallas-a-todo-el-ancho-y-alto.md),
  [gotchas/web](../gotchas/web.md#escribir-una-guía-de-docsuser-para-la-app).
