# ADR-0037: Finanzas: cuentas, categorías y movimientos, con el saldo derivado

- **Estado:** Aceptado
- **Fecha:** 2026-10-21
- **Área:** core, db

## Contexto

La F3 empieza por Finanzas: apuntar gastos e ingresos, ver cuánto hay en cada cuenta y, después, suscripciones y un panel
mensual. El diseño («Muninn — Pantallas», Finanzas y Movimientos) usa cuatro tipos en el alta (Gasto, Ingreso, Ahorro,
Inversión) y tres cuentas de ejemplo (corriente, hucha y fondo indexado). [ADR-0018](0018-dinero-en-centimos.md) ya fijó
que los importes son céntimos enteros y siempre positivos, con el signo dado por el tipo. Hay que decidir el modelo antes
de las pantallas, porque cambiarlo después obliga a migrar datos de dinero, que es lo último que se quiere tocar a mano.

Restricciones: una sola divisa (EUR) por ahora, sin importación bancaria (v2), multiusuario desde el día uno
([ADR-0004](0004-multiusuario-con-rls.md)), todo por `createMuninn` ([ADR-0002](0002-api-de-dominio-unica.md)), sin
borrados definitivos desde la UI ni el MCP ([ADR-0009](0009-mcp-stdio-sin-borrados.md),
[ADR-0019](0019-feedback-con-notificaciones.md)).

## Decisión

**Tres tablas nuevas**, todas con `owner_id` + RLS y en la publicación de Realtime:

| Tabla | Campos clave |
|---|---|
| `finance_accounts` | `name`, `kind` (`checking` corriente · `savings` ahorro · `investment` inversión · `cash` efectivo · `other`), `color`, `initial_balance` (céntimos, **puede ser negativo**: una cuenta que empieza en descubierto), `goal` (objetivo opcional de una hucha), `currency` (`'EUR'`, con `check`), `position`, `archived_at` |
| `finance_categories` | `name`, `kind` (`expense` · `income`), `color` (paleta de proyectos), `key` (las de serie: `housing`, `groceries`…; `null` en las propias), `position`, `archived_at` |
| `finance_transactions` | `kind` (`expense` · `income` · `transfer`), `amount` (`bigint` > 0), `date` (fecha local `AAAA-MM-DD`), `account_id`, `to_account_id` (solo en traspasos), `category_id` (solo en gastos e ingresos, opcional), `concept`, `note`, `archived_at` |

**Movimientos.** Tres tipos y nada más:
- **Gasto** resta de su cuenta; **ingreso** suma. Su categoría, si la tiene, es del mismo tipo (un gasto no lleva «Nómina»).
- **Traspaso** resta de `account_id` y suma a `to_account_id` (distintas). No lleva categoría.
- «Ahorro» e «Inversión» del diseño **no son tipos**: son traspasos a una cuenta de tipo `savings` o `investment`. La UI los
  ofrece como atajos del alta (eligen el destino de ese tipo). Así un mismo movimiento no puede contarse dos veces y
  sacar dinero de la hucha es otro traspaso, en sentido contrario.

**El saldo se deriva, no se guarda:** `saldo = initial_balance + ingresos − gastos − traspasos que salen + traspasos que
entran`, con los movimientos no archivados de **cualquier fecha** (también los de fecha futura: si apuntas el alquiler del
día 1 por adelantado, el saldo ya lo descuenta). En Supabase lo suma la vista `finance_account_totals`
(`security_invoker`, así RLS manda), una fila por cuenta; el store de memoria lo calcula recorriendo los movimientos. El
core expone `m.finance.accounts.list()` con el saldo de cada cuenta ya calculado.

**Categorías de serie.** La primera vez que se piden las categorías y el usuario no tiene ninguna (ni archivada), el core
crea las de serie con su `key`: Vivienda, Supermercado, Suscripciones, Transporte, Restaurantes, Ocio, Salud, Otros
(gastos) y Nómina, Facturas, Otros ingresos (ingresos). Son filas normales: se renombran, recolorean y archivan como las
propias. Un índice único `(owner_id, key)` impide duplicarlas si dos dispositivos las siembran a la vez; el core ignora ese
choque y vuelve a leer.

**Archivar, nunca borrar.** Cuentas, categorías y movimientos se archivan (`archived_at`) y se restauran («Deshacer»). Un
movimiento archivado no cuenta para el saldo ni para los informes. Una cuenta archivada desaparece de las listas, pero sus
movimientos siguen contando para la otra cuenta de un traspaso. Una categoría archivada sigue nombrando sus movimientos y
deja de ofrecerse en el alta. Las claves ajenas entre estas tablas no borran en cascada (`no action`): no se puede borrar
por debajo una cuenta con movimientos, y borrar el usuario sí lo limpia todo (se comprueba al final de la sentencia).

**Una divisa.** `currency` existe solo como `'EUR'` (con `check`) para que el multidivisa sea una migración aditiva el día
que haga falta; el core no la acepta como entrada.

**Bordes.** El core trabaja en céntimos. Para el MCP (los modelos se equivocan multiplicando por cien) hay
`centsFromEuros('24,90' | 24.9)` y `formatEuros(cents)` en el core; las herramientas aceptan euros y devuelven
céntimos **y** el texto formateado.

**Actividad** ([ADR-0007](0007-registro-de-actividad.md)): `entity_type` `account`, `category` y `transaction`, con
`created`, `updated`, `archived` y `restored`, y en el `payload` el importe en céntimos y el concepto. Sin `project_id`.

## Alternativas consideradas

- **Saldo guardado en la cuenta y actualizado en cada movimiento:** rápido de leer, pero cualquier fallo a medias (o dos
  dispositivos a la vez) lo descuadra para siempre y obliga a una «reconciliación». Derivarlo es exacto por construcción y,
  a escala doméstica, barato con la vista.
- **Ahorro e inversión como tipos de movimiento** (lo que sugiere el selector del diseño): no dice de qué cuenta a qué
  cuenta va el dinero, así que el saldo de la hucha no se podría derivar, y retirar ahorro no tendría representación.
- **Importes con signo:** contradice ADR-0018 y hace que un mismo dato (un gasto) se pueda guardar de dos formas.
- **Un movimiento por pata (asiento doble):** correcto contablemente, pero un traspaso serían dos filas que hay que
  mantener a la vez (editar, archivar, deshacer). Una fila con `to_account_id` da lo mismo para un uso doméstico.
- **Categorías de serie como constantes en el código** (sin fila): no se podrían renombrar ni archivar, y las propias
  irían por otro camino.
- **Agregados de PostgREST** (`amount.sum()`) en lugar de la vista: vienen desactivados en Supabase (`db_aggregates_enabled`)
  y activarlo es un ajuste del proyecto.

## Consecuencias

- Positivas: el saldo nunca se descuadra; «Deshacer» es archivar o restaurar una fila; el panel mensual (bloque D) y las
  suscripciones (bloque C) leen los mismos movimientos.
- Negativas: el valor de una inversión que sube o baja de mercado no se refleja sin apuntar algo. Hoy, un ingreso o gasto
  en esa cuenta; un tipo «ajuste de valor» queda pendiente (ROADMAP). La lista de movimientos sin filtro de mes puede pasar
  de las 1000 filas que devuelve PostgREST de una vez: el store de Supabase la pide por páginas
  ([gotchas/db](../gotchas/db.md)).
- `bigint` llega a JavaScript como `number`: exacto hasta 2^53 céntimos (90 billones de euros), muy por encima del máximo
  de `AmountField` (999.999.999,99 €).
- Relacionado: `packages/core/src/finance.ts`, `supabase/migrations/20261021120000_finance.sql`,
  [gotchas/core](../gotchas/core.md), [gotchas/db](../gotchas/db.md).
