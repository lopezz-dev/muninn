# ADR-0004: Multiusuario con `owner_id` y RLS desde el día uno

- **Estado:** Aceptado
- **Fecha:** 2026-10-19
- **Área:** db

## Contexto

Hoy hay un único usuario, pero existe la posibilidad de vender Muninn. Añadir el aislamiento por
usuario a posteriori obliga a migrar todos los datos y revisar todas las consultas.

## Decisión

- Toda tabla de datos tiene `owner_id uuid not null default auth.uid()` con FK a `auth.users`.
- RLS activado en todas, con una política `owner_id = (select auth.uid())` para el rol `authenticated`.
- Los stores escriben y filtran siempre con `owner_id` explícito, porque con la *service role key*
  (MCP, servidor) `auth.uid()` es `null`.
- La integridad entre tablas que RLS no cubre se refuerza con triggers (`enforce_task_consistency`).

## Alternativas consideradas

- **Esquema monousuario y migrar si se vende:** más simple hoy, pero mucho más caro después.
- **Un schema o base de datos por cliente:** demasiado pronto para ese nivel de aislamiento.

## Consecuencias

- Convertirlo en SaaS no exige rehacer el esquema.
- Toda tabla nueva debe seguir el patrón: ver [gotchas/db](../gotchas/db.md).
- `(select auth.uid())` en lugar de `auth.uid()` evita que se evalúe en cada fila.
