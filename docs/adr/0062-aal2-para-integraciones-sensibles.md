# ADR-0062: El servidor exige el segundo factor (AAL2): para los datos si está activado y para conectar integraciones sensibles

- **Estado:** Aceptado (29 de octubre de 2026)
- **Fecha:** 2026-10-28
- **Área:** db, core, web, mcp
- **Complementa a:** [ADR-0061](0061-seguridad-de-la-cuenta.md)

## Contexto

El ROADMAP pide un segundo factor «opcional, y obligatorio para conectar integraciones sensibles (finanzas, GitHub con permisos de
escritura)». [ADR-0061](0061-seguridad-de-la-cuenta.md) monta el segundo factor TOTP, pero solo lo comprueba **la app** al entrar. Al
mirar cómo exigirlo también en esas acciones salió que, hecho solo en la interfaz, no protege nada:

- RLS no mira el nivel de la sesión. Un token `aal1` (código del correo o GitHub, sin el de la app) lee y escribe todos los datos por la API
  aunque la cuenta tenga segundo factor. Quien consiga el código del correo puede saltarse la pantalla del código.
- «Conectar GitHub con escritura» hoy es vincular un repo en Ajustes › Integraciones: un `update` de `projects.github_repo`, que el token
  de la sincronización (un secreto de la Edge Function `github`) usa después para escribir issues. Un botón deshabilitado en la interfaz no
  impide ese `update` desde la API.
- Finanzas aún no conecta nada externo (los movimientos se apuntan a mano). No hay acción que proteger todavía.
- El MCP remoto entra con tokens que emite el servidor OAuth de Supabase ([ADR-0036](0036-pantalla-de-autorizacion-oauth.md)). Falta
  comprobar qué `aal` llevan: si es `aal1`, exigir `aal2` en RLS dejaría a claude.ai sin acceso en cuanto se active el segundo factor.

Por eso no se ha montado en el PR de ADR-0061: sería una comprobación en el cliente que aparenta seguridad sin darla.

## Decisión (propuesta)

1. **Una función `public.mfa_satisfied()`** (`security definer`, `search_path = ''`): verdadera si el JWT es `aal2` o si el usuario no
   tiene ningún factor confirmado en `auth.mfa_factors`.
2. **Política `as restrictive`** en cada tabla con `owner_id` (`using` y `with check` = `(select public.mfa_satisfied())`): con segundo
   factor activado, un token `aal1` no ve ni cambia nada. Sin él, todo sigue igual.
3. **Integraciones sensibles**: un *trigger* o política sobre `projects.github_repo` (y lo que traiga finanzas: bancos, importaciones)
   que exija `aal2` siempre, tenga o no factor: sin segundo factor activado, la app enseña «Activa el segundo factor para conectar GitHub»
   con un enlace a Ajustes › Cuenta. El core expone `m.account.mfa.assurance()` para que la interfaz lo sepa antes de intentarlo.
4. **Antes de aplicar**: comprobar el `aal` de los tokens del MCP remoto (OAuth) y decidir si el consentimiento debe exigir `aal2`
   (la pantalla `/oauth/consent` ya está detrás del login, que pide el código), y que las Edge Functions con la service role no se ven
   afectadas (no pasan por RLS).

## Alternativas consideradas

- **Solo en la interfaz** (deshabilitar «Vincular» sin `aal2`): fácil, pero se salta con una llamada a la API. Descartado.
- **Exigir `aal2` a todo el mundo:** el segundo factor dejaría de ser opcional, en contra del ROADMAP.
- **Un paso de `aal2` puntual («step-up») al vincular:** pedir el código justo antes de la acción. Útil para la interfaz, pero sin la
  política del servidor sigue siendo saltable; puede añadirse encima del punto 3.

## Consecuencias

- Positivas: con el segundo factor activado, el código del correo ya no basta para leer los datos por ninguna vía.
- Costes: una política más en cada tabla (y en cada tabla nueva: checklist de [gotchas/db](../gotchas/db.md)) y una consulta a
  `auth.mfa_factors` por petición (cacheada por sentencia con `(select …)`). Riesgo de dejar fuera al MCP remoto si sus tokens son `aal1`.
- Tarea en el tablero: «Exigir el segundo factor en el servidor (RLS) e integraciones sensibles (ADR-0062)».

## Cómo quedó (29 de octubre)

Migración `20261029150000_aal2_en_el_servidor`: `mfa_satisfied()`, la política restrictiva `require_mfa` en todas las tablas de
`public` con RLS y en `storage.objects`, la misma comprobación dentro de `list_my_sessions` y `revoke_my_session` (son
`security definer` y se saltan el RLS; lo señaló la revisión de seguridad de #72) y el *trigger* `projects_github_repo_aal2`.
La app traduce el rechazo a «Para conectar GitHub necesitas el segundo factor». Finanzas no tiene aún nada que proteger.

Lo del punto 4 queda para la fase final (paso 4d): la documentación de Supabase dice que los tokens del servidor OAuth llevan
`aal` y `amr` como cualquier sesión, pero no que hereden el nivel de la sesión que aprobó el consentimiento. Si claude.ai deja de
ver datos al activar el segundo factor, se reconecta el conector (el consentimiento ya pasa por el código).
