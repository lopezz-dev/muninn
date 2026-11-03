# ADR-0074: Cada suscripción push va atada a su sesión de Auth y se borra en cascada al cerrarla

- **Estado:** Aceptado
- **Fecha:** 2026-10-31
- **Área:** db, core, web
- **Complementa a:** [ADR-0040](0040-pwa-instalable-y-web-push.md), [ADR-0061](0061-seguridad-de-la-cuenta.md)

## Contexto

[ADR-0061](0061-seguridad-de-la-cuenta.md) dejó apuntado que cerrar la sesión en otros dispositivos («Cerrar» en una fila, «En los demás»,
«En todos») no quita sus avisos push: las filas de `push_subscriptions` de esos dispositivos siguen y el cron les manda los avisos de
cobro de la cuenta con la sesión ya cerrada. Solo el dispositivo que cierra su propia sesión borra su fila (`leaveThisDevice`).

- Los cierres no pasan todos por Muninn: «En los demás» y «En todos» son `signOut({ scope })` de supabase-js, quitar el acceso a una app es
  `revokeGrant`, y Auth borra sesiones por su cuenta (caducidad, *time-box*). Desde el cliente no se sabe qué sesiones se cerraron.
- `auth.sessions.id` es estable durante toda la sesión (las renovaciones del token no lo cambian) y viaja en el claim `session_id` del JWT.
- El proyecto ya depende de `auth.sessions` desde `public`: `list_my_sessions()` la lee y el trigger `oauth_mfa_grants_bind` se dispara en
  ella ([ADR-0066](0066-aprobacion-oauth-atada-a-una-sesion.md)).

## Decisión

- **`push_subscriptions.session_id uuid references auth.sessions (id) on delete cascade`** (migración `20261031120000_push_por_sesion`).
  Cuando Auth borra una sesión, sea por la causa que sea, Postgres borra en la misma transacción los avisos que se activaron con ella.
- **La sesión la pone el servidor**: un trigger `before insert or update` copia el `session_id` del JWT de quien escribe. El cliente y el
  core no la mandan (`PushDeviceStore.upsert` no la acepta). Con la service role (sin sesión) no se toca. Si la sesión del token ya está
  cerrada (su token de acceso vale hasta una hora más), el trigger rechaza la escritura: ese dispositivo está saliendo.
- Cada vez que el dispositivo vuelve a guardar su suscripción (al activarla, o al abrir Ajustes › Notificaciones si sigue en la lista),
  la fila pasa a la sesión de ese momento.
- Las filas guardadas antes de la migración quedan con `session_id` `null` y no se tocan: se van como hasta ahora (al cerrar sesión en
  ese dispositivo, al quitarlas en la lista o con un 404/410).
- En memoria (demo y tests), cerrar sesiones llama a un `onClosed` que quita los dispositivos de esas sesiones, igual que la cascada.
- La interfaz lo dice al cerrar: «Saldrá en menos de una hora y ya no le llegan tus avisos». No hay «Deshacer», como en el resto del cierre
  de sesiones.

## Alternativas consideradas

- **Al pulsar «En los demás», borrar todas las suscripciones menos la de este dispositivo:** sin esquema nuevo, pero no cubre «Cerrar» en
  una fila (no se sabe qué fila es de qué sesión), ni quitar el acceso a una app, ni las sesiones que caducan. Y borra también la de un
  dispositivo que vuelva a entrar al momento.
- **Una función de limpieza (cliente tras cerrar, o el cron antes de enviar) que borre las filas sin sesión viva:** funciona, pero son dos
  sitios que mantener y un hueco entre el cierre y la limpieza. La cascada lo hace en la misma transacción y sin código.
- **Trigger `after delete` en `auth.sessions`:** lo mismo que la cascada con más código propio en un esquema que gestiona Supabase.

## Consecuencias

- Cerrar una sesión, por cualquier camino, deja a ese dispositivo sin avisos al momento, aunque siga dentro hasta una hora.
- Depende de que `auth.sessions.id` siga siendo la clave de la tabla de Supabase. Si una actualización de Auth la cambiara, la migración
  de Supabase fallaría por la dependencia en lugar de romper los avisos sin decir nada.
- Un dispositivo que vuelve a entrar no recupera los avisos solo: hay que activarlos otra vez en Ajustes › Notificaciones (el navegador
  reutiliza su suscripción). La guía lo dice.
- La migración es un paso manual de la fase final, justo después de la de push (paso 4b).
- Relacionado: `supabase/migrations/20261031120000_push_por_sesion.sql`, `packages/core/src/memory-account.ts`, `memory-store.ts`,
  `supabase-store.ts` (`pushDevices`), `apps/web/src/screens/ajustes/Seguridad.tsx`, [gotchas/db](../gotchas/db.md).
