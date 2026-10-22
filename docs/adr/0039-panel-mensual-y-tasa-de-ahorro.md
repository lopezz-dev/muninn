# ADR-0039: Panel mensual calculado en el core, con la tasa de ahorro como lo que no gastas

- **Estado:** Aceptado
- **Fecha:** 2026-10-22
- **Área:** core, ui

## Contexto

El panel mensual de Finanzas enseña entradas, salidas, ahorro, inversión y tasa de ahorro, por categoría y frente al mes
anterior. Hay que decidir dónde se calcula y qué es exactamente cada cifra, porque la UI, el MCP y el futuro Jarvis tienen
que decir lo mismo. El lienzo de diseño muestra «Tasa de ahorro 20 %» con 600 € de ahorro sobre 2.950 € de ingresos
(ahorro ÷ ingresos), una cifra de ejemplo.

## Decisión

- **Se calcula en el core:** `m.finance.report.month('AAAA-MM', { months })` devuelve los totales del mes, los del anterior,
  el gasto por categoría (con el del mes anterior y su parte del total) y el histórico de ingresos y gastos. La UI solo
  pinta; el MCP lo expone como `finance_month_report`. Una sola consulta de movimientos por informe.
- **Definiciones** (céntimos, movimientos sin archivar del mes, por su fecha):
  - **Ingresos** y **gastos**: por su tipo. Los traspasos no son ni lo uno ni lo otro.
  - **Ahorro** e **inversión**: neto de los traspasos que **cruzan** al grupo de cuentas `savings` o `investment`
    (de la corriente a la hucha suma; de la hucha a la corriente resta; entre dos huchas no cuenta). Ver
    [ADR-0037](0037-modelo-de-datos-de-finanzas.md).
  - **Libre**: ingresos − gastos − ahorro − inversión.
  - **Tasa de ahorro** = (ingresos − gastos) ÷ ingresos: la parte de lo que entra que **no se gasta**, la definición
    habitual en finanzas personales. Puede ser negativa (gastaste más de lo que entró) y es `null` sin ingresos.
- **Gráficos sin librería:** barras en CSS, siguiendo la skill `dataviz`. Ingresos y gastos usan dos tokens propios
  (`chart-income` azul, `chart-expense` naranja) validados en oscuro con su script: banda de luminosidad, croma y separación
  para daltonismo. El verde y el gris del lienzo no pasaban (el gris se lee como «sin color»).

## Alternativas consideradas

- **Tasa = ahorro ÷ ingresos** (la cifra del lienzo): ignora la inversión y el dinero que queda libre en la cuenta; un mes
  sin traspasos tendría tasa 0 aunque no hubieras gastado nada.
- **Tasa = (ahorro + inversión) ÷ ingresos:** depende de que hagas el traspaso dentro del mes; la definición elegida no.
- **Calcular en la UI:** el MCP y Jarvis darían otras cifras; y la regla de ahorro (cruzar de grupo) es fácil de duplicar mal.
- **Una librería de gráficos** (Recharts…): decenas de kB para dos gráficos de barras; la pantalla va en su chunk, pero no
  compensa.

## Consecuencias

- Si quieres ver «lo apartado», está en las tarjetas de Ahorro e Inversión; la tasa mide otra cosa y lo dice la guía.
- Cambiar una definición es cambiar `totalsOf` (`packages/core/src/finance-report.ts`, con tests) y esta página.
- Relacionado: [ADR-0018](0018-dinero-en-centimos.md), [gotchas/ui](../gotchas/ui.md).
