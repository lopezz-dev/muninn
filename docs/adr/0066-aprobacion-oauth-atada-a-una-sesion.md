# ADR-0066: La aprobación con el segundo factor de una app OAuth vale para una autorización y una sola sesión

- **Estado:** Aceptado
- **Fecha:** 2026-10-29
- **Área:** db, core, web, mcp
- **Reemplaza a:** [ADR-0064](0064-apps-oauth-aprobadas-con-segundo-factor.md) en los puntos 1–3 (la fila por app)

## Contexto

[ADR-0064](0064-apps-oauth-aprobadas-con-segundo-factor.md) apuntaba «esta app la aprobé con el segundo factor» por **app**
(`owner_id`, `client_id`), y `mfa_satisfied()` dejaba pasar **cualquier** sesión de esa app. La revisión de seguridad del PR que lo
implementaba encontró el agujero:

- `/oauth/consent` no deja aprobar con `aal1`, pero la API de Supabase sí: quien solo tenga el código del correo puede llamar a
  `approveAuthorization` directamente, desde **su propia** cuenta de claude.ai (el mismo `client_id`).
- Su sesión nueva sería de una app con fila, y vería todo como si hubiera pasado el segundo factor. Justo lo que ADR-0062 evita.

`auth.oauth_authorizations` guarda cada solicitud (`authorization_id`, `client_id`, `user_id`, `approved_at`), pero ninguna tabla dice
qué sesión salió de qué autorización. La sesión (`auth.sessions` con `oauth_client_id`) nace al canjear el código, poco después de aprobar.

## Decisión

1. **`approve_oauth_client_mfa(authorization_id text)`**: con `aal2`, busca la autorización **pendiente**, sin caducar, del usuario
   que llama, y apunta en `oauth_mfa_grants` su `authorization_id` y su `client_id` (sale de la autorización, no lo dice quien llama),
   con `session_id` vacío. Una aprobación nueva de la misma app sustituye a la anterior y deja sin acceso a la sesión vieja.
2. **Un *trigger* en `auth.sessions`** (`after insert`, solo con `oauth_client_id`) ata la fila a la sesión que nace, una sola vez, si
   la autorización apuntada es la última aprobada de esa app para ese usuario y la aprobación es de hace menos de 15 minutos. Si algo
   falla, no rompe la entrada: la sesión nace sin acceso.
3. **`mfa_satisfied()`** solo deja pasar la sesión **atada** (`session_id` del JWT = el de la fila) y que sigue existiendo.
4. Lo demás de ADR-0064 sigue: sesiones y GitHub con `aal2` estricto (`mfa_satisfied_strict()`), y quitar el acceso borra la fila.

## Alternativas consideradas

- **Fila por app (ADR-0064):** el agujero de arriba.
- **Ventana de tiempo sin atar a una sesión** (`s.created_at` cerca de `approved_at`): deja pasar cualquier sesión de la app nacida en
  esa ventana, también la de otra persona con el código del correo.
- **Exigir `aal2` para aprobar cualquier autorización:** no se puede: la aprobación la hace Supabase Auth, no nuestra base.

## Consecuencias

- Positivas: cada «Permitir acceso» con el segundo factor da acceso a **una** sesión. Quien solo tenga el código del correo puede
  conectar una app, pero esa sesión no ve nada.
- Costes: un *trigger* en una tabla de Supabase Auth (si cambia su esquema, la sesión nace sin acceso en lugar de fallar). Cuando
  Supabase vuelve a la app sin preguntar (permiso ya dado), la sesión nueva no tiene fila: hay que **quitar el acceso** y reconectar.
  Queda una carrera estrecha: si alguien con el código del correo aprueba justo antes que tú y canjea su código después, su sesión
  podría atarse; necesita el código del correo en ese mismo minuto.
- Relacionado: [ADR-0064](0064-apps-oauth-aprobadas-con-segundo-factor.md), [ADR-0062](0062-aal2-para-integraciones-sensibles.md),
  migración `20261029200000_oauth_mfa_grants`, [gotchas/db](../gotchas/db.md), `supabase/tests/oauth_mfa_grants.sql`.
