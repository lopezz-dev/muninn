import { useSyncExternalStore } from 'react'

/** Suscripción a una media query. En el cliente da el valor correcto desde el primer render. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mq = matchMedia(query)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

/** Mismo corte que el shell (ADR-0021): barra lateral a partir de 768 px. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
