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
