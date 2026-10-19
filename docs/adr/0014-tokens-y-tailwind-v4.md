# ADR-0014: Tokens en TypeScript → variables CSS, con Tailwind v4 como capa de utilidades

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ui, web

## Contexto

El diseño de todas las pantallas está aprobado (lienzo «Muninn — Pantallas», página Fundamentos).
Hay que llevar sus decisiones (colores, tipografía, radios, sombras, movimiento) a código de forma
que la UI no pueda desviarse sin querer y que algunos valores (acento, cristal) cambien en tiempo de ejecución.

## Decisión

- **Fuente única de verdad:** `packages/ui/src/tokens.ts`. De ahí se genera `tokens.css` con variables
  `--mn-*` (`pnpm --filter @muninn/ui tokens`). Un test falla si el CSS no está sincronizado.
- **Tailwind v4** como capa de utilidades: `theme.css` mapea las variables a clases (`bg-surface`,
  `text-fg-muted`, `rounded-lg`, `bg-project-blue`, `bg-kind-done`…) con `@theme inline`, de modo que un
  cambio de variable en ejecución (acento, cristal) repinta sin recompilar.
- **Paleta por defecto de Tailwind desactivada** (`--color-*: initial`, también fuentes, radios, sombras y
  tamaños de texto). Solo existen los tokens de Muninn: `bg-red-500` no genera nada.
- **Radios con la semántica del diseño:** `rounded-sm` 4 px (controles), `rounded-md` 5 px (botones),
  `rounded-lg` 6 px (tarjetas), `rounded-xl` 8 px (diálogos), `rounded-dock` 12 px.
- **Accesibilidad como test:** todos los tokens de texto deben dar ≥ 4,5:1 sobre fondo, superficie y
  superficie elevada. El test obligó a subir `fg-faint` de `#7E858F` a `#818892`.

## Alternativas consideradas

- **CSS puro o CSS Modules:** sin restricción de paleta y más CSS a mano por pantalla.
- **Tokens en JSON + Style Dictionary:** otra herramienta más para un único consumidor.
- **Tailwind v3 con `tailwind.config.js`:** la v4 configura el tema en CSS y compila más rápido.

## Consecuencias

- Las pantallas se construyen con clases de Tailwind que solo pueden usar valores del diseño.
- Cambiar un color es editar `tokens.ts`, regenerar y pasar los tests.
- La app tiene que declarar `@source` hacia `packages/ui/src`: ver [gotchas/ui](../gotchas/ui.md).
