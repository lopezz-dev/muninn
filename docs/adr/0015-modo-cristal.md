# ADR-0015: Modo cristal (blur) global, activable

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ui

## Contexto

Al revisar el diseño, el autor pidió una opción para activar o desactivar el desenfoque (blur) en toda
la app: con un solo interruptor, la interfaz pasa de sólida a translúcida y moderna.

## Decisión

- Un atributo en la raíz, `<html data-glass="on|off">`, controla el modo. Lo aplica
  `applyAppearance({ glass, accent })` de `@muninn/ui`.
- Con el cristal encendido, `tokens.css` sobrescribe solo lo necesario: superficies y bordes translúcidos
  (`rgba`), `--mn-backdrop: blur(18px) saturate(140%)` y un fondo con matices sutiles (`--mn-wallpaper`),
  porque sin algo detrás el desenfoque no se ve.
- Los componentes no saben si hay cristal: usan las utilidades `glass`, `glass-raised` y `glass-sidebar`,
  que aplican el fondo y el `backdrop-filter` de las variables (con el cristal apagado, `none`).
- Activado por defecto. Se guardará en `user_settings.preferences` y se respetará
  «Reducir transparencia» del sistema (`prefersReducedTransparency()`).

## Alternativas consideradas

- **Dos temas completos (sólido y cristal):** se duplican todos los tokens para cambiar 7 valores.
- **Clases condicionales en cada componente:** se reparte la lógica por toda la UI.
- **Vibrancy nativa de Tauri (Mica/Acrylic/NSVisualEffect):** queda como mejora futura solo para escritorio. El
  cristal en CSS funciona igual en la PWA.

## Consecuencias

- Un único interruptor cambia toda la app sin volver a renderizar componentes.
- `backdrop-filter` tiene coste de GPU. En Linux (WebKitGTK) puede ir peor: ver [gotchas/ui](../gotchas/ui.md).
