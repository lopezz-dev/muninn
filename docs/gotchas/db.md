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

### SMTP de serie: solo envía al equipo y con límite

- **Síntoma:** `Email address not authorized` al pedir el código con un correo cualquiera, o
  `over_email_send_rate_limit` tras unos pocos intentos.
- **Causa:** sin SMTP propio, Supabase solo envía a los miembros del equipo de la organización y tiene un
  límite bajo de correos por hora.
- **Solución:** para uso propio, entra con el correo de tu cuenta de Supabase. Para abrirlo a más gente,
  configura un SMTP propio en **Authentication › Emails › SMTP Settings**.

### Site URL y Redirect URLs

- **Síntoma:** al volver de GitHub se acaba en `http://localhost:3000` o en la URL equivocada.
- **Causa:** Supabase solo redirige a direcciones de la lista permitida; si no está, usa la *Site URL*.
- **Solución:** en **Authentication › URL Configuration**, *Site URL* con la dirección principal y en
  *Redirect URLs* `http://localhost:5173/**`, `http://localhost:5174/**` y la del despliegue de la PWA.

### Probar RLS sin crear usuarios

- Simula una sesión en SQL dentro de una transacción:
  `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'; select … ; rollback;`
  Con un `sub` que no es el dueño, las consultas devuelven 0 filas y los `insert` con su `owner_id` fallan
  con *new row violates row-level security policy*. Con `set local role anon`, todo devuelve 0 filas.
