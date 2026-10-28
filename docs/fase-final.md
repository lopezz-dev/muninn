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

## 5. iPhone (≈ 45 min)

Instala la PWA desde Safari (Compartir › Añadir a pantalla de inicio) y entra con tu cuenta.
- [ ] Pasa entera la [lista de pruebas del iPhone](pruebas-iphone.md): instalar, teclado, gestos del tablero, pestañas y sin conexión.
- [ ] Vista **Lista** en un proyecto:
  - la casilla de cada fila se toca bien y completa con «Deshacer»;
  - al cerrar y abrir la app sigue en Lista, y en el ordenador sigue en Tablero.
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
