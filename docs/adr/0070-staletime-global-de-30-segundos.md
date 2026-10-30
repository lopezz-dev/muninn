# ADR-0070: Lo leído vale 30 segundos (`staleTime` global en react-query)

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Área:** web

## Contexto

El `QueryClient` de la web usaba los valores por defecto de react-query, con `staleTime: 0`: todo lo leído
caducaba al instante. Cada vez que se montaba una pantalla (ir de Inicio al tablero y volver, abrir y cerrar una
tarea) se repetía la petición, aunque los datos fueran de hace un segundo.

Ese refresco tan agresivo tenía sentido antes del tiempo real. [ADR-0025](0025-escrituras-optimistas-y-deshacer.md)
lo dice: «la caché se refresca al volver a la pestaña». Desde [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md),
los cambios de otros dispositivos llegan por Supabase Realtime e **invalidan** la caché. Al reconectar se invalida todo.

## Decisión

- `queryClient` (`lib/query-client.ts`) usa `staleTime: 30_000` (`STALE_TIME`) para todas las consultas. Las que
  ya tenían el suyo (imagen de proyecto, repos de GitHub, ⌘K) lo conservan.
- `refetchOnWindowFocus` y `refetchOnReconnect` se quedan como vienen (`true`): al volver a la pestaña se refresca
  lo que tenga más de 30 s. Es la red de seguridad de ADR-0025 si el canal de tiempo real se ha caído sin avisar.
- Las escrituras siguen terminando con `invalidateQueries`, igual que el tiempo real. Invalidar marca la consulta
  como caducada sin esperar al `staleTime`, así que lo propio y lo ajeno se ven al momento.

## Alternativas consideradas

- **Dejar `staleTime: 0`:** una petición por montaje que el tiempo real hace innecesaria.
- **`staleTime` mayor (minutos):** si el canal de tiempo real se cae (p. ej. el iPhone suspende la PWA), al volver a la
  pestaña se verían datos viejos durante más tiempo. 30 s ahorra casi todas las repeticiones de la navegación normal.
- **`refetchOnWindowFocus: 'always'`:** mantendría el refresco al volver aunque no haya caducado, pero también
  refrescaría las consultas que tienen un `staleTime` largo a propósito.

## Consecuencias

- Navegar entre pantallas ya no repite peticiones durante 30 s.
- Lo que no pasa por el tiempo real (`activity`, datos de GitHub) puede tardar hasta 30 s en verse al volver a la
  pestaña, salvo que una escritura propia lo invalide.
- La caché recuperada de IndexedDB conserva su hora de lectura: al abrir la app ya está caducada y se refresca.
- Relacionado: [ADR-0025](0025-escrituras-optimistas-y-deshacer.md), [ADR-0029](0029-tiempo-real-y-cache-sin-conexion.md),
  [gotchas/web](../gotchas/web.md), `test/query-client.test.ts`.
