# ADR-0038: Las suscripciones avisan antes del cobro y el movimiento lo confirma el usuario

- **Estado:** Aceptado
- **Fecha:** 2026-10-21
- **Área:** core, db, web

## Contexto

La F3 pide suscripciones recurrentes (Spotify, Claude, un dominio anual…) con aviso antes del cobro. Hay que decidir qué datos
tiene una suscripción y, sobre todo, qué pasa al llegar la fecha: ¿Muninn apunta el gasto solo o se limita a avisar? Muninn
no está conectado al banco (v2): no sabe si el cobro se hizo, si cambió el precio o si cancelaste la suscripción la semana
pasada. Y apuntar solo necesitaría un proceso en el servidor (cron + Edge Function) que hoy no está desplegado.

## Decisión

**Datos** (`finance_subscriptions`, aditiva, con `owner_id` + RLS y en Realtime): `name`, `amount` (céntimos, > 0),
`frequency` (`weekly` · `monthly` · `yearly`), `account_id`, `category_id` (de gastos, opcional), `anchor_date` (el día que
marca el ciclo), `next_date` (el próximo cobro), `remind_days` (cuántos días antes avisar; 3 por defecto) y `archived_at`.
Los movimientos ganan `subscription_id`, para saber qué cobro viene de qué suscripción.

**Al llegar la fecha, Muninn solo avisa; el movimiento lo apunta el usuario con un toque.** Es lo más conservador y reversible:
- Nada escribe dinero sin que tú lo veas: un gasto fantasma (cancelaste, cambió el precio) descuadraría el saldo sin avisar.
- **«Apuntar cobro»** crea el gasto (con el importe y la cuenta de la suscripción, y la fecha del cobro) y adelanta `next_date`
  un periodo. **«Saltar»** solo adelanta la fecha (ese mes no se cobró). Los dos tienen «Deshacer».
- El adelanto respeta el día del ciclo: una suscripción del 31 cobra el 30 de abril y vuelve al 31 en mayo (se calcula
  desde `anchor_date`, no desde la fecha anterior).
- Un mismo cobro no se apunta dos veces: el core exige la fecha esperada y la base tiene un índice único
  `(subscription_id, date)` entre los movimientos sin archivar (dos dispositivos a la vez).

**Aviso dentro de la app:** Inicio enseña «Próximos cobros» (las suscripciones que vencen en sus `remind_days` o ya vencidas,
con «Apuntar» y «Saltar») si el módulo Finanzas está activo; Finanzas › Resumen enseña todas con el gasto mensual
equivalente. El aviso push queda para la PWA instalable (bloque E de la F3, en el [ROADMAP](../ROADMAP.md)).

**Gasto mensual equivalente:** mensual = importe; anual = importe / 12; semanal = importe × 52 / 12, redondeado al céntimo.

## Alternativas consideradas

- **Apuntar el gasto solo al llegar la fecha** (en el cliente al abrir la app, o con un cron): cómodo, pero apunta cobros que
  quizá no ocurrieron, y en el cliente se apuntaría al abrir la app en el primer dispositivo, con riesgo de duplicados.
  Se puede ofrecer más adelante como opción por suscripción («apuntar solo»), con un cron en el servidor.
- **Recurrencia genérica (RRULE)**: sobra para tres frecuencias y complica el cálculo y la UI.
- **Guardar solo la próxima fecha** (sin `anchor_date`): un día 31 se iría corriendo al 30, al 28…

## Consecuencias

- Si no abres Muninn, los cobros vencidos se acumulan como «vencidos» hasta que los apuntes o los saltes: es visible, no se pierde.
- El MCP puede listar suscripciones, crearlas y apuntar o saltar un cobro; tampoco las borra.
- Relacionado: [ADR-0037](0037-modelo-de-datos-de-finanzas.md), `packages/core/src/subscriptions.ts`,
  `supabase/migrations/20261021140000_finance_subscriptions.sql`.
