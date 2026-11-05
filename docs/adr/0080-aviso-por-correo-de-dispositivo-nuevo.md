# ADR-0080: Aviso por correo al entrar desde un dispositivo sin nombre o nuevo, con un cron y un correo al día como mucho

- **Estado:** Propuesto
- **Fecha:** 2026-11-05
- **Área:** db, core
- **Complementa a:** [ADR-0061](0061-seguridad-de-la-cuenta.md), [ADR-0081](0081-nombre-del-equipo-y-apps-agrupadas-en-sesiones.md),
  [ADR-0082](0082-nombre-puesto-a-mano-en-cada-sesion.md)

## Contexto

«Acceso y seguridad» del ROADMAP pide un correo cuando alguien entra en tu cuenta desde un dispositivo que no habías usado. Con
[ADR-0061](0061-seguridad-de-la-cuenta.md) ya se ven y se cierran las sesiones, pero solo si entras a mirarlas. El correo es lo que te
avisa de que hay algo que cerrar. Restricciones:

- Supabase Auth no tiene un *hook* «después de entrar». Cada entrada sí crea una fila en `auth.sessions`, que ya leemos con funciones
  `security definer`. Un *trigger* sobre `auth.sessions` corre dentro de la entrada: si falla, **falla la entrada**.
- **Saber qué dispositivo es.** El tipo («Windows · Chrome») no basta: dos equipos distintos lo comparten, y la IP cambia a diario. Desde
  [ADR-0081](0081-nombre-del-equipo-y-apps-agrupadas-en-sesiones.md) la app de escritorio dice el nombre del equipo, y desde
  [ADR-0082](0082-nombre-puesto-a-mano-en-cada-sesion.md) puedes ponerle nombre a una sesión, que el navegador recuerda y vuelve a poner al
  entrar. Quien entra sin permiso no tiene ninguno de esos nombres.
- **Correos contados.** Resend está en el plan gratuito, con límite por hora y por mes, y ya lo gastan los códigos de entrada
  ([ADR-0022](0022-auth-y-sesion.md)). El aviso no puede competir con ellos.
- Las Edge Functions ya tienen un patrón para el trabajo sin el ordenador: `pg_cron` con la cabecera `x-muninn-sync-secret` y la función
  trabajando con la service role ([ADR-0040](0040-pwa-instalable-y-web-push.md), [ADR-0042](0042-noticias-rss-con-descarga-en-servidor.md)).
  Qué avisar lo decide el core, con tests.

## Decisión

- **Un cron cada 5 minutos**, no un *trigger*: `pg_cron` llama a `POST /functions/v1/security/login-alerts` (función nueva `security`).
  Una caída de la función o de Resend nunca impide entrar.
- **Un dispositivo se reconoce por su nombre**: el que pusiste en la lista, el del equipo en la app de escritorio, o el de la app
  conectada («Claude · app conectada»). Así:
  - nombre ya conocido → no avisa;
  - **sin nombre** o con un nombre nuevo → avisa.
  El mensaje lo dice: «si fuiste tú, ponle nombre a esa sesión y no te volveremos a avisar de ella».
- **Margen de 2 minutos**: solo se miran sesiones con más de 2 minutos, para que el navegador haya vuelto a poner su nombre.
- **Como mucho un correo al día por cuenta.** Las sesiones que avisan en una pasada van en el mismo correo. Si la cuenta ya recibió uno
  en las últimas 24 h, solo se apuntan.
- **Dos tablas** (migración `20261105180000_aviso_dispositivo_nuevo`, después de `20261105150000_nombre_de_sesion`):
  - `known_devices` (`owner_id`, `device_key` = el nombre): lectura del dueño con `require_mfa`; solo escribe la service role. Una
    sesión sin nombre no crea ninguno.
  - `login_alert_log` (`session_id`, `device_key`, `emailed_at`): qué sesiones ya se miraron y cuándo se mandó el último correo. Sin
    políticas; se limpia a los 30 días.
- **`login_alert_pending()`**, `security definer` y solo para `service_role`: las sesiones de entre 2 minutos y 24 h que aún no están en
  el registro, con el nombre puesto, el correo de la cuenta, el nombre de la app OAuth, `preferences.locale` / `preferences.loginAlerts` y
  el último correo enviado. No devuelve tokens.
- **El core decide** (`packages/core/src/login-alerts.ts`, con tests). La primera pasada de una cuenta (sin ningún dispositivo conocido)
  apunta en silencio. Si el envío falla, esas sesiones no se apuntan y se reintenta en la siguiente pasada.
- **El correo**, en el idioma de la cuenta (inglés por defecto): cada dispositivo con su hora (en `MUNINN_TIME_ZONE`) y su IP, cómo
  ponerle nombre si fuiste tú y, si no, el enlace a Sesiones y dispositivos y el consejo del segundo factor. Sin enlaces que cierren la
  sesión directamente: eso es justo lo que imita el *phishing*.
- **Se puede desactivar** en Ajustes › Cuenta (`preferences.loginAlerts = false`); activado por defecto. Desactivado, se sigue
  apuntando, para que al volver a activarlo no lleguen avisos de lo de antes.
- Envío con la **API HTTP de Resend** (`RESEND_API_KEY`, la misma clave del SMTP), remitente `MUNINN_MAIL_FROM` y enlaces a
  `MUNINN_APP_URL`. Secretos y cron son pasos manuales de la fase final ([gotchas/db](../gotchas/db.md)).

## Alternativas consideradas

- **Trigger en `auth.sessions` con `pg_net`:** aviso al instante, pero corre dentro de la entrada y toca el esquema `auth`.
- **Que la app avise al entrar:** el cliente de quien entra sin permiso no tiene por qué ejecutar nuestro código.
- **Reconocer por el tipo de dispositivo** (la primera versión de esta PR): otro «Windows · Chrome» de otra persona no avisaba nunca.
- **Avisar solo de dispositivos con nombre nuevo:** quien entra sin permiso no tiene nombre, así que no avisaría nunca. Es al revés.
- **Huella con IP:** con datos móviles y redes de casa la IP cambia a diario; avisaría tanto que se acabaría ignorando.
- **Un correo por sesión:** con el plan gratuito de Resend, una racha de entradas (o reconectar navegadores) se comería el cupo de los
  códigos de entrada.
- **Avisar también por push:** el atacante puede estar ya suscrito en tu propio dispositivo. Primero el correo.

## Consecuencias

- Te enteras en unos minutos de una entrada que no reconoces, aunque no abras Muninn, con un correo al día como mucho.
- **Tus propias entradas sin nombre también avisan** (un navegador nuevo, el de una app de pruebas): basta con ponerle nombre una vez.
  Para los dispositivos de siempre, el navegador lo recuerda y la app de escritorio lo trae puesto.
- **El tope diario esconde lo que llegue después del primer correo** en esas 24 h. El primero ya te dice que mires la lista, donde salen
  todas.
- El nombre lo pone el cliente: alguien con tu sesión y el segundo factor podría usar un nombre que ya conoces. Es una red más, no la
  principal; para eso está el segundo factor.
- Una pieza más que desplegar (función `security`, cron, tres secretos) y una migración manual.
- Relacionado: `packages/core/src/login-alerts.ts`, `account.ts` (`desktopDeviceName`), `supabase-store.ts` (`listPendingLogins`,
  `listKnownDevices`, `recordLogins`, `pruneLoginAlertLog`), `supabase/functions/security/index.ts`,
  `apps/web/src/screens/ajustes/Seguridad.tsx`, `docs/user/14-cuenta-y-seguridad.md`.
