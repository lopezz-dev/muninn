# ADR-0027: La sección Documentación se genera con `docs/user/*.md` importados al compilar

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** web, docs

## Contexto

Las guías de usuario ya se escriben en `docs/user/` ([ADR-0013](0013-sistema-de-documentacion.md)) pensando en que la app
las muestre. Hace falta que la sección **Documentación** las enseñe con menú, buscador y marca de estado sin duplicar el
texto en otro sitio, y que siempre coincidan con la versión de la app (se actualizan «en el mismo PR»).

## Decisión

- `screens/docs/content.ts` importa los ficheros `docs/user/NN-nombre.md` en **tiempo de compilación**
  (`import.meta.glob(..., { query: '?raw', eager: true })`). Viajan en el chunk de la pantalla: sin peticiones, funcionan sin
  conexión y no tocan el JS inicial ([ADR-0020](0020-tanstack-router-carga-diferida.md)). `README.md` no entra.
- El menú sale del *front matter* (`title`, `description`, `order`, `status`), leído con un analizador propio de ~15 líneas
  (`lib/docs.ts`, con tests): sin dependencia de YAML. `status` pinta «Parcial» o «Próximamente».
- El texto se pinta con el renderizador de Markdown de [ADR-0026](0026-markdown-marked-a-react-y-textarea.md), con tres
  extras que solo usa esta pantalla: ids en los títulos (y el índice «En esta página»), avisos destacados (una cita que
  empieza en negrita, como `> **Estado:** …`) y enlaces entre guías (`05-notas.md#archivar`).
- Rutas `/documentacion` (lista y buscador) y su hija `/documentacion/$pagina` (la guía), con el mismo patrón que Notas y el
  detalle de tarea ([ADR-0024](0024-detalle-de-tarea-como-ruta.md)). El slug es el nombre del fichero sin número.
- El buscador filtra en el navegador por título, descripción y texto, sin tildes ni mayúsculas.

## Alternativas consideradas

- **Leer los `.md` por red en ejecución:** exigiría servirlos desde `public/` (duplicados) y no funcionaría sin conexión.
- **MDX o un plugin de Markdown de Vite:** más herramientas para algo que ya resuelve el renderizador de las notas.
- **Un analizador de YAML:** unos 6 kB más para cuatro claves planas.

## Consecuencias

- Cambiar una guía exige recompilar la app; en desarrollo, Vite lo hace solo.
- Las guías no pueden usar HTML ni imágenes (ver ADR-0026) ni más metadatos que las cuatro claves planas.
- Un enlace a otro fichero que no sea `NN-nombre.md` no se convierte en enlace (se ve como texto).
- «¿Te ha servido?» y «Preguntar al asistente» del diseño quedan fuera hasta que haya dónde guardar la respuesta (F4).
- Relacionado: [gotchas/web](../gotchas/web.md).
