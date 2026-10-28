# ADR-0061: Seguridad de la cuenta en Ajustes › Cuenta, a través del core

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** core, db, web
- **Complementa a:** [ADR-0022](0022-auth-y-sesion.md)

## Contexto

[ADR-0022](0022-auth-y-sesion.md) dejó para más adelante la gestión de sesiones («Acceso y seguridad» del ROADMAP). Hace falta ver dónde
está abierta la sesión de la cuenta y cerrarla en uno o en todos los dispositivos. Restricciones:

- El cliente **no puede leer `auth.sessions`**: el esquema `auth` no está expuesto en PostgREST ni tiene RLS.
- supabase-js solo sabe cerrar la sesión en este dispositivo, en los demás (`scope: 'others'`) o en todos (`'global'`); no cierra una
  concreta ni lista las que hay.
- CLAUDE.md: todo acceso a Supabase pasa por el store y el core; la demo y los tests deben poder usarlo sin red.
- Ni la lista de sesiones (con su IP) ni nada de seguridad debe acabar en la caché sin conexión ([ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md)).

## Decisión

- **Un módulo `account` en el core** (`packages/core/src/account.ts`, `m.account`), sobre un `AccountStore` opcional en el `Store`. El de
  Supabase habla con Auth y con las funciones de abajo; el de memoria (`memory-account.ts`) lo simula para la demo y los tests; el fichero
  local del MCP no lo tiene y `m.account.available()` es `false`. Aunque sea autenticación y no datos, va por el core para que la UI no
  importe Supabase. El login y la pantalla de consentimiento OAuth siguen en `lib/` de la web ([ADR-0022](0022-auth-y-sesion.md),
  [ADR-0036](0036-pantalla-de-autorizacion-oauth.md)), porque ocurren antes de que exista el core.
- **Sesiones** con dos funciones `security definer` (migración `20261029120000_account_sessions`): `list_my_sessions()` devuelve las
  sesiones vigentes de `auth.uid()` (id, fechas, *user agent*, IP, nivel de seguridad y si es la del JWT que pregunta) y
  `revoke_my_session(uuid)` borra una del mismo usuario. Ninguna devuelve tokens; `execute` solo para `authenticated`.
- La lista enseña el dispositivo en palabras («Mac · Chrome», `sessionDeviceLabel`), la última actividad y cuándo entraste, con la de
  este dispositivo primero y marcada. **«Cerrar»** en las demás; la de este no se cierra desde la lista (para eso está «Cerrar sesión»,
  que además limpia lo guardado aquí). Al pie, **«En los demás»** (`signOut({ scope: 'others' })`) y **«En todos»** (`'global'`, que
  limpia este dispositivo igual que «Cerrar sesión» y lleva a la entrada).
- **Sin «Deshacer»**: una sesión cerrada solo se recupera volviendo a entrar en ese dispositivo. En su lugar, el aviso dice qué pasa
  («Saldrá en menos de una hora»), como pide [ADR-0019](0019-feedback-con-notificaciones.md) para lo que no cambia datos.
- Las consultas de seguridad usan claves `['account', …]` y **no se guardan sin conexión** (`shouldPersist`).

## Alternativas consideradas

- **Llamar a Auth desde la web, como el login:** más corto, pero rompe la regla de que la UI no habla con Supabase y deja la demo y los
  tests sin nada que probar.
- **Una Edge Function con la service role** para listar y cerrar sesiones: otra pieza que desplegar para dos consultas que una función
  `security definer` limitada a `auth.uid()` resuelve igual de seguro.
- **Exponer `auth.sessions` con una vista:** la vista tendría que filtrar por usuario igualmente, y expone columnas que no hacen falta.
- **Cerrar una sesión revocando todos sus tokens al instante:** Supabase no invalida los JWT ya emitidos; habría que comprobar en RLS que
  la sesión del claim `session_id` sigue existiendo, en cada consulta. Se acepta la hora de margen.

## Consecuencias

- Cerrar una sesión no es inmediato: su token de acceso vale hasta que caduca (una hora como mucho). La interfaz lo dice.
- La migración es un paso manual de la fase final, como las demás ([gotchas/db](../gotchas/db.md), «Sesiones de la cuenta»).
- Al cerrar en todos los dispositivos, los avisos push de los demás no se quitan: siguen suscritos hasta que se borren en Ajustes ›
  Notificaciones (tarea en el tablero).
- Relacionado: `packages/core/src/account.ts`, `memory-account.ts`, `supabase-store.ts` (`account`),
  `apps/web/src/screens/ajustes/Seguridad.tsx`, `apps/web/src/lib/session.ts`, `docs/user/14-cuenta-y-seguridad.md`.
