# ADR-0061: Seguridad de la cuenta en Ajustes › Cuenta (sesiones, segundo factor y apps con acceso), a través del core

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** core, db, web
- **Complementa a:** [ADR-0022](0022-auth-y-sesion.md), [ADR-0036](0036-pantalla-de-autorizacion-oauth.md)

## Contexto

[ADR-0022](0022-auth-y-sesion.md) dejó para más adelante la gestión de sesiones y el segundo factor («Acceso y seguridad» del ROADMAP). Hace
falta ver dónde está abierta la sesión de la cuenta y cerrarla en uno o en todos los dispositivos, y un segundo factor opcional con una app
de códigos (TOTP). [ADR-0036](0036-pantalla-de-autorizacion-oauth.md) dejó en el Backlog ver y quitar los permisos OAuth dados a otras apps
(claude.ai). Restricciones:

- El cliente **no puede leer `auth.sessions`**: el esquema `auth` no está expuesto en PostgREST ni tiene RLS.
- supabase-js solo sabe cerrar la sesión en este dispositivo, en los demás (`scope: 'others'`) o en todos (`'global'`); no cierra una
  concreta ni lista las que hay.
- CLAUDE.md: todo acceso a Supabase pasa por el store y el core; la demo y los tests deben poder usarlo sin red.
- Supabase Auth trae MFA TOTP (activado por defecto en los proyectos): `mfa.enroll`, `challengeAndVerify`, `unenroll` y
  `getAuthenticatorAssuranceLevel`. La sesión es `aal1` tras el código del correo o GitHub y `aal2` tras el código de la app. Quitar un
  factor confirmado exige `aal2`.
- supabase-js 2.118 trae `auth.oauth.listGrants()` (cliente, *scopes* y fecha) y `revokeGrant({ clientId })`, que cierra las sesiones de
  esa app y anula sus *refresh tokens*. Sin el servidor OAuth activado, Auth contesta 404.
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
- **Segundo factor (TOTP), opcional.** `m.account.mfa`: `enroll` devuelve el QR y la clave (y borra antes un alta a medias, porque
  Supabase no deja dos factores con el mismo nombre); `confirm` lo activa con el primer código; `disable` pide un código actual antes de
  quitarlo (prueba que tienes el móvil y deja la sesión en `aal2`, que Supabase exige). Un solo factor por cuenta. Sin «Deshacer»: volver a
  activarlo da otra clave, así que el aviso lo explica. La clave se enseña agrupada y con «Copiar», y se pide guardarla: aún no hay códigos
  de recuperación.
- **Al entrar**, `getAuth()` mira el nivel de la sesión (sin red: lo leen el token y los factores de la sesión guardada). Si es `aal1` y
  podría ser `aal2`, el estado es `{ kind: 'mfa', account }`: `/_app` manda a `/login` y allí `Entrada` enseña el paso del código en lugar
  del formulario (`screens/login/Entrada.tsx`, `AppsConAcceso.tsx`, `lib/second-factor.ts`). Como el resto del login, habla con Supabase Auth desde la web,
  porque el core aún no existe; «Usar otra cuenta» cierra esa sesión a medias. `Login.tsx` no cambia.
- **Apps con acceso.** `m.account.apps` (`list`, `revoke`) sobre `listGrants`/`revokeGrant`; un 404 se lee como «ninguna». Cada fila enseña
  el nombre, desde cuándo, su web y los *scopes* en palabras (los de la pantalla de consentimiento). «Quitar acceso» sin «Deshacer»: el
  permiso solo se vuelve a dar desde la propia app, pasando por `/oauth/consent`. La pantalla de consentimiento ya dice dónde quitarlo.
- Las consultas de seguridad usan claves `['account', …]` y **no se guardan sin conexión** (`shouldPersist`).

## Alternativas consideradas

- **Exigir el segundo factor también en RLS** (políticas restrictivas con `auth.jwt() ->> 'aal'`): es lo que lo haría robusto, porque hoy un
  token `aal1` sigue leyendo los datos por la API aunque la app pida el código. Pero toca todas las tablas y hay que comprobar qué nivel
  llevan los tokens del MCP remoto (OAuth) y de las Edge Functions antes de cerrarlo. Se propone en [ADR-0062](0062-aal2-para-integraciones-sensibles.md).
- **Códigos de recuperación** de Supabase: siguen siendo experimentales en supabase-js 2.118 (`auth.experimental.recoveryCodes`). Quedan
  como tarea; mientras, la clave de configuración hace de copia.

- **Llamar a Auth desde la web, como el login:** más corto, pero rompe la regla de que la UI no habla con Supabase y deja la demo y los
  tests sin nada que probar.
- **Una Edge Function con la service role** para listar y cerrar sesiones: otra pieza que desplegar para dos consultas que una función
  `security definer` limitada a `auth.uid()` resuelve igual de seguro.
- **Exponer `auth.sessions` con una vista:** la vista tendría que filtrar por usuario igualmente, y expone columnas que no hacen falta.
- **Cerrar una sesión revocando todos sus tokens al instante:** Supabase no invalida los JWT ya emitidos; habría que comprobar en RLS que
  la sesión del claim `session_id` sigue existiendo, en cada consulta. Se acepta la hora de margen.

## Consecuencias

- El segundo factor lo pide la app, no el servidor: protege la entrada por la interfaz, no un token `aal1` ya emitido usado contra la API.
  La guía de usuario lo dice. Hay que comprobar en el panel que MFA TOTP sigue activado (fase final).
- Cerrar una sesión no es inmediato: su token de acceso vale hasta que caduca (una hora como mucho). La interfaz lo dice.
- La migración es un paso manual de la fase final, como las demás ([gotchas/db](../gotchas/db.md), «Sesiones de la cuenta»).
- Al cerrar en todos los dispositivos, los avisos push de los demás no se quitan: siguen suscritos hasta que se borren en Ajustes ›
  Notificaciones (tarea en el tablero).
- Relacionado: `packages/core/src/account.ts`, `memory-account.ts`, `supabase-store.ts` (`account`),
  `apps/web/src/screens/ajustes/Seguridad.tsx`, `SegundoFactor.tsx`, `apps/web/src/lib/session.ts`, `lib/second-factor.ts`,
  `screens/login/Entrada.tsx`, `docs/user/14-cuenta-y-seguridad.md`.
