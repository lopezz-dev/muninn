import { QueryClient } from '@tanstack/react-query'

/** Caché de datos de la UI. Se vacía al cambiar de usuario: lo de uno no puede verse en la sesión de otro. */
export const queryClient = new QueryClient()
