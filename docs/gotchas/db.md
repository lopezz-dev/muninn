# Gotchas · db (`supabase/`)

### `position` necesita `collate "C"`

- **Síntoma:** el orden en Postgres no coincide con el de JavaScript.
- **Causa:** la colación por defecto (`en_US.UTF-8` o ICU) ignora mayúsculas y minúsculas al ordenar.
- **Solución:** toda columna de orden se declara como `position text collate "C" not null`.
- **Ref:** [ADR-0006](../adr/0006-orden-con-fractional-indexing.md)

### Con la service role key, `auth.uid()` es `null`

- **Síntoma:** un insert desde el MCP o un servidor falla con `null value in column "owner_id"`, o
  las filas no aparecen en la app.
- **Causa:** `owner_id` usa `default auth.uid()`, que solo existe con la sesión de un usuario.
- **Solución:** los stores pasan siempre `owner_id` explícito (`createSupabaseStore(client, userId)`).
  Nunca dependas del valor por defecto fuera de la UI.
- **Ref:** [ADR-0004](../adr/0004-multiusuario-con-rls.md)

### Checklist para una tabla nueva

1. `owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade`
2. `enable row level security` y una política `owner_id = (select auth.uid())`. Usa `(select …)` para que no se evalúe por fila.
3. Un trigger `set_updated_at` si tiene `updated_at`.
4. Índices que empiecen por `owner_id` o por la FK por la que se filtra.
5. Si debe sincronizarse entre dispositivos: `alter publication supabase_realtime add table …`.
6. Mapearla en `supabase-store.ts`, usando columnas `snake_case` que se convierten a `camelCase` automáticamente.

### No editar migraciones ya aplicadas

- **Síntoma:** el entorno local y el remoto divergen; `supabase db push` se niega o duplica objetos.
- **Solución:** siempre una migración nueva con un timestamp posterior.

### `activity` es de solo inserción

- **Síntoma:** un `update` o `delete` sobre `activity` no afecta a ninguna fila y no da error.
- **Causa:** con RLS, una operación sin política aplicable no ve filas.
- **Solución:** es intencionado ([ADR-0007](../adr/0007-registro-de-actividad.md)). Para limpiar, usa una
  función o un cron con la service role.

### Trigger `enforce_task_consistency`

- **Síntoma:** `column … does not belong to project …` al insertar o mover una tarea.
- **Causa:** la columna destino es de otro proyecto o de otro dueño. El core ya lo valida; el trigger es la última barrera.
- **Solución:** mover una tarea a otro proyecto requerirá una operación específica (no existe todavía).

### `or()` de PostgREST y caracteres especiales

- **Síntoma:** una búsqueda con comas, paréntesis o comillas rompe la consulta.
- **Causa:** esos caracteres forman parte de la sintaxis del filtro `or=(…)`.
- **Solución:** `likeTerm()` en `supabase-store.ts` los elimina. Reutilízala en las búsquedas nuevas.

### `apply_migration` (MCP de Supabase) pone su propia versión

- **Síntoma:** `supabase db push` quiere volver a aplicar una migración que ya está en remoto, o
  `list_migrations` muestra versiones que no coinciden con los ficheros de `supabase/migrations/`.
- **Causa:** la herramienta `apply_migration` registra la migración con la hora actual
  (`20261019115552_init`), no con el timestamp del nombre del fichero.
- **Solución:** tras aplicarla, alinea la versión con el fichero:
  `update supabase_migrations.schema_migrations set version = '<timestamp del fichero>' where name = '<nombre>';`

### Funciones con `search_path` fijo

- **Síntoma:** el asesor de seguridad avisa de *Function Search Path Mutable*.
- **Solución:** toda función lleva `set search_path = ''` y califica los objetos (`public.board_columns`).
  `now()` y demás funciones de `pg_catalog` no necesitan prefijo.

### El correo de acceso lleva el código, no un enlace

- **Síntoma:** al pedir el código llega un correo con un enlace «Log In» y ningún número, o el enlace abre
  Safari en lugar de la PWA.
- **Causa:** las plantillas por defecto de Supabase (*Magic link* y *Confirm sign up*) solo traen
  `{{ .ConfirmationURL }}`. El primer acceso de un correo nuevo usa *Confirm sign up*; los siguientes, *Magic link*.
- **Solución:** en **Authentication › Emails › Templates**, pega `supabase/templates/acceso.html` en *Magic link*
  y `registro.html` en *Confirm sign up*, con los asuntos de `supabase/templates/README.md`. Al cambiarlas, pruébalas
  sirviéndolas con Vite (`http://localhost:5173/@fs/<ruta del repo>/supabase/templates/acceso.html`).
- **Ref:** [ADR-0022](../adr/0022-auth-y-sesion.md)

### Activar GitHub OAuth (paso manual)

- **Síntoma:** en la pantalla de entrada no sale «Continuar con GitHub».
- **Causa:** el botón solo aparece si `GET /auth/v1/settings` dice que GitHub está activado, y eso se configura en el panel de
  Supabase y en GitHub; no se puede hacer desde el código.
- **Solución:**
  1. En GitHub: **Settings › Developer settings › OAuth Apps › New OAuth App**. Nombre «Muninn»; *Homepage URL* = la de la PWA (de
     momento, `http://localhost:5173`); *Authorization callback URL* = `https://yjzzubpxikpvukymgfkt.supabase.co/auth/v1/callback`
     (la misma que enseña Supabase en el paso 2). Registra la app y pulsa **Generate a new client secret**: copia el *Client ID* y el secreto.
  2. En Supabase (proyecto `muninn`): **Authentication › Sign In / Providers › GitHub**: actívalo, pega el *Client ID* y el *Client Secret*
     y guarda.
  3. En **Authentication › URL Configuration**, comprueba que *Redirect URLs* tiene `http://localhost:5173/**`, `http://localhost:5174/**` y la
     dirección de la PWA publicada (ver «Site URL y Redirect URLs»).
  4. Prueba: en la web (no en Tauri) sale «Continuar con GitHub»; al volver, Ajustes › Cuenta dice «GitHub».
- **Ojo:** si el correo de tu cuenta de GitHub es el mismo con el que entras con código, comprueba que ves tus mismos datos; si ves una
  cuenta vacía, Supabase creó un usuario distinto (vincula las identidades en **Authentication › Users**).
- **Ref:** [ADR-0022](../adr/0022-auth-y-sesion.md)

### SMTP de serie: solo envía al equipo y con límite

- **Síntoma:** `Email address not authorized` al pedir el código con un correo cualquiera, o
  `over_email_send_rate_limit` tras unos pocos intentos.
- **Causa:** sin SMTP propio, Supabase solo envía a los miembros del equipo de la organización y tiene un
  límite bajo de correos por hora.
- **Solución:** SMTP propio en **Authentication › Emails › SMTP Settings**. Usamos **Resend** (región eu-west-1):
  host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = API key de Resend con *Sending access*
  solo para el dominio, y remitente `Muninn <no-reply@<dominio verificado>>`. El dominio se verifica en
  Resend con sus registros DNS (MX y SPF en `send.<dominio>`, DKIM en `resend._domainkey`, y un DMARC).
  Con SMTP propio, el límite sube a 30 correos por hora (ajustable en **Authentication › Rate Limits**).
- **Ojo:** sin SMTP propio, el panel tampoco deja guardar las plantillas de correo.

### Realtime: la tabla debe estar en la publicación

- **Síntoma:** una tabla se sincroniza entre dispositivos en unas y en otras no; `user_settings` no lo hacía.
- **Causa:** Supabase Realtime solo emite los cambios de las tablas de `supabase_realtime`. El esquema inicial añadió cinco; los
  ajustes se añadieron después (`20261019150000_realtime_user_settings`).
- **Solución:** `alter publication supabase_realtime add table …` en una migración nueva, con la guarda de la existente
  (si la tabla ya está, `add table` da error). Comprueba con
  `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`. Y añádela a `SYNC_TABLES` en la web.
- **Ojo:** con la identidad de réplica por defecto, un `delete` solo trae la clave primaria; por eso la UI archiva.

### Site URL y Redirect URLs

- **Síntoma:** al volver de GitHub se acaba en `http://localhost:3000` o en la URL equivocada.
- **Causa:** Supabase solo redirige a direcciones de la lista permitida; si no está, usa la *Site URL*.
- **Solución:** en **Authentication › URL Configuration**, *Site URL* con la dirección principal y en
  *Redirect URLs* `http://localhost:5173/**`, `http://localhost:5174/**`, la del despliegue de la PWA y
  `muninn://auth/callback` (GitHub en la app de escritorio, [ADR-0059](../adr/0059-deep-links-para-oauth-en-escritorio.md)).

### Probar RLS sin crear usuarios

- Simula una sesión en SQL dentro de una transacción:
  `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'; select … ; rollback;`
  Con un `sub` que no es el dueño, las consultas devuelven 0 filas y los `insert` con su `owner_id` fallan
  con *new row violates row-level security policy*. Con `set local role anon`, todo devuelve 0 filas.

### `github_outbox` antes que cualquier tarea de GitHub

- **Síntoma:** completar o reabrir una tarea con la insignia GitHub falla con `relation "github_outbox" does not exist` y se deshace.
- **Causa:** el core apunta en `github_outbox` cada cambio de estado de una tarea de GitHub ([ADR-0031](../adr/0031-sync-github-issues-tareas.md)),
  y la tabla llega con la migración `20261020000000_github_outbox`.
- **Solución:** aplica esa migración **antes** de desplegar la función (paso 1 de abajo). Las tareas manuales no tocan la tabla.

### Una Edge Function que llama el navegador necesita CORS

- **Síntoma:** desde la app, `functions.invoke` falla con *Failed to send a request to the Edge Function* (o un error de CORS en la
  consola), pero con `curl` la función responde bien.
- **Causa:** `functions.invoke` manda `Authorization` y `apikey`, así que el navegador hace antes un `OPTIONS` (preflight). Si la función
  no lo contesta con las cabeceras `access-control-allow-*`, el navegador corta la petición. `curl` no hace preflight.
- **Solución:** contesta `OPTIONS` con 204 y pon las mismas cabeceras en todas las respuestas, también en las de error. Mira `cors` en
  `supabase/functions/github/index.ts`. Compruébalo con `curl -i -X OPTIONS <url>`.

### Sincronización con GitHub (pasos manuales)

- **Síntoma:** en Ajustes › Integraciones sale «Aún no ha llegado ninguna issue» aunque el proyecto tenga repositorio.
- **Causa:** la sincronización necesita un token, secretos, una Edge Function desplegada, el webhook en GitHub y un cron; nada de eso se
  puede hacer desde el código ([ADR-0031](../adr/0031-sync-github-issues-tareas.md)).
- **Solución**, en este orden:
  1. **Migración.** Aplica `supabase/migrations/20261020000000_github_outbox.sql` (SQL Editor o `supabase db push`). Si usas `apply_migration`
     del MCP de Supabase, alinea la versión (ver «`apply_migration` pone su propia versión»).
  2. **Token de GitHub.** GitHub › **Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate new token**:
     nombre «Muninn sync», caducidad de un año como mucho (apúntate renovarlo), *Repository access* = **Only select repositories** (los que
     vincules), *Permissions › Repository › Issues* = **Read and write** (*Metadata: Read* se añade solo). Copia el token.
  3. **Secretos de la función.** Supabase (proyecto `muninn`) › **Edge Functions › Secrets** (o `supabase secrets set NOMBRE=valor`):
     - `GITHUB_TOKEN` = el token del paso 2.
     - `GITHUB_WEBHOOK_SECRET` = una cadena aleatoria (`openssl rand -hex 32`).
     - `MUNINN_SYNC_SECRET` = otra cadena aleatoria distinta.
     - `MUNINN_USER_ID` = tu id de usuario (**Authentication › Users**, columna UID).
     - `MUNINN_TIME_ZONE` = `Europe/Madrid` (opcional; es el valor por defecto).
     `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los pone Supabase.
  4. **Desplegar.** Con la CLI de Supabase iniciada (`supabase login`):
     `pnpm --filter @muninn/core build:edge` y después
     `supabase functions deploy github --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt`.
     `--no-verify-jwt` es necesario: GitHub y el cron no mandan un JWT; la función comprueba su propia firma o secreto.
  5. **Webhook.** En cada repo vinculado: **Settings › Webhooks › Add webhook**. *Payload URL* =
     `https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/github/webhook`, *Content type* = `application/json`, *Secret* =
     `GITHUB_WEBHOOK_SECRET`, *Which events* = **Let me select individual events › Issues** (desmarca *Pushes*). Al guardar, en
     **Recent Deliveries** el `ping` debe dar 200.
  6. **Cron.** En **Database › Extensions**, activa `pg_cron` y `pg_net`. En el SQL Editor (cambia `<MUNINN_SYNC_SECRET>`):
     ```sql
     select vault.create_secret('<MUNINN_SYNC_SECRET>', 'muninn_sync_secret');
     select cron.schedule('muninn-github-sync', '*/5 * * * *', $$
       select net.http_post(
         url := 'https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/github/sync',
         headers := jsonb_build_object(
           'content-type', 'application/json',
           'x-muninn-sync-secret',
           (select decrypted_secret from vault.decrypted_secrets where name = 'muninn_sync_secret')
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 30000
       );
     $$);
     ```
  7. **En la app.** Activa el módulo GitHub (Ajustes › Módulos) y vincula el repo en **Ajustes › Integraciones**.
- **Verificar:** lanza una sincronización a mano con
  `curl -X POST -H "x-muninn-sync-secret: <MUNINN_SYNC_SECRET>" https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/github/sync`:
  responde con lo creado por repo (`repos[].created`) y la cola (`outbox`). Los fallos de la función salen en **Edge Functions › github ›
  Logs**; los de la cola, en `github_outbox.last_error` (`select * from github_outbox where processed_at is null`). Las comprobaciones de
  uso real están en la pila «Pruebas finales» del [ROADMAP](../ROADMAP.md).
- **Mantenimiento:** la cola guarda lo procesado. De vez en cuando (o con otro `cron.schedule`):
  `delete from github_outbox where processed_at < now() - interval '30 days';`
- **Selector de repos:** Integraciones pide la lista a `GET /github/repos` ([ADR-0035](../adr/0035-repos-de-github-desde-la-funcion.md)).
  Si sale «No se pudo cargar la lista de repositorios», mira **Edge Functions › github › Logs**: un 401 es que la sesión no es la de
  `MUNINN_USER_ID`; un 500 con `Listar repositorios: 401`, que el token ha caducado. Si sale «El token no tiene acceso a …» al elegir
  un repo, edita el token en GitHub y añade el repo en *Repository access*.
- **Ojo:** la lista trae **todos** los repos públicos de la cuenta aunque el token sea *fine-grained* y no los tenga: todo token lee los
  públicos. Por eso, al elegir uno público, la app pregunta a `GET /github/access?repo=…`, que intenta crear una issue sin título (422 =
  tiene permiso; 403/404 = no). No lo «arregles» filtrando con `permissions` del repo: ese es el permiso del usuario, no el del token.
- **Ojo:** si renombras el repo en GitHub, cambia también su `github_repo` en Integraciones; las tareas ya importadas siguen con el id del
  nombre antiguo y la siguiente sincronización crearía otras nuevas (archiva las viejas).

### Finanzas: la vista de saldos y el límite de 1000 filas

- **Síntoma:** el saldo de una cuenta no cuadra con la lista de movimientos, o la lista se corta en 1000.
- **Causa:** PostgREST devuelve como mucho `max-rows` filas por petición (1000 en Supabase). Sumar en el cliente con una sola petición
  perdería movimientos.
- **Solución:** el saldo lo suma la vista `finance_account_totals` (`security_invoker = true`: RLS de `finance_transactions` manda; sin esa
  opción, la vista vería las filas de todos). La lista de movimientos sin `limit` se pide por páginas de 1000 (`paged` en
  `supabase-store.ts`), ordenada por `date`, `created_at` e `id` para que las páginas no se solapen. Si algún día bajas `max-rows` del
  proyecto por debajo de 1000, baja también `PAGE`.
- **Ojo:** las claves ajenas de `finance_transactions` a cuentas y categorías no tienen `on delete` (`no action`, que se comprueba al
  final de la sentencia): no las cambies a `restrict`, o borrar un usuario fallaría según el orden de la cascada.
- **Ref:** [ADR-0037](../adr/0037-modelo-de-datos-de-finanzas.md)

### Suscripciones: un cobro, un movimiento

- `finance_transactions_subscription_date_uq` es único en `(subscription_id, date)` **entre los movimientos sin archivar**: apuntar el mismo
  cobro dos veces a la vez da `23505`, pero tras archivarlo («Deshacer») se puede volver a apuntar. Si añades otra forma de crear cobros
  (un cron que apunte solo), cuenta con ese índice en lugar de comprobar antes en el cliente.
- **Ref:** [ADR-0038](../adr/0038-suscripciones-avisan-y-se-confirman.md), migración `20261021140000_finance_subscriptions`

### Noticias: descarga con la Edge Function (pasos manuales)

- **Síntoma:** en Noticias, «Actualizar» dice «Las noticias aún no se descargan desde aquí» y no llegan artículos.
- **Causa:** la descarga la hace la Edge Function `news` con un cron ([ADR-0042](../adr/0042-noticias-rss-con-descarga-en-servidor.md)), y está
  **desplegada desde el 26 de octubre** (cron `muninn-news-fetch`, minuto 7 de cada hora). Si vuelve a pasar, revisa que siga
  desplegada y sus logs. Las tablas (`20261022140000_news`) ya están aplicadas (22 de octubre, versión alineada).
- **Solución** (fase final), en este orden:
  1. **Empaquetar:** `pnpm --filter @muninn/core build:edge` (genera `supabase/functions/news/_core/muninn.js`, fuera de git).
  2. **Desplegar** con la CLI (`npx supabase@2 login` una vez):
     `npx supabase@2 functions deploy news --no-verify-jwt --project-ref yjzzubpxikpvukymgfkt --use-api`. `--no-verify-jwt` porque el cron no
     manda JWT; la función comprueba su secreto o la sesión. Usa los secretos que ya existen: `MUNINN_SYNC_SECRET` (el mismo del cron de
     GitHub) y, opcional, `MUNINN_TIME_ZONE`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los pone Supabase.
  3. **Probar a mano:** `curl -X POST -H "x-muninn-sync-secret: <MUNINN_SYNC_SECRET>" https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/news/fetch`
     responde `{ users, results: [{ sources, added, notModified, errors }], pruned }`. Sin secreto ni sesión, 401.
  4. **Cron cada hora** (en el SQL Editor; `pg_cron`, `pg_net` y el secreto `muninn_sync_secret` del Vault ya existen por GitHub):
     ```sql
     select cron.schedule('muninn-news-fetch', '7 * * * *', $$
       select net.http_post(
         url := 'https://yjzzubpxikpvukymgfkt.supabase.co/functions/v1/news/fetch',
         headers := jsonb_build_object(
           'content-type', 'application/json',
           'x-muninn-sync-secret',
           (select decrypted_secret from vault.decrypted_secrets where name = 'muninn_sync_secret')
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 60000
       );
     $$);
     ```
  5. **En la app:** activa Noticias (Ajustes › Módulos), añade una fuente y pulsa «Actualizar»: llegan los artículos y la fuente pierde el
     aviso en rojo. Los errores de una fuente se ven bajo su nombre (`news_sources.last_error`); los de la función, en **Edge Functions ›
     news › Logs**.
- **Ojo:** el cron borra los artículos **no guardados** de más de 30 días y los resúmenes de más de 120 (`pruneNews`). Es la única limpieza
  automática de datos de usuario: si cambias los plazos, cambia también el ADR.

### Noticias: un artículo repetido no entra, aunque cambie el título

- `news_items` es único por `(source_id, guid)`: si la fuente edita un artículo (título o resumen), Muninn conserva el primero. Es a
  propósito (el `guid` es lo estable). Si una fuente no da `guid` ni `id`, el enlace hace de id: si cambia el enlace, sale otro artículo.

### Storage: la primera carpeta de la ruta es el dueño

- **Síntoma:** subir una imagen de proyecto falla con `new row violates row-level security policy`, o
  `createSignedUrl` devuelve `Object not found` aunque el archivo existe.
- **Causa:** las políticas de `storage.objects` del bucket `project-images` comparan
  `(storage.foldername(name))[1]` con `auth.uid()`. Una ruta que no empiece por el id del usuario no se puede escribir ni
  leer, y con la service role key `auth.uid()` es `null`.
- **Solución:** sube siempre con la sesión del usuario y con la ruta `<owner_id>/<project_id>/<archivo>`
  (`projectImages.upload` en `supabase-store.ts` ya la construye). Un bucket nuevo necesita sus propias políticas en
  una migración: Storage no hereda las de las tablas.
- **Ref:** [ADR-0055](../adr/0055-imagen-de-proyecto-en-storage.md)

### Sesiones de la cuenta: `auth.sessions` solo con las funciones

- **Síntoma:** Ajustes › Cuenta dice «No se pudo cargar la lista de sesiones», o la consola muestra
  `Could not find the function public.list_my_sessions`.
- **Causa:** el cliente no puede leer `auth.sessions` (el esquema `auth` no está expuesto). La lista y el cierre van por
  `list_my_sessions()` y `revoke_my_session(uuid)`, `security definer` y limitadas a `auth.uid()`
  (migración `20261029120000_account_sessions`). Sin la migración aplicada no existen.
- **Solución:** aplica la migración. Si cambias las funciones, que sigan sin devolver tokens y filtrando por `auth.uid()`, con
  `execute` solo para `authenticated`.
- **Ojo:** cerrar una sesión borra su fila y sus *refresh tokens*, pero su token de acceso sigue valiendo hasta que caduca (una hora
  como mucho, el *JWT expiry* del proyecto). Por eso la app dice «saldrá en menos de una hora». `is_current` compara con el claim
  `session_id` del JWT de quien pregunta.
- **Ref:** [ADR-0061](../adr/0061-seguridad-de-la-cuenta.md)

### Segundo factor: lo pide la app, RLS no lo mira

- **Síntoma:** con el segundo factor activado, una petición a la API con un token recién sacado del código del correo (`aal1`) sigue
  leyendo y escribiendo datos.
- **Causa:** las políticas solo comparan `owner_id` con `auth.uid()`; ninguna mira `auth.jwt() ->> 'aal'`. El código de la app lo exige la
  web al entrar (estado `mfa` en `getAuth()`), no el servidor.
- **Solución:** es lo previsto por ahora ([ADR-0061](../adr/0061-seguridad-de-la-cuenta.md)). Exigirlo en RLS está propuesto en
  [ADR-0062](../adr/0062-aal2-para-integraciones-sensibles.md): no lo añadas a una tabla suelta sin comprobar antes qué `aal` llevan los
  tokens del MCP remoto.
- **Ojo:** MFA TOTP se activa en **Authentication › Multi-Factor** (lo está por defecto). Quitar un factor confirmado exige una sesión
  `aal2`; por eso «Desactivar» pide un código antes.
