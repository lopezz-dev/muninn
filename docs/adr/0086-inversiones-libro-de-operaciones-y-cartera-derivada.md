# ADR-0086: Inversiones: libro de operaciones con la cartera derivada, y la cuenta de inversión vale lo que vale su cartera

- **Estado:** Aceptado (10 de noviembre de 2026, al fusionar [#151](https://github.com/lopezz-dev/muninn/pull/151); aún sin código)
- **Fecha:** 2026-11-10
- **Área:** core, db, mcp, web
- **Reemplaza a:** la parte de [ADR-0037](0037-modelo-de-datos-de-finanzas.md) sobre lo que vale una cuenta de inversión («el
  valor de una inversión que sube o baja de mercado no se refleja sin apuntar algo»). Cuentas, categorías, movimientos y el saldo
  derivado siguen igual
- **Relacionado:** [ADR-0085](0085-divisas-tipos-del-bce-y-exposicion-por-instrumento.md), [ADR-0018](0018-dinero-en-centimos.md),
  [ADR-0039](0039-panel-mensual-y-tasa-de-ahorro.md), [ADR-0041](0041-asistente-local-con-catalogo-unico.md),
  [ADR-0062](0062-aal2-para-integraciones-sensibles.md)

## Contexto

En Finanzas una cuenta de tipo `investment` es una cuenta más: su saldo es el saldo inicial más los traspasos
([ADR-0037](0037-modelo-de-datos-de-finanzas.md)). Eso dice **cuánto has metido**, no cuánto vale. Para reflejar el mercado hay que
apuntar a mano un ingreso o un gasto, que además ensucia el panel mensual. Alex lleva dos cuentas en IBKR y quiere verlas en Muninn
como las ve en el bróker: posiciones, precio medio, valor y ganancia, por cuenta y juntas.

Lo que hay que decidir antes de las pantallas, porque cambiarlo después es migrar datos de dinero: qué se guarda (operaciones o una
foto de las posiciones), con qué precisión, qué pasa a enseñar una cuenta de inversión y de dónde salen los precios.

Restricciones: todo por `createMuninn`; `owner_id` + RLS + la política del segundo factor en cada tabla; nada se borra desde la
app ni el MCP; importes en enteros; sin secretos de terceros en esta fase; lo que hoy funciona sin Inversiones tiene que seguir
igual para quien no las use.

## Decisión

**La verdad son las operaciones; la cartera se deriva.** Igual que el saldo de una cuenta sale de sus movimientos, la posición, el
precio medio y la ganancia salen de las compras y las ventas. No se guarda ninguna posición.

**Tres tablas nuevas**, con `owner_id`, RLS, `require_mfa` y en Realtime:

| Tabla | Campos clave |
|---|---|
| `invest_instruments` | `symbol`, `name`, `isin` (opcional), `asset_class` (`etf` · `stock` · `fund` · `bond` · `crypto` · `other`), `currency` (cotización), `exchange` (opcional), `exposure` y su fecha (ADR-0085), `external_id` (el conid de IBKR), `archived_at` |
| `invest_trades` | `account_id` (una cuenta `investment`), `instrument_id`, `kind` (`buy` · `sell` · `opening`), `date`, `quantity` (millonésimas, > 0), `amount` (importe total sin comisión, en centésimas de la divisa del instrumento, > 0), `fee` (≥ 0), `fx_rate` (el tipo aplicado, si no cotiza en EUR), `note`, `external_id`, `archived_at` |
| `invest_prices` | `instrument_id`, `date`, `price` (cierre, en millonésimas), `source` (`manual` · `mcp` · `ibkr`); único por instrumento y día |

- **Se guarda el importe total, no el precio por unidad.** El precio medio es `importe ÷ cantidad` y se calcula: así no hay que
  redondear precios de siete decimales y el coste es exacto al céntimo.
- **`opening` es una posición que ya tenías** cuando empezaste a llevar la cuenta en Muninn: cantidad y coste total, sin comisión.
  Cuenta como una compra para la posición y el efectivo; se distingue para no hacerla pasar por una operación real (las listas la
  enseñan como «Posición inicial»).
- **`external_id` es único por cuenta**: quien sincronice (Claude hoy, IBKR mañana) puede repetir la carga sin duplicar.
- **Los precios son por usuario** (los escribe él o un agente en su nombre; ver ADR-0085 sobre tablas compartidas). Un precio nuevo
  del mismo día sustituye al anterior; no se archivan ni dejan actividad: son datos de mercado, no acciones del usuario.
- Un *trigger* comprueba que la cuenta es del dueño y de tipo `investment`, y que el instrumento es suyo. El core, además, no deja
  vender más de lo que hay ni cambiar de tipo una cuenta con operaciones.
- Instrumentos y operaciones se **archivan** y se restauran («Deshacer»), con su actividad ([ADR-0007](0007-registro-de-actividad.md)):
  `entity_type` `instrument` y `trade`.

**Cómo se calcula** (en el core, `m.invest.portfolio()`; enteros y `BigInt` como dice ADR-0085):
- **Posición** = compras + posiciones iniciales − ventas. **Coste medio**: una venta retira coste en proporción a lo vendido.
- **Valor** = cantidad × último precio hasta hoy, pasado a euros con el tipo del día (o el último). Sin ningún precio, vale su
  coste y se marca «sin precio». Siempre se dice de qué día es el precio.
- **Ganancia no realizada** = valor − coste, en euros y en porcentaje. **Peso** = valor ÷ valor de la cartera.
- Totales por cuenta, por clase de activo y por divisa (cotización y exposición).

**La cuenta de inversión vale lo que vale su cartera.**
- **Aportado** = el saldo derivado de siempre (saldo inicial + traspasos). No cambia ni de fórmula ni de nombre en los datos.
- **Efectivo** = aportado − lo pagado en compras y posiciones iniciales (con comisiones) + lo cobrado en ventas, en euros.
- **Valor** = efectivo + valor de las posiciones. **Ganancia** = valor − aportado.
- `m.finance.accounts.list()` conserva `balance` y añade `value`: en una cuenta `investment` **con operaciones**, el valor de arriba;
  en todas las demás, lo mismo que `balance`. La app, el MCP («¿cuánto tengo?») y el total de cuentas pasan a enseñar `value`, con lo
  aportado y la ganancia al lado en las de inversión.
- **Sin operaciones, nada cambia**: una cuenta de inversión sigue siendo su saldo.
- El **panel mensual no se toca** (ADR-0039): «Inversión» sigue siendo lo que traspasas ese mes. Que la cartera suba no es un ingreso.
- **Puesta en marcha**: se cargan las posiciones iniciales y el efectivo que dice el bróker, y la app propone el saldo inicial que
  hace que cuadre (aportado = coste + efectivo). Hace falta porque quien ya llevaba la cuenta puso como saldo inicial su valor de
  mercado de ese día.
- Una cuenta de Muninn por cuenta del bróker: el selector «Todas · cuenta» y los totales salen de ahí.

**De dónde salen los precios y las operaciones en esta fase: a mano o por el MCP.** Herramientas del catálogo único
([ADR-0041](0041-asistente-local-con-catalogo-unico.md)), sin borrados: `portfolio_summary`, `list_positions`, `list_trades`,
`record_trade`, `archive_trade`, `upsert_instrument`, `set_prices` (por lotes) y `fx_rate`. Entran en la unidad natural (euros,
participaciones) y el borde convierte, como en Finanzas. Con el conector de IBKR y el de Muninn a la vez, Claude lee posiciones y
precios del bróker y los escribe aquí: sin infraestructura ni secretos. **La sincronización sin nadie delante es otra decisión**
(Inversiones II): guardar una credencial del bróker es «conectar algo externo» y exige el segundo factor
([ADR-0062](0062-aal2-para-integraciones-sensibles.md)).

**Dónde vive:** dentro del módulo Finanzas, como una vista más (`/finance?view=investments`), no como módulo activable aparte
([ADR-0028](0028-modulos-activables-solo-en-la-interfaz.md)). Sin cuentas de inversión con operaciones, la vista enseña cómo empezar.

**Lo que Muninn no hace:** enviar órdenes, precios en tiempo real (solo cierres), margen, derivados ni recomendar qué comprar.

## Alternativas consideradas

- **Guardar una foto de las posiciones** (cantidad y precio medio, que se sobrescriben): menos trabajo al empezar, pero pierde cuándo
  y a qué tipo de cambio se compró, no puede dar la ganancia realizada ni la fiscalidad, y dos cargas a la vez se pisan. La
  «posición inicial» da el mismo arranque rápido sin renunciar al libro.
- **Un movimiento automático de «ajuste de valor»** en `finance_transactions` (lo que apuntaba el ROADMAP): cada cambio de precio
  crearía ingresos y gastos que no lo son, el panel mensual tendría que excluirlos y «Deshacer» dejaría de tener sentido.
- **Guardar el valor en la cuenta y actualizarlo al sincronizar:** es el saldo guardado que ADR-0037 descartó, con el mismo problema:
  se descuadra y no se sabe por qué.
- **Precio por unidad en cada operación:** obliga a elegir decimales y a redondear dos veces. El importe total es lo que de verdad
  salió de la cuenta.
- **`numeric` y una librería de decimales:** ver ADR-0085.
- **FIFO desde el principio:** es lo que pide Hacienda para la ganancia realizada, pero necesita lotes y el historial entero. Aquí
  solo se enseña la no realizada, donde el coste medio da la misma cifra que el bróker. Los lotes llegan con la ganancia realizada.
- **Un proveedor de precios (API con clave, o una no oficial):** límites, licencias y otra cuenta para dar el mismo cierre que ya
  tiene el bróker.
- **La API de IBKR para clientes (con sesión):** necesita una pasarela abierta y una sesión viva; no encaja en una Edge Function con
  cron. Los informes Flex, sí: se estudian en Inversiones II.
- **Precios compartidos entre usuarios:** un usuario podría escribir el precio que ven los demás.
- **Un módulo «Inversiones» aparte de Finanzas:** las aportaciones son traspasos de Finanzas y el valor entra en el total de
  cuentas; separarlo partiría en dos lo que es una sola cosa.
- **Derivar las posiciones en una vista SQL:** la conversión de divisa y el coste medio con ventas parciales son más claros y más
  fáciles de probar en el core, y a escala doméstica son unos cientos de filas.

## Consecuencias

- Positivas: la cuenta de inversión enseña lo que vale sin apuntar nada a mano; lo aportado y la ganancia se ven por separado; lo
  que ya hay en Finanzas no cambia para quien no use Inversiones; la sincronización futura solo tiene que escribir operaciones y
  precios.
- Negativas / costes:
  - El «¿cuánto tengo?» depende de precios que pueden estar viejos: hay que enseñar siempre de cuándo son.
  - Con ventas, la ganancia por posición sigue el coste medio y no los lotes (FIFO) de la declaración; la de la cuenta
    (valor − aportado) no depende del método.
  - Dividendos, comisiones sueltas y conversiones de divisa aún no tienen tipo de operación: se apuntan como movimientos de la
    cuenta hasta Inversiones II. En fondos de acumulación no se nota.
  - `balance` y `value` conviven: quien sume cuentas tiene que usar `value`. Va a [gotchas/core](../gotchas/core.md).
  - La lista de operaciones puede pasar de las 1000 filas de PostgREST: se pide por páginas, como los movimientos.
  - El conector de IBKR solo ve una cuenta: la otra se carga a mano hasta que haya sincronización propia.
- Relacionado: `packages/core/src/finance.ts`, `finance-report.ts`, `packages/assistant/src/tools/finance.ts`,
  `apps/web/src/screens/finanzas/`, [gotchas/db](../gotchas/db.md) (checklist de tabla nueva), nota «Inversiones: plan del submódulo»
  en el tablero de Muninn.
