# ADR-0085: Divisas: tipos de cambio diarios del BCE en una tabla compartida, y dos divisas por instrumento (cotización y exposición)

- **Estado:** Aceptado (10 de noviembre de 2026, al fusionar [#151](https://github.com/lopezz-dev/muninn/pull/151); aún sin código)
- **Fecha:** 2026-11-10
- **Área:** core, db, mcp
- **Relacionado:** [ADR-0086](0086-inversiones-libro-de-operaciones-y-cartera-derivada.md), [ADR-0018](0018-dinero-en-centimos.md),
  [ADR-0037](0037-modelo-de-datos-de-finanzas.md), [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md)

## Contexto

Alex quiere un submódulo de Inversiones dentro de Finanzas con **control de divisas**: cuando la cartera baja, saber cuánto es del
mercado y cuánto del cambio. Hoy Finanzas tiene una sola divisa: `finance_accounts.currency` solo admite `'EUR'`
([ADR-0037](0037-modelo-de-datos-de-finanzas.md)) y el core no sabe nada de tipos de cambio.

Lo que condiciona el diseño salió al mirar la cartera real (10 de noviembre, con el conector de IBKR): cuatro ETF de acumulación
(SXR8, SXRV, VWCE y EMIM) que **cotizan en EUR**. No hay ni una posición en dólares y, aun así, la mayor parte de la cartera se mueve
con el dólar, porque lo que esos fondos llevan dentro está en USD y no van cubiertos. Un multidivisa que solo mire la divisa en la
que cotiza cada posición diría que el riesgo de cambio es cero.

Restricciones: importes en enteros ([ADR-0018](0018-dinero-en-centimos.md)), todo por `createMuninn`, nada de claves de terceros que
caduquen o cobren, que funcione con el ordenador apagado, y la regla del proyecto «toda tabla con `owner_id` + RLS».

## Decisión

**Alcance: el multidivisa entra solo en Inversiones.** Las cuentas siguen en EUR (el `check` de `finance_accounts.currency` no se
toca) y el panel mensual ([ADR-0039](0039-panel-mensual-y-tasa-de-ahorro.md)) no cambia. La divisa base de Muninn es el euro. Cuentas
del día a día en otra divisa: otro ADR, cuando llegue.

**Tipos de cambio: tabla `fx_rates`, compartida.**

| Campo | Qué es |
|---|---|
| `currency` | ISO 4217 en mayúsculas (`USD`, `GBP`…). Nunca `EUR` |
| `date` | Día del tipo (fecha del BCE) |
| `rate` | **Unidades de la divisa por 1 EUR**, como lo publica el BCE (1 EUR = 1,0876 USD), en **millonésimas** (`bigint` > 0) |
| `source` | `'ecb'` |

Clave primaria `(currency, date)`. Es un **dato de referencia, igual para todos**: **no lleva `owner_id`**. Es una excepción
consciente a la regla del proyecto, con estas condiciones: RLS activado, una sola política `select` para `authenticated`
(`using (true)`), ninguna de escritura (solo escribe la service role, desde la función), sin la política `require_mfa` (no es un dato
del usuario) y fuera de Realtime (cambia una vez al día). Nada que escriba un usuario va nunca a una tabla compartida.

**Quién los trae: la Edge Function `fx`**, con el esquema de `news` ([ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md)):
`POST /fx/fetch` con el secreto del cron, `pg_cron` de lunes a viernes por la tarde (el BCE publica hacia las 16:00, hora de
Fráncfort) y un segundo pase más tarde. Lee los tipos de referencia del euro del BCE (el fichero diario, y el histórico en la
primera carga, desde 2015) y hace `upsert`: repetirlo no cambia nada. La dirección es fija, así que no hay nada que escriba el
usuario que la función descargue.

**En el core, `m.fx`** (solo lectura): `rate({ currency, date? })` devuelve el tipo de ese día o **el último anterior** (fines de
semana y festivos) con su fecha; `series({ currency, from, to })` para las gráficas; `convert(importe, de, a, fecha)`. Los stores de
memoria y de fichero llevan unos tipos fijos para la demo y los tests. En el MCP y el asistente, una herramienta de lectura, `fx_rate`.

**Enteros también aquí** (amplía ADR-0018):
- Importes en **centésimas de su divisa**, también en las que no usan decimales (el yen se guarda ×100, por uniformidad).
- Tipos de cambio, cantidades y precios en **millonésimas**.
- Los productos (cantidad × precio, importe ÷ tipo) se hacen con `BigInt` y se redondea **una vez**, al céntimo, por posición: dos
  enteros en millonésimas multiplicados se salen de 2^53 con cien participaciones de 700 €.

**Dos divisas por instrumento.**
- **Cotización** (`currency`): la divisa en la que se compra y se valora. Sirve para convertir a euros.
- **Exposición** (`exposure`): el reparto por divisa de lo que el instrumento lleva dentro, en **tanto por diez mil** (enteros):
  `{ "USD": 10000 }` para un fondo del S&P 500, `{ "USD": 6300, "JPY": 600, … }` para uno mundial. Puede sumar menos de 10 000: el
  resto es «otras» y no se sigue. Sin reparto, cuenta entera en su divisa de cotización. Lo rellena quien da de alta el instrumento
  (o Claude, con la ficha del fondo) y se puede corregir; no se actualiza solo.

**El efecto divisa sale de la exposición**, no de la cotización, así no se cuenta dos veces. Para un periodo, por posición:

`efecto divisa ≈ valor al inicio × Σ peso de cada divisa × (tipo al inicio ÷ tipo al final − 1)`

y `efecto mercado = variación del valor − efecto divisa − lo comprado o vendido en el periodo`. El euro y «otras» no aportan. Una
posición abierta a mitad del periodo cuenta desde su fecha. Es una **estimación de primer orden** y la pantalla lo dice: los pesos
son una foto, y un fondo no se mueve exactamente con su divisa. El simulador («si el dólar baja un 5 %…») usa los mismos pesos.

## Alternativas consideradas

- **Multidivisa en todas las cuentas ya:** obliga a decidir en qué divisa suma el panel mensual, cómo se traspasa entre divisas y
  qué enseña el total de cuentas. Es otro problema, y no es el que ha pedido Alex.
- **Solo la divisa de cotización:** lo habitual en un bróker, pero con una cartera de ETF europeos da siempre cero. No responde a la
  pregunta.
- **`fx_rates` con `owner_id`, una copia por usuario:** cumple la regla al pie de la letra a costa de duplicar el mismo dato por
  cada usuario y de que la función escriba en nombre de todos. No protege nada: los tipos del BCE son públicos.
- **Un servicio de tipos de cambio con clave (o gratuito de un tercero):** otra cuenta, límites y un tercero que puede cerrar. El
  BCE publica lo mismo, gratis y sin clave, que es además lo que usa cualquier referencia en euros.
- **Tipos intradía:** no hay fuente gratuita fiable, y Muninn enseña cierres diarios (ADR-0086).
- **Pedir los tipos desde el navegador al abrir la pantalla:** sin histórico guardado no hay efecto divisa de un periodo, y depende
  del CORS de un tercero.
- **`numeric` en Postgres y una librería de decimales en el core:** contradice ADR-0018 y mete una dependencia para algo que se
  resuelve con enteros y `BigInt`.
- **Exposición calculada sola a partir de la composición del fondo:** no hay fuente abierta y estable de las tripas de cada ETF.
  Unos pesos a mano, visibles y corregibles, son honestos sobre lo que son.

## Consecuencias

- Positivas: la pregunta de Alex tiene respuesta aunque todo cotice en euros; los tipos llegan solos y gratis; el resto de Finanzas
  no se toca.
- Negativas / costes:
  - Hay una tabla sin `owner_id`. Quien copie el patrón para datos del usuario rompe el aislamiento: va en el checklist de
    [gotchas/db](../gotchas/db.md) como excepción con nombre.
  - El BCE no publica todas las divisas (falta, por ejemplo, el dólar de Taiwán, que pesa en los fondos de emergentes). Esa parte de
    la exposición queda sin efecto calculado y la pantalla dice cuánto es.
  - Los pesos de exposición envejecen. Se enseña la fecha en que se pusieron.
  - Una función y un cron más que desplegar (pasos manuales en gotchas/db, cuando exista).
  - `rate` va «por 1 EUR»: para pasar a euros se **divide**. Es la trampa clásica; el core lo esconde en `convert`.
- Relacionado: [ADR-0086](0086-inversiones-libro-de-operaciones-y-cartera-derivada.md) (instrumentos, operaciones y valoración),
  `packages/core/src/finance.ts`, `supabase/functions/news` (el esquema que copia `fx`), nota «Inversiones: plan del submódulo» en
  el tablero de Muninn.
