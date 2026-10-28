# ADR-0018: El dinero se maneja en céntimos enteros

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** ui, core, db

## Contexto

El módulo de finanzas (F3) suma gastos, ingresos, ahorro e inversión. En coma flotante, `0.1 + 0.2 !== 0.3`:
los totales acaban con céntimos fantasma. Al construir el campo de importe había que decidir el formato del valor.

## Decisión

- Todo importe viaja y se guarda como **entero en céntimos** (`2490` = 24,90 €): en la UI (`AmountField`,
  `parseAmount`, `formatAmount`), en el core y, cuando llegue, en la base de datos (`bigint`, nunca `numeric` con floats en JS).
- Los importes son siempre positivos. El signo lo da el tipo de movimiento (gasto, ingreso, ahorro, inversión).
- El formateo para mostrar es `es-ES` con agrupación de miles siempre (`1.284,30`), y el texto editable va sin miles (`1284,30`).

## Alternativas consideradas

- **Floats en euros:** errores de redondeo acumulados.
- **Strings decimales o una librería de decimales (big.js…):** más peso y más conversiones para no ganar nada a escala doméstica.

## Consecuencias

- Las sumas son exactas.
- Cualquier entrada o salida (CSV de Imagin, MCP, informes) convierte en el borde: `parseAmount` / `formatAmount`.
