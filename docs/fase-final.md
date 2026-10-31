# Fase final: instalar, desplegar, publicar y probar

Todo lo de F1–F4 está en `develop` (26 de octubre). Lo que queda no se puede hacer desde el código: instalar en tu equipo, desplegar,
publicar y probar a mano. Esta es la **lista de trabajo, en orden**: cada paso deja listo lo que necesita el siguiente. Marca aquí; las
secciones de [Pruebas finales](ROADMAP.md#pruebas-finales) del ROADMAP guardan el detalle y lo que ya se comprobó antes, y se ponen al día
al acabar.

**Antes de empezar**
- Ten a mano la CLI de Supabase (`npx supabase@2 login`, una vez) y tu sesión de Muninn en el ordenador.
- Usa datos de prueba con nombre reconocible («Prueba final …») y archívalos al acabar.
- Si algo falla: abre una tarea en el proyecto de Muninn (etiqueta `iphone` si es del móvil) y sigue con lo demás si no depende de ello.
- Nada de secretos ni tokens en el chat ni en el repo.

## 0. Decisiones (tuyas, antes de tocar nada)

- [x] **Hosting de la web:** aceptar [ADR-0040](adr/0040-pwa-instalable-y-web-push.md) (Vercel) o elegir otro. *(26 de octubre: Vercel,
  en el equipo Kodemaru.)*
- [x] **Qué rama se publica:** `main` está por detrás de `develop`. Recomendado: publicar `develop` mientras dura la fase final y pasar a
  `main` al terminar (paso 9). La otra opción es pasar `develop` → `main` ahora y publicar `main`. *(Se publica `develop`.)*
- [ ] **Conector de claude.ai:** pedir ya a Edgar el permiso de la organización para añadir conectores personalizados. Tarda y no depende
  de nada; sin él, el paso 7 se queda a medias.

## 1. Ollama en el ordenador (≈ 20 min, la mayor parte descargando)

Pasos en [gotchas/desktop › Instalar Ollama](gotchas/desktop.md#instalar-ollama-y-el-modelo-del-asistente-pasos-manuales-fase-final).
- [ ] Instalar Ollama y configurar `OLLAMA_ORIGINS` (5173, 5174 y los tres orígenes de Tauri). Después, salir de Ollama y volver a abrirlo.
- [ ] `ollama pull qwen3:8b`. Para comparar, también `qwen3:14b` (opcional).
- [ ] Comprobar: `curl http://localhost:11434/api/tags` lista el modelo y `ollama run qwen3:8b "hola"` contesta.
- [ ] Banco de pruebas: `pnpm --filter @muninn/assistant bench -- --model qwen3:8b` (y `qwen3:14b`). Funciona con datos de ejemplo y no
  toca tu cuenta. Apunta en el ROADMAP cuántos casos pasan y cuánto tarda, y deja el mejor como modelo en Ajustes › Asistente e IA.

## 2. Desplegar en Supabase (≈ 15 min)

Un solo despliegue de `mcp` cubre lo pendiente de F3 (Finanzas) y F4 (catálogo único, `list_news`, `news_digest`).

> **Desplegadas el 26 de octubre** `news` (con el cron `muninn-news-fetch`, minuto 7 de cada hora) y `mcp` (catálogo único, Finanzas
> y Noticias). Comprobado:
> - `news`: sin secreto da 401. Lanzada desde SQL como el cron (con el secreto del Vault), con las tres fuentes «Prueba final» recuperadas
>   un momento: llegan 20 artículos de tauri.app y 4 de This Week in Rust, así que el DNS resuelve dentro de la función. La inventada
>   queda con su error. La segunda vez añade 0 y las dos reales contestan 304. Las fuentes vuelven a estar archivadas.
> - `mcp`: sin token da 401 con `resource_metadata`; metadatos 200, GET 405, token inventado 401 y `Origin` ajeno 403.
> - Para un dominio que no existe, el error decía «Solo se pueden leer fuentes con una dirección pública de internet», que confundía.
>   Arreglado y redesplegado el mismo día: ahora dice «No encuentro feeds.prueba-final-muninn.com: revisa que la dirección esté bien
>   escrita» (comprobado con la fuente inventada).
- [x] Empaquetar: `pnpm --filter @muninn/core build:edge` y `pnpm --filter @muninn/mcp build:edge`.
- [x] **`news`:** desplegar, probar con `curl` y programar el cron cada hora. Son los pasos 2 a 4 de
  [gotchas/db › Noticias](gotchas/db.md#noticias-descarga-con-la-edge-function-pasos-manuales).
- [x] **`mcp`:** `npx supabase@2 functions deploy mcp --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt --use-api`. Después, el `curl` sin
  token tiene que seguir dando 401 con `resource_metadata` ([gotchas/mcp › MCP remoto](gotchas/mcp.md#mcp-remoto-pasos-manuales), paso 2).
- [ ] MCP remoto con token, que caduca a la hora: paso 3 de gotchas/mcp. «¿Cómo voy hoy?» responde con tus datos; con el token caducado da 401.
- [x] La función `github` no hace falta volver a desplegarla: el empaquetado la regenera, pero no ha cambiado nada que use.
- [ ] **Redesplegar `news`** (27-10): el core lee ahora la codificación del feed (cabecera o `<?xml encoding>`), para que el BOE
  (ISO-8859-1) no salga con «�». `pnpm --filter @muninn/core build:edge` y desplegar como en el paso 2 de gotchas/db › Noticias.
  Después, añadir el BOE desde **Fuentes oficiales**, pulsar **Actualizar** y comprobar las tildes.
- [ ] **Asistente con imágenes** (27-10, ADR-0051): `ollama pull gemma3` (o `qwen2.5vl`), elegirlo en Ajustes › Asistente e IA,
  adjuntar la foto de un ticket con «apunta este gasto» y comprobar que lo apunta bien. Con `qwen3:8b`, el aviso «no ve imágenes».
- [ ] **Redesplegar `mcp`** (27-10): `categories.move` cuenta ahora dentro de su tipo (gastos o ingresos). Ninguna herramienta lo usa
  aún, pero el paquete del MCP lleva el core.
- [ ] **Redesplegar `mcp`** (28-10): el servidor se presenta con `title` «Muninn» y el logo (`icons`, *data URI*) para que el conector de
  claude.ai no salga con el icono de Supabase. Ya empaquetado con `pnpm --filter @muninn/mcp build:edge`; desplegar como arriba.
  Se comprueba en el paso 7.
- [ ] **Redesplegar `mcp`** (28-10): herramienta `create_tasks` (hasta 50 tareas con su checklist), `checklist` en `create_task` y el
  proyecto por nombre ya no cae en el archivado. `pnpm --filter @muninn/mcp build:edge` y desplegar como arriba. Después, en claude.ai:
  - [ ] «En el proyecto Prueba final, crea 5 tareas, cada una con 2 subtareas, y una más en la columna "No existe"». Una sola llamada a
    `create_tasks`: 5 creadas con sus subtareas en orden, 1 con el error de la columna, y no repite las buenas. Archívalas al acabar.
  - [ ] «¿Qué tareas tiene Muninn?» lista las del proyecto activo, no las del archivado con el mismo nombre.
- [ ] **Redesplegar `mcp`, `news`, `github` y `push`** (31-10): llevan el core empaquetado, que desde la PR #91 lee en lote (`overview` en tres
  consultas en paralelo, #94) y ahora busca por palabras en cualquier orden. `pnpm --filter @muninn/core build:edge`,
  `pnpm --filter @muninn/mcp build:edge` y desplegar las cuatro como arriba. Después, en claude.ai:
  - [ ] «¿Cómo voy hoy?» contesta igual que antes con todos tus proyectos.
  - [ ] «Busca tareas de github login» encuentra «Login con GitHub» aunque las palabras estén al revés.

## 3. En el ordenador, con tu sesión (≈ 1 h)

`pnpm dev` (5174) con tu cuenta, no la demo (5175). Lo de la app de escritorio, con `pnpm dev:desktop`.

**MCP local (stdio).** Ya está recompilado; reinicia el cliente de Claude antes de probar.
- [ ] Las herramientas de siempre responden igual que antes del catálogo único.
- [ ] «He gastado 24,90 en el cine» apunta un gasto en la cuenta corriente, con la categoría Ocio.
- [ ] «¿Cuánto tengo?» da los mismos saldos que la app.

> **26 de octubre, 20:15–20:35** (con tu sesión en el 5174, navegador integrado, sin Ollama y sin la función `news` desplegada).
> Pasa lo marcado. Lo que necesita Ollama o la función sigue sin marcar.
>
> Fallos encontrados (arreglados en el mismo PR que estos resultados):
> - Ajustes › Módulos sigue mostrando «Llega en la fase 2/3/4» en GitHub, Finanzas y Noticias.
> - El informe pierde la hora si la cambias y pulsas el interruptor sin salir antes del campo: los dos guardados se pisan.
> - En el informe, la fecha de las vencidas sale como «desde el 2026-10-19».
> - «Actualizar» en Noticias enseña el error técnico en inglés («Failed to send a request to the Edge Function»). Pasaba lo
>   mismo con cualquier error de una Edge Function, también en GitHub.

**Finanzas**
- [x] Activar Finanzas y crear una cuenta «Prueba final …».
- [x] Apuntar, editar y archivar movimientos con «Deshacer». También el saldo: 100 − 24,90 = 75,10 €.
- [x] Crear una suscripción «Prueba final …» con el cobro mañana: sale en Inicio › «Próximos cobros».
- [x] «Apuntar» la suscripción crea el gasto con el icono de repetición, y «Deshacer» lo quita.
- [x] Al acabar, archivar la cuenta y la suscripción.

**Asistente**
- [ ] «¿Cómo voy hoy?» responde con tus datos.
- [ ] «Crea una tarea «Prueba final …» en <proyecto>» la crea con «El asistente» en su historial.
- [ ] «Deshacer» archiva esa tarea.
- [ ] Cierra Ollama: sale «No encuentro Ollama…» con los pasos. Al abrirlo, el punto se pone verde solo en 8 s o menos. *(El
  mensaje y los pasos salen bien, comprobado sin Ollama; falta lo de ponerse verde.)*
- [ ] Lo mismo en la app de escritorio. Si no conecta, revisa que `OLLAMA_ORIGINS` incluya `tauri.localhost`.

**Noticias**
- [x] Activar Noticias y añadir 2–3 fuentes reales: una Atom, una RSS y una que falle.
- [ ] «Actualizar»: llegan artículos y la fuente que falla enseña el error. *(Sin la función desplegada avisa «Las noticias aún no se
  descargan desde aquí», como debe; repetir tras el paso 2.)*
- [ ] Volver a pulsar «Actualizar» no duplica nada.
- [ ] Con Ollama, al abrir Noticias se genera solo «Lo importante de hoy».
- [ ] «Rehacer» cambia el resumen y «Deshacer» devuelve el anterior.

**Informe de la mañana**
- [x] Activarlo para dentro de 2 minutos con Muninn abierto: llega el aviso «Tu informe de la mañana está listo». **Primero pon la hora
  y sal del campo, y después activa el interruptor.** Si lo activas con una hora ya pasada, se hace al momento (lo recupera, como en el
  paso 8) y ese día ya no vuelve a saltar.
- [ ] La nota está fijada y lleva la entradilla del modelo y el resumen de noticias. *(Fijada, con actor `assistant`, «Hecho a las
  20:27…», vencidas y cobros; falta la entradilla y las noticias, que necesitan Ollama y la función.)*
- [x] Antes de terminar el día, déjalo a tu hora de verdad (p. ej. 08:30). Lo necesitas para el paso 8. *(Activado a las 08:30.)*
- [ ] **Buscador ⌘K** (28-10): «fact» (o parte de una tarea tuya) lista tareas con su proyecto y notas, y al elegir una se abre su
  detalle; «nueva nota» crea una y la abre, con «Deshacer». Con muchas tareas, escribir rápido no se nota lento.

**Enlaces externos** (escritorio con `pnpm dev:desktop` y navegador en el 5174).
- [ ] Escritorio: en Noticias, el título y «Abrir» abren el artículo en tu navegador y la noticia queda leída. También la issue y «Ver el
  PR» de una tarea, «PR #n» en GitHub, un enlace de una nota y «GitHub» en Ajustes › Acerca de. Las imágenes del Asistente no llevan enlace.
- [ ] Navegador: los mismos enlaces abren otra pestaña (Ctrl-clic, en segundo plano) y una imagen adjunta del Asistente se abre a tamaño real.

**GitHub en escritorio** (28-10, [ADR-0059](adr/0059-deep-links-para-oauth-en-escritorio.md)).
- [x] Supabase › **Authentication › URL Configuration › Redirect URLs**: añade `muninn://auth/callback` (exacta, sin `/**`). Sin ella,
  Supabase vuelve a la *Site URL* en el navegador y la app se queda «Esperando a GitHub…». *(30 de octubre. Faltaba: desde la app
  instalada, tras elegir la cuenta en GitHub, se acababa en la web publicada. Añadida, ya vuelve a la app.)*
- [ ] Con `pnpm dev:desktop` (Windows registra `muninn://` al arrancar), cierra sesión y pulsa **Continuar con GitHub**: se abre tu navegador
  y sale «Sigue en el navegador». Autoriza; el navegador pregunta si abrir Muninn: acepta. La app pasa al frente, «Sesión iniciada» y entras.
  No se abre una segunda ventana de Muninn.
- [ ] En GitHub pulsa **Cancel**: «Acceso con GitHub cancelado». Pulsa **Cancelar** en la app mientras espera: el mismo aviso y el botón
  vuelve a estar activo.
- [ ] Con la app **instalada** (paso 10): lo mismo. *(30 de octubre: entrar con GitHub funciona; falta lo de cancelar y lo de Muninn cerrado.)* Y con Muninn cerrado, abre en el navegador una vuelta pendiente (empieza el login, cierra la
  app antes de autorizar y autoriza después): Muninn se abre y entra.

## 4. Publicar la web (≈ 30 min)

Pasos 1–5 de [gotchas/web › Publicar la PWA](gotchas/web.md#publicar-la-pwa-y-activar-web-push-pasos-manuales).

> **26 de octubre:** publicada en **https://muninn-sepia.vercel.app** (proyecto `muninn` del equipo Kodemaru, rama de producción `develop`,
> primer despliegue de `e17cfec`). Comprobado con `curl` y en el navegador: la URL de producción es pública, `/finanzas` no da 404
> (redirige al login), el service worker se registra y el build lleva la dirección de Supabase.
- [x] Proyecto en Vercel con *Root Directory* `apps/web` y la rama del paso 0.
- [x] Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Despliega.
- [ ] Dominio propio (opcional). *(Mientras, la de Vercel. Para un nombre más corto, Vercel › Settings › Domains admite otro
  `*.vercel.app` libre.)* Al cambiarlo, sigue [la lista de gotchas/web](gotchas/web.md#cambiar-el-dominio-de-la-web-lista-completa):
  la URL está escrita en el repo y en varios servicios.
- [x] Supabase › URL Configuration: *Site URL* = la URL publicada, y `https://<tu-url>/**` en *Redirect URLs*. Deja las de `localhost`.
  *(El 28 de octubre la autorización OAuth aún mandaba a `localhost:5174`; ya está. Compruébalo siempre con la redirección: [gotchas/mcp](gotchas/mcp.md#el-servidor-oauth-manda-a-localhost).)*
- [ ] GitHub › la OAuth App de Muninn: *Homepage URL* = la URL publicada (el *callback* no cambia).
- [ ] Añadir la URL publicada a `OLLAMA_ORIGINS` y reiniciar Ollama.
- [ ] Comprobar:
  - abrir `https://<tu-url>/finanzas` y recargar no da 404;
  - entrar con el código del correo funciona;
  - entrar con GitHub vuelve a la URL publicada;
  - la pestaña lleva el logo, `/robots.txt` y `/sitemap.xml` se abren, y al pegar la URL en un chat sale la tarjeta con la imagen
    (ADR-0045). *(Hecho el 27 de octubre: la tarjeta sale bien en WhatsApp y los ficheros responden en producción.)*
- [ ] (Opcional, con tu cuenta de Google) Search Console: verificar la URL publicada y enviar `sitemap.xml`. *(Más adelante.)*
- [ ] En el navegador del ordenador, el Asistente de la web publicada también llega a Ollama. Si Chrome pide el permiso de «acceso a la red
  local», acéptalo.

## 4b. Avisos push (≈ 20 min)

Pasos 1–8 de [gotchas/web › Web Push](gotchas/web.md#publicar-la-pwa-y-activar-web-push-pasos-manuales). El código está montado desde el
28 de octubre; nada de esto se ha hecho todavía.
- [ ] Generar las claves VAPID en tu equipo (`npx web-push generate-vapid-keys`) y guardarlas en tu gestor de contraseñas.
- [ ] Aplicar la migración `20261028180000_push_subscriptions` (y alinear la versión si usas `apply_migration`).
  Justo después, `20261029180000_require_mfa_push` (la política del segundo factor en sus dos tablas) y comprobar que hay
  tantas políticas `require_mfa` como tablas de `public` con RLS más una (hoy, 19 = 18 + 1, con `oauth_mfa_grants`).
- [ ] Secretos de la función: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:…`).
- [ ] `pnpm --filter @muninn/core build:edge` y desplegar `push` con `--no-verify-jwt`.
- [ ] `VITE_VAPID_PUBLIC_KEY` (la pública) en Vercel, Production y Preview, y volver a desplegar la web.
- [ ] Programar el cron `muninn-push-charges` (`0 7 * * *`).
- [ ] Comprobar: `curl -X POST` a `/push/send` sin secreto da 401 y con el secreto responde `{ users, results, pruned }`.

## 4c. CAPTCHA de la entrada (≈ 20 min)

El código está montado desde el 28 de octubre (ADR-0060); nada de esto se ha hecho todavía. Pasos de
[gotchas/web › CAPTCHA](gotchas/web.md#captcha-de-la-entrada-turnstile-pasos-manuales). **Hazlo antes de abrir el registro.**
- [ ] Cloudflare › Turnstile › *Add widget*: modo **Managed** (o *Invisible*), con los *hostnames* `muninn-sepia.vercel.app` (y el
  dominio propio si lo hay), `localhost` y `tauri.localhost`. Guarda la clave del sitio y la secreta en tu gestor de contraseñas.
- [ ] `VITE_TURNSTILE_SITE_KEY` (la del sitio) en Vercel, Production y Preview, y en `apps/web/.env.local`. Vuelve a desplegar.
- [ ] Comprobar en la web publicada que el widget carga (el botón pasa de «Comprobando…» a «Enviar código») **antes** del paso siguiente.
- [ ] Supabase › Authentication › Attack Protection › *Enable Captcha protection*: proveedor **Turnstile** y la clave **secreta**.
- [ ] Comprobar:
  - entrar con el código del correo en la web publicada funciona, y **Reenviar código** también;
  - en la app de escritorio (Windows: `http://tauri.localhost`; macOS: `tauri://localhost`) el widget carga y se entra;
  - en la PWA del iPhone se entra;
  - con `curl` a `/auth/v1/otp` sin `gotrue_meta_security.captcha_token`, Supabase responde `captcha_failed`.
- [ ] Si en macOS el widget falla por el origen `tauri://`, apúntalo como tarea (ver gotchas/desktop).

## 4d. Seguridad de la cuenta (≈ 20 min)

Ajustes › Cuenta ([ADR-0061](adr/0061-seguridad-de-la-cuenta.md), guía [Cuenta y seguridad](user/14-cuenta-y-seguridad.md)). Con la web
y el iPhone con la sesión abierta. **29 de octubre:** probado en la vista previa de `develop` (`https://muninn-git-develop-kodemaru.vercel.app`,
pide sesión de Vercel; `main` aún no tiene esta pantalla), contra la base de producción.
- [x] Aplicar **juntas** las migraciones `20261029120000_account_sessions` y `20261029150000_aal2_en_el_servidor` ([ADR-0062](adr/0062-aal2-para-integraciones-sensibles.md)),
  en ese orden (y alinear las versiones si usas `apply_migration`). La segunda no se ha probado contra la base: antes, en el editor SQL,
  la prueba de [gotchas/db › Probar el segundo factor en el servidor](gotchas/db.md#probar-el-segundo-factor-en-el-servidor).
  *(29 de octubre. La prueba, en un bloque `DO` que acaba con `raise exception`, pasa entera: con factor y `aal1`, 0 proyectos y
  `list_my_sessions`/`revoke_my_session`/`insert` fallan con 42501; con `aal2`, ve lo suyo y vincula; sin factor y `aal1`, ve, renombra
  y desvincula pero no vincula; 16 políticas `require_mfa` = 15 tablas + `storage.objects`. Aplicadas desde el editor SQL, con la versión
  registrada a mano en `schema_migrations` (el MCP de Supabase rechazaba escribir). `get_advisors`: solo tres avisos nuevos,
  intencionados, de funciones `security definer` ejecutables por `authenticated` (`list_my_sessions`, `revoke_my_session`, `mfa_satisfied`).)*
- [ ] Aplicar después `20261029170000_sesiones_con_app` (nombre de la app OAuth en la lista). Comprobar en el editor SQL, con el
  `sub` y `session_id` de tu usuario, que `select * from list_my_sessions()` trae `app_name` = «Claude» en las de claude.ai y que
  `list_my_sessions` sigue con `execute` solo para `authenticated`. En la app, esas sesiones salen como **Claude · app conectada**.
- [ ] **Escritorio:** con una versión que traiga la marca `Muninn/<versión>` (la siguiente a la 0.4.0), cierra sesión y vuelve a entrar:
  la sesión sale como **Muninn para Windows** (o **Muninn para Mac**), no como «Windows · Edge».
- [x] **Sesiones:** en el ordenador, **Sesiones y dispositivos** lista el ordenador con la marca **Este** y el iPhone, cada uno con su
  última actividad. Una sesión de otro usuario no sale nunca (prueba con la consulta de «Probar RLS sin crear usuarios»:
  `select * from list_my_sessions()` con otro `sub` devuelve 0 filas). *(Sí; lo de otro usuario lo cubre la prueba SQL. Fallo: la app de
  escritorio sale como «Windows · Edge» y claude.ai como «Dispositivo desconocido» → PR #74.)*
- [x] **Cerrar** en la fila del iPhone: sale el aviso y desaparece de la lista; en menos de una hora el iPhone vuelve a la pantalla de
  entrada. *(Probado cerrando varias sesiones una a una. Ojo: cerrar la de claude.ai invalida el conector, hay que reconectarlo.)*
- [ ] Vuelve a entrar en el iPhone y pulsa **En los demás** en el ordenador: el ordenador sigue dentro y el iPhone sale. *(Sin probar a
  propósito: también cierra el conector de claude.ai.)*
- [ ] **En todos**: el ordenador vuelve a la pantalla de entrada con el aviso; el iPhone sale en menos de una hora. *(Igual.)*
- [x] **Segundo factor:** en Supabase, **Authentication › Multi-Factor**, comprueba que *TOTP (App Authenticator)* está activado (lo
  está por defecto). Si no, «Activar» dice «El segundo factor no está activado en este servidor».
- [x] En Ajustes › Cuenta › **Segundo factor**, «Activar»: sale el QR; escanéalo con tu app de códigos (o teclea la clave) y guarda la clave
  en tu gestor de contraseñas. Un código equivocado da «El código no es correcto…»; el bueno, «Segundo factor activado».
- [x] Cierra sesión y entra con el código del correo: sale **Falta un paso** y no deja ir a ninguna pantalla sin el código de la app. Con
  el código, entras donde ibas. Lo mismo entrando con GitHub. *(Con el correo; GitHub no se probó.)*
- [ ] En el iPhone (sesión abierta de antes de activarlo): al volver a abrir la app (como mucho, una hora después) pide el código.
- [x] «Usar otra cuenta» en **Falta un paso** vuelve al formulario sin entrar.
- [x] **Desactivar** con un código equivocado no lo quita; con el bueno, sí, y al volver a entrar ya no pide el código. *(Al desactivarlo,
  el conector de claude.ai también quedó invalidado y hubo que reconectarlo.)*
- [ ] Con el segundo factor activado, la pantalla de autorización OAuth (`/oauth/consent`) también pide antes el código. *(Pendiente: la
  *Site URL* sirve `main`, que aún no lo tiene. Repetir cuando `develop` pase a `main`.)*
- [ ] **Entrar con GitHub pide el código** (arreglo del 31 de octubre, tras publicarlo y recargar dos veces): con el factor activado,
  cierra sesión y entra con GitHub: sale **Falta un paso**, no la app. En el registro de Supabase, tras `token?grant_type=pkce` hay
  un `GET /user` y, al escribir el código, `factors/…/challenge` y `verify`. *(30 de octubre: entró directo, con la sesión en `aal1`.)*
- [ ] **`/oauth/consent` con GitHub y el segundo factor:** desde claude.ai, quita el acceso a Claude y reconecta entrando con GitHub.
  Antes de **Permitir acceso** sale **Falta un paso** («Escribir el código» lleva al código y vuelve a la solicitud). Al permitir, el
  aviso es solo «Volviendo a claude.ai…» y en el registro hay `rpc/approve_oauth_client_mfa` antes de `…/consent`. Si saliera «quítale
  el acceso y vuelve a conectarla», la aprobación no quedó apuntada: mira la respuesta de la RPC.
- [x] **Servidor (ADR-0062), con el segundo factor activado:** en claude.ai, «¿Qué tareas tiene Muninn?» sigue respondiendo. Si
  responde vacío o con error de permisos, sus tokens son `aal1`: quita el acceso en **Apps con acceso**, vuelve a conectar el conector
  (el consentimiento pide el código) y repite. Si aun así falla, apúntalo como tarea: el MCP remoto necesita otra salida.
  *(**Falla.** Con el factor activado, el MCP responde «Proyecto … no existe». Reconectado después de activarlo, la sesión OAuth nueva
  sigue siendo `aal1`: el servidor OAuth no hereda el `aal2`. Al desactivarlo, vuelve. Tarea «El MCP remoto no ve datos con el
  segundo factor activado»: necesita un ADR que complemente a ADR-0062. Mientras, no activar el segundo factor si se usa el MCP.)*
- [x] **Apps aprobadas con el segundo factor ([ADR-0064](adr/0064-apps-oauth-aprobadas-con-segundo-factor.md), [ADR-0066](adr/0066-aprobacion-oauth-atada-a-una-sesion.md)),
  migración:** antes, en el editor SQL, `begin;` + la migración `20261029200000_oauth_mfa_grants` + `supabase/tests/oauth_mfa_grants.sql`:
  acaba en «RESULTADO 1:false 2:false 2b:true 2c:42501 3:true 4:1 4b:42501 5:0 6:0 7:0 7b:0 8:1 9:1 9b:0» y no deja nada. Después,
  aplicarla (y alinear la versión). *(29 de octubre: la prueba da justo eso y no deja nada; aplicada desde el editor SQL con la versión
  registrada en la misma consulta. Comprobado: tabla con RLS y sus tres políticas, las cuatro funciones de `postgres`, el trigger
  `oauth_mfa_grants_bind` activo en `auth.sessions`, `anon` sin `execute` en `approve_oauth_client_mfa` y `authenticated` sin `insert`; 17
  políticas `require_mfa`. `get_advisors`: dos funciones `security definer` nuevas ejecutables por `authenticated`, intencionadas, y dos
  claves ajenas sin índice en una tabla de una fila por app. Ojo: al copiarla con PowerShell 5.1, `Get-Content` sin `-Encoding UTF8`
  rompe las tildes.)*
- [ ] **Apps aprobadas con el segundo factor, con claude.ai, cuando `develop` esté en `main`:** con el factor activado, en **Apps con
  acceso**, quitar claude.ai; reconectar el conector (el
  consentimiento pide el código); «¿Qué tareas tiene Muninn?» responde con tus datos y `select * from oauth_mfa_grants` tiene una fila
  con `session_id` = el de la sesión de claude.ai en Sesiones y dispositivos. Si `session_id` queda vacío, mira los avisos de Postgres
  (`bind_oauth_mfa_grant`): Supabase puede haber cambiado sus tablas.
  Quitar otra vez el acceso: la fila desaparece y el conector deja de ver datos al momento.
- [ ] Vincular un repo en Ajustes › Integraciones funciona con el segundo factor. Desactívalo, vuelve a entrar e intenta vincular otro:
  sale «Para conectar GitHub necesitas el segundo factor» y no se guarda. Quitar un repo sí deja. La sincronización (`github`) sigue igual.
  *(Sin probar: huginnDB no se deja vincular porque lo retiene el proyecto archivado «Muninn» → tarea «Un proyecto archivado sigue
  reteniendo su repo de GitHub». La regla del servidor sí la cubre la prueba SQL.)*
- [ ] **Apps con acceso** (necesita el paso 6 o 7: una app conectada por OAuth): sale claude.ai (o Claude Code) con la fecha y su web.
  **Quitar acceso**: desaparece y esa app deja de poder usar el MCP (pide volver a conectar). Sin ninguna app, dice «Ninguna».

## 5. iPhone (≈ 45 min)

Instala la PWA desde Safari (Compartir › Añadir a pantalla de inicio) y entra con tu cuenta.
- [ ] Pasa entera la [lista de pruebas del iPhone](pruebas-iphone.md): instalar, teclado, gestos del tablero, pestañas y sin conexión.
- [ ] Vista **Lista** en un proyecto:
  - la casilla de cada fila se toca bien y completa con «Deshacer»;
  - al cerrar y abrir la app sigue en Lista, y en el ordenador sigue en Tablero;
  - la cabecera ocupa dos filas y los tres iconos de vista (junto a «‹ Proyectos») se tocan sin fallar.
- [ ] Vista **Calendario** en un proyecto:
  - tocar un día enseña sus tareas; mantener pulsada una abre «Cambiar fecha» (no el menú de enlace de Safari) y «Mañana» la mueve con
    «Deshacer»;
  - «Otra fecha» abre la rueda de iOS, y deslizar a la izquierda completa;
  - «Ver el mes», cerrar la app y volver a abrir el proyecto: sigue con el mes desplegado.
- [ ] Finanzas:
  - «Nuevo movimiento» se abre desde abajo;
  - el importe saca el teclado decimal y no hace zoom;
  - lo apuntado en el iPhone aparece en el ordenador sin recargar.
- [ ] El Asistente dice que usa el modelo del ordenador y no intenta conectar.
- [ ] Noticias muestra el mismo resumen de hoy que el ordenador.
- [ ] En Noticias, «Abrir» y el título abren el artículo en Safari sin cerrar Muninn, y al volver sale leída. Igual con un enlace de una
  nota y con una imagen adjunta del Asistente.
- [ ] El informe de la mañana se lee en Notas y en el Asistente, y el iPhone no genera ninguno.
- [ ] **Avisos push** (necesita el paso 4b):
  - antes de instalar, en Safari, Ajustes › Notificaciones dice «Añade Muninn a tu pantalla de inicio»;
  - con la app instalada y abierta desde el icono, activa **Avisos en este dispositivo** y pulsa **Permitir**: sale en Dispositivos como
    «iPhone · App» con la marca **Este**;
  - **Enviar prueba**: llega «Los avisos funcionan en este dispositivo» con la app cerrada, y al tocarlo abre Ajustes › Notificaciones;
  - crea una suscripción «Prueba final» que se cobre **mañana** y lanza el cron a mano (el `curl` del paso 4b): llega «Mañana te cobran
    Prueba final · …» y al tocarlo abre Finanzas › Suscripciones. Lanzarlo otra vez no lo repite. Archiva la suscripción al acabar;
  - en el ordenador, quita el iPhone de la lista y pulsa **Deshacer**: vuelve, y «Enviar prueba» sigue llegando.

## 6. OAuth del MCP remoto con Claude Code (≈ 10 min)

Ya con la *Site URL* publicada:
- [ ] `claude mcp add --transport http muninn-remoto https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/mcp`, sin cabecera.
- [ ] En una sesión interactiva, `/mcp` › muninn-remoto › *Authenticate*:
  - abre `/oauth/consent` en la web publicada;
  - tras «Permitir acceso», lista tus proyectos.

  Con esto queda probada la pantalla de consentimiento con una solicitud real.
- [ ] Al acabar: `claude mcp remove muninn-remoto`.

## 7. claude.ai (cuando Edgar dé el permiso)

[gotchas/mcp](gotchas/mcp.md#mcp-remoto-pasos-manuales), paso 5.
- [ ] Ajustes › Conectores › Añadir conector personalizado con la URL de `mcp`:
  - te lleva a `/oauth/consent`;
  - «Permitir acceso» vuelve a claude.ai;
  - el conector lista tus proyectos;
  - el conector sale con el logo de Muninn, no con el de Supabase (con el `mcp` redesplegado del paso 2; si ya estaba conectado,
    quítalo y vuelve a añadirlo). Si sigue el de Supabase, apúntalo en [gotchas/mcp](gotchas/mcp.md#el-conector-sale-con-el-icono-de-supabase):
    queda servir el MCP desde un dominio de Muninn, que necesita ADR.

  Si no consigue registrarse, el plan B son tokens personales de Muninn (Backlog).
- [ ] Lo mismo desde la app de Claude en el iPhone.

## 8. Al día siguiente (sin hacer nada la noche anterior)

- [ ] **Por la mañana, con el ordenador aún apagado:** en el iPhone hay artículos nuevos en Noticias. Así se comprueba que el cron funciona
  sin el ordenador.
- [ ] **Al encender el ordenador**, ya pasada la hora del informe:
  - al abrir Muninn, el informe se hace solo y dice a qué hora;
  - el de ayer ya no está fijado.

## 9. Cerrar

- [ ] Archivar los datos «Prueba final …» (tareas, cuentas, suscripción) y quitar las fuentes de prueba que no quieras.
- [ ] Poner al día el ROADMAP: marcar en Pruebas finales lo que ha pasado, apuntar el resultado del banco y abrir tareas con lo que falló.
- [ ] Pasar `develop` → `main` (tuyo) y, si en el paso 0 publicaste `develop`, cambiar en Vercel la *Production Branch* a `main`.
  release-please abrirá un Release PR: **no lo fusiones** hasta acabar los pasos 1–4 del 10, o la release de escritorio fallará.

## 10. Repo público y primera versión de escritorio (≈ 1 h, la mitad esperando a GitHub Actions)

Decisiones en [ADR-0046](adr/0046-repo-publico-con-licencia-mit.md) (repo público) y [ADR-0047](adr/0047-actualizaciones-de-escritorio-firmadas.md)
(actualizador). Hasta ahora la app de escritorio solo se puede compilar a mano; esto publica la primera versión instalable y deja listas las
actualizaciones.

1. **Hacer público el repo.**
   - [ ] Antes, repasa por encima las issues y los PRs (también se verán) y los registros de Actions. El historial de código ya está
     revisado: no hay secretos.
   - [ ] GitHub › `lopezz-dev/muninn` › **Settings › General › Danger Zone › Change visibility › Public**.
   - [ ] **Settings › Advanced Security:** activa *Private vulnerability reporting*, *Secret scanning* y *Push protection*.
2. **Clave de firma del actualizador** (en PowerShell, en la raíz del repo):
   - [ ] `pnpm --filter @muninn/desktop tauri signer generate -w $HOME\.tauri\muninn.key`. Elige una contraseña.
   - [ ] Guarda `muninn.key` y la contraseña en tu gestor de contraseñas. **Si se pierden, ninguna instalación aceptará más
     actualizaciones** y habrá que reinstalar a mano en cada equipo.
3. **Secretos en GitHub:**
   - [ ] `Get-Content $HOME\.tauri\muninn.key -Raw | gh secret set TAURI_SIGNING_PRIVATE_KEY -R lopezz-dev/muninn`
   - [ ] `gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD -R lopezz-dev/muninn` (te pide la contraseña sin mostrarla).
   - [ ] Variables (no secretos: son públicas) con la URL y la clave publicable de Supabase, las mismas que en Vercel:
     `gh variable set VITE_SUPABASE_URL -R lopezz-dev/muninn` y `gh variable set VITE_SUPABASE_PUBLISHABLE_KEY -R lopezz-dev/muninn`.
     Sin ellas la app instalada solo ofrece el modo demo, y la release se para antes de compilar.
4. **Clave pública en la app:**
   - [ ] Copia el contenido de `$HOME\.tauri\muninn.key.pub` (una línea; no es secreta) en `plugins.updater.pubkey` de
     `apps/desktop/src-tauri/tauri.conf.json`, en lugar de `PENDIENTE_CLAVE_PUBLICA_DE_TAURI_SIGNER_GENERATE`. PR a `develop` con
     `chore(desktop): clave pública del actualizador` (o pásale el `.pub` a Claude y que lo haga). Después, `develop` → `main` otra vez.
5. **Publicar:**
   - [ ] Fusiona el Release PR de release-please (`chore(main): release 0.x.0`).
   - [ ] En **Actions › Release**, en verde: `release-please`, `back-merge` y los tres `desktop` (macOS es el que más tarda).
   - [ ] En la release: `Muninn_<versión>_x64-setup.exe`, el `.dmg`, `Muninn_universal.app.tar.gz`, el `.AppImage`, el `.deb` y el `.rpm`, un `.sig`
     junto a cada instalador que se actualiza, y `latest.json` con una `signature` no vacía en cada plataforma.
   - [ ] Sin sesión (otra ventana o `curl -L https://github.com/lopezz-dev/muninn/releases/latest/download/latest.json`) se descarga
     `latest.json`: el repo es público de verdad.
6. **Instalar en Windows:**
   - [ ] Si tienes una versión compilada a mano, desinstálala (Configuración › Aplicaciones). Esa no se actualiza nunca.
   - [ ] Instala el `-setup.exe` siguiendo [la guía](user/02-instalacion.md#windows) y entra con tu cuenta. En la barra lateral sale la versión
     publicada.
7. **Probar la actualización**, cuando salga la siguiente versión (cualquier `fix` que llegue a `main` y su Release PR):
   - [ ] Al abrir Muninn sale «Hay una versión nueva · Reiniciar» con el número nuevo. Pulsa **Reiniciar**: se instala sin pedir
     administrador, Muninn se vuelve a abrir y la barra lateral enseña la versión nueva. Sigues con la sesión iniciada.
   - [ ] Sin conexión, al abrir no sale ningún aviso ni error.

## Después (trabajo de código que necesita lo anterior)

No son pasos manuales; pídeselos a Claude cuando lo de arriba esté hecho.
- **Voz (F4):** implementar [ADR-0044](adr/0044-voz-local-whisper-y-piper.md) si lo aceptas. Para probarla, instala whisper.cpp, Python y Piper
  ([gotchas/desktop](gotchas/desktop.md#instalar-la-voz-whispercpp-y-piper-pasos-manuales-cuando-se-implemente)).
