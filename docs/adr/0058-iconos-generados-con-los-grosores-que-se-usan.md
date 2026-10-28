# ADR-0058: Iconos generados con solo los grosores que se usan

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** ui
- **Complementa a:** ADR-0016 (sigue siendo Phosphor, con la misma API `icons` / `<Icon name>`)

## Contexto

`@phosphor-icons/react` 2.1 guarda los seis grosores de cada icono (`thin`, `light`, `regular`, `bold`, `fill`,
`duotone`) en un mismo módulo (`dist/defs/<Icono>.es.js`), en un `Map`. El bundler no puede quitar los grosores
que no se usan, y el paquete no publica un subpath por grosor. Con ~60 iconos en el arranque eso eran ~90 kB de
JS que nadie pinta. La app solo usa `regular` (por defecto), `bold` (pestaña activa, `notify`, checks) y `fill`
(nota fijada).

## Decisión

- `packages/ui/scripts/build-icons.ts` (`pnpm --filter @muninn/ui icons`) lee los nombres que importan `icons.tsx`
  y `screen-icons.tsx` y copia de Phosphor solo `regular` y `bold`, más los grosores extra que se piden por icono
  (`EXTRA_WEIGHTS`), a `src/icons.generated.ts` y `src/screen-icons.generated.ts`.
- Cada icono se monta con `IconBase` de Phosphor (`phosphor.tsx`): mismo SVG, mismas props, mismo `IconContext`.
  Un grosor no generado pinta el regular en vez de un SVG vacío.
- Los ficheros generados se versionan; un test comprueba que están al día con los catálogos.

## Alternativas consideradas

- **Importar por subpath (`@phosphor-icons/react/House`):** sigue trayendo los seis grosores.
- **`@phosphor-icons/react/ssr`:** mismo `Map` con los seis grosores, sin contexto.
- **SVG sueltos de `@phosphor-icons/core`:** otra dependencia y perder `IconContext`; el generador ya basta.
- **Otra librería de un solo grosor (Lucide):** ADR-0016 eligió Phosphor por el estilo; no se reabre.

## Consecuencias

- Positivas: el JS de arranque baja de 620,6 kB a 532,8 kB (189,1 → 172,2 kB gzip); los iconos de pantalla, de
  22,8 kB a 6,6 kB.
- Costes: añadir un icono es importarlo en el catálogo **y regenerar**; usar un grosor nuevo es añadirlo en el
  generador. Si se olvida, el test de sincronización falla (iconos) o se pinta el regular (grosor).
- Relacionado: ADR-0016, `docs/gotchas/ui.md` («Iconos: importar siempre desde `@muninn/ui`»).
