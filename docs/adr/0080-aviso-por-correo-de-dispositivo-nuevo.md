# ADR-0080: Aviso por correo al entrar desde un dispositivo nuevo, con un cron que lee las sesiones

- **Estado:** Propuesto
- **Fecha:** 2026-11-05
- **Área:** db, core
- **Complementa a:** [ADR-0061](0061-seguridad-de-la-cuenta.md), [ADR-0022](0022-auth-y-sesion.md)

## Contexto

«Acceso y seguridad» del ROADMAP pide un correo cuando alguien entra en tu cuenta desde un dispositivo que no habías usado. Con
[ADR-0061](0061-seguridad-de-la-cuenta.md) ya se ven y se cierran las sesiones, pero solo si entras a mirarlas. El correo es lo que te
avisa de que hay algo que cerrar. Restricciones:

- Supabase Auth no tiene un *hook* «después de entrar». Los que hay (*Custom Access Token*, *Send Email*, *MFA Verification*…) o
  corren en cada refresco del token o solo para sus correos. Cada entrada sí crea una fila en `auth.sessions` (con `user_agent`, `ip`,
  `oauth_client_id`), que ya leemos con funciones `security definer`.
- Un *trigger* sobre `auth.sessions` corre dentro de la transacción de la entrada: si falla, **falla la entrada**. Supabase pide no
  tocar el esquema `auth` más allá de leerlo.
- El correo sale por Resend, el mismo SMTP de los correos de acceso ([ADR-0022](0022-auth-y-sesion.md)), con el remitente
  provisional hasta tener el dominio propio (0.13).
- Las Edge Functions ya tienen un patrón para el trabajo sin el ordenador: `pg_cron` llama con la cabecera `x-muninn-sync-secret` y la
  función trabaja usuario a usuario con la service role ([ADR-0040](0040-pwa-instalable-y-web-push.md), [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md)).
- Qué avisar lo decide el core, con tests; la función solo lee secretos y envía (como `push`).

## Decisión

- **Un cron cada 5 minutos**, no un *trigger*: `pg_cron` llama a `POST /functions/v1/security/login-alerts` (función nueva
  `security`) con el secreto de siempre. El aviso llega como mucho unos minutos después de entrar, y una caída de la función o de
  Resend nunca impide entrar.
- **Qué es «dispositivo»:** el nombre que ya enseña la lista de sesiones, `sessionDeviceLabel` («Windows · Chrome», «iPhone · Safari»,
  «Muninn para Mac», «Claude · app conectada»). La IP **no** cuenta: cambia con cada red y avisaría a cada rato. Es una huella gruesa
  a propósito (ver Consecuencias).
- **Dos tablas** (migración `20261105120000_aviso_dispositivo_nuevo`):
  - `known_devices` (`owner_id`, `device_key`, `first_seen_at`, `last_seen_at`): los dispositivos que ya has usado. RLS de lectura
    para el dueño (con `require_mfa`); solo escribe la service role.
  - `login_alert_log` (`session_id`, `owner_id`, `device_key`, `emailed_at`): qué sesiones ya se miraron, para no repetir. Sin
    políticas: solo la service role. Se limpia a los 30 días.
- **`login_alert_pending()`**, `security definer` y solo para `service_role`: las sesiones de las últimas 24 h que aún no están en el
  registro, con el correo de la cuenta, el nombre de la app OAuth y `preferences.locale` / `preferences.loginAlerts`. No devuelve tokens.
- **El core decide** (`packages/core/src/login-alerts.ts`, con tests): por cada sesión nueva,
  - si la cuenta **aún no tiene ningún dispositivo conocido** (la primera pasada tras desplegar, o una cuenta recién creada), se apunta
    sin correo: no se avisa de lo que ya existía ni del primer acceso;
  - si el dispositivo ya se conocía, solo se refresca `last_seen_at`;
  - si es nuevo, se apunta y se manda el correo, salvo que la cuenta lo tenga desactivado.
  Si el envío falla, esa sesión no se apunta: la siguiente pasada lo reintenta (mientras siga dentro de las 24 h).
- **El correo**, en el idioma de la cuenta (inglés por defecto, [ADR-0077](0077-i18n-ingles-por-defecto-con-i18next.md)): qué
  dispositivo, cuándo (en `MUNINN_TIME_ZONE`) y desde qué IP; «Si fuiste tú, no hace falta hacer nada» y, si no, un enlace a Ajustes ›
  Cuenta › Sesiones para cerrarla y el consejo de activar el segundo factor. Sin enlaces que cierren la sesión directamente: un enlace
  así en un correo es justo lo que imita el *phishing*.
- **Se puede desactivar** en Ajustes › Cuenta (`preferences.loginAlerts = false`); está activado por defecto. Desactivado, los
  dispositivos se siguen apuntando, para que al volver a activarlo no lleguen avisos de lo de antes.
- Envío con la **API HTTP de Resend** (`RESEND_API_KEY`, la misma clave del SMTP), remitente `MUNINN_MAIL_FROM` y enlaces a
  `MUNINN_APP_URL`. Secretos y cron son pasos manuales de la fase final ([gotchas/db](../gotchas/db.md)).

## Alternativas consideradas

- **Trigger en `auth.sessions` con `pg_net`:** aviso al instante, pero corre dentro de la entrada (un error la tumbaría) y toca el esquema
  `auth`. Cinco minutos de retraso son aceptables para este aviso.
- **Que la app avise al entrar:** el cliente de quien entra sin permiso no tiene por qué ejecutar nuestro código (puede usar la API
  directamente). El aviso tiene que salir del servidor.
- **Huella con IP o con la red:** con datos móviles y redes de casa la IP cambia a diario; avisaría tanto que se acabaría ignorando.
- **Huella guardada en el dispositivo** (un id en `localStorage` enviado al entrar): más precisa, pero la pone el cliente, así que no vale
  contra quien entra sin la app, y cada borrado de datos del navegador sería un «dispositivo nuevo».
- **SMTP desde la función** en lugar de la API de Resend: más dependencias en Deno para lo mismo; la API es un `fetch`.
- **Avisar también por push:** el atacante puede estar ya suscrito en tu propio dispositivo. Primero el correo; el push puede sumarse.

## Consecuencias

- Te enteras de una entrada desde otro tipo de dispositivo o de una app nueva conectada por OAuth, en unos minutos y aunque no abras
  Muninn.
- **No distingue dos dispositivos del mismo tipo:** quien entre desde otro «Windows · Chrome» cuando tú ya usas uno no dispara el aviso.
  Para eso está el segundo factor; el aviso es una red más, no la principal. La guía lo dice.
- Reconectar una app OAuth (claude.ai) crea sesiones nuevas, pero el dispositivo («Claude · app conectada») ya se conoce: no avisa cada
  vez.
- La primera pasada tras desplegar apunta en silencio los dispositivos que ya tenías.
- Una pieza más que desplegar (función `security`, cron, tres secretos) y una migración manual.
- Relacionado: `packages/core/src/login-alerts.ts`, `supabase-store.ts` (`listPendingLogins`, `listKnownDevices`, `recordLogins`,
  `pruneLoginAlertLog`), `supabase/functions/security/index.ts`, `apps/web/src/screens/ajustes/Seguridad.tsx`,
  `docs/user/14-cuenta-y-seguridad.md`.
