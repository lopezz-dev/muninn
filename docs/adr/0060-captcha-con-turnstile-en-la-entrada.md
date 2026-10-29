# ADR-0060: CAPTCHA de la entrada con Cloudflare Turnstile, invisible y opcional por variable

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Área:** web, desktop, db

## Contexto

El registro está abierto: el primer código por correo crea la cuenta ([ADR-0022](0022-auth-y-sesion.md)). Antes de
anunciarlo hace falta frenar a los bots, que con una lista de correos crearían cuentas en masa y gastarían el cupo del
SMTP (Resend). Supabase Auth trae protección con CAPTCHA y admite dos proveedores: **hCaptcha** y **Cloudflare Turnstile**.
Si se activa en el panel, `POST /auth/v1/otp` exige un token válido; la app tiene que obtenerlo y mandarlo.

Condiciones: la misma pantalla corre en la web (Vercel), la PWA del iPhone y Tauri (origen `http://tauri.localhost` en
Windows, `tauri://localhost` en macOS); el login no debe ganar peso de arranque; los entornos locales y la demo no tienen
clave y deben seguir funcionando.

## Decisión

- **Cloudflare Turnstile** en modo `interaction-only`: la comprobación es casi siempre invisible y solo pide un clic si
  Cloudflare duda. Sin cookies de seguimiento ni puzles de imágenes.
- La **clave pública** del sitio va en `VITE_TURNSTILE_SITE_KEY`; la **secreta**, solo en Supabase › Attack Protection.
  **Sin la variable no hay widget ni script** y la petición es la de siempre: así el CAPTCHA se activa sin tocar código,
  primero la variable (el widget ya manda token aunque Supabase no lo pida) y después el interruptor de Supabase.
- El widget lo monta `useCaptcha` (`apps/web/src/lib/captcha.ts`), que descarga `api.js?render=explicit` al abrir el
  login (nunca en el arranque) y reintenta la descarga si falló. Estados: `off`, `loading` («Comprobando…» en el botón),
  `ready` y `error` (aviso con `notify` y botón «Reintentar»).
- El token viaja como `options.captchaToken` en `signInWithOtp` (`sendEmailCode`). Es la **única** llamada del login
  que lo exige: `verifyOtp` y el OAuth de GitHub no pasan por la comprobación de Supabase. El token es de un solo uso:
  se pide otro tras cada envío, salga bien o mal, para que **Reenviar código** tenga el suyo. Por eso el widget vive
  fuera de los dos pasos del formulario.
- La auth sigue en `apps/web/src/lib/login-actions.ts`, no en el core: es así desde ADR-0022 (el core recibe el cliente
  ya autenticado) y el CAPTCHA no cambia eso.
- CSP de Tauri: `script-src` y `frame-src` permiten `https://challenges.cloudflare.com`. La web no tiene CSP propia.

## Alternativas consideradas

- **hCaptcha:** el otro proveedor de Supabase. Su modo gratuito enseña puzles de imágenes con más frecuencia, usa
  cookies propias y su versión invisible es de pago. Peor para la privacidad y para la conversión del registro.
- **Solo límites de Supabase** (correos por hora, *rate limit* por IP): ya están, pero no paran una granja de IPs y el
  límite del SMTP se agotaría igual.
- **Activar el CAPTCHA sin la variable opcional:** obligaría a tener clave en cada entorno local y rompería la demo.
- **Pasar el token por el core:** el core no conoce la auth (ADR-0022); añadirla solo para esto mezclaría capas.

## Consecuencias

- Positivas: registro protegido sin fricción visible; activable por entorno; el login solo pide el script de Cloudflare
  cuando hay clave.
- Negativas / costes: dependemos de que `challenges.cloudflare.com` cargue; un bloqueador estricto o una red que lo
  corte impide pedir el código (hay mensaje y «Reintentar», y lo explica la guía). Los *hostnames* del widget se
  mantienen a mano en Cloudflare: si cambia el dominio, hay que añadirlo (lista de gotchas/web). En macOS, el origen
  `tauri://localhost` no es `http(s)`: si Turnstile lo rechaza, habrá que servir el login desde la web o usar el
  protocolo `http` de Tauri (pendiente de comprobar en la fase final).
- Relacionado: [gotchas/web](../gotchas/web.md#captcha-de-la-entrada-turnstile-pasos-manuales),
  [gotchas/desktop](../gotchas/desktop.md#csp), `apps/web/src/lib/captcha.ts`, `lib/login-actions.ts`,
  `screens/Login.tsx`, `apps/desktop/src-tauri/tauri.conf.json`, `docs/fase-final.md` (paso 4c).
