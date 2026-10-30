import { QueryClient } from '@tanstack/react-query'

/**
 * Lo leído vale 30 s (ADR-0070): volver a una pantalla no repite la petición. Lo que cambia en otro
 * dispositivo lo trae el tiempo real invalidando la caché (ADR-0029), y eso no espera al `staleTime`.
 */
export const STALE_TIME = 30_000

/** Caché de datos de la UI. Se vacía al cambiar de usuario: lo de uno no puede verse en la sesión de otro. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: STALE_TIME } },
})
