import type { ChatProvider, ProviderStatus } from '@muninn/assistant'
import { useCallback, useEffect, useState } from 'react'

/** Cada cuánto se vuelve a mirar si Ollama ya está listo, mientras no lo esté. */
const RETRY_MS = 8000

/** Un móvil o tableta (sin Tauri): ahí no hay modelo local (ADR-0041), así que ni se intenta. */
export const isHandheld = () =>
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) &&
  !import.meta.env.TAURI_ENV_PLATFORM

export type AssistantAvailability = ProviderStatus | { state: 'checking' } | { state: 'handheld' }

/** Estado del proveedor: lo comprueba al entrar y, si no está listo, cada pocos segundos (o al pulsar «Reintentar»). */
export function useProviderStatus(provider: ChatProvider | null) {
  const [status, setStatus] = useState<AssistantAvailability>(() =>
    provider ? { state: 'checking' } : { state: 'handheld' },
  )
  const [tick, setTick] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` fuerza una comprobación nueva
  useEffect(() => {
    if (!provider) {
      setStatus({ state: 'handheld' })
      return
    }
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      const s = await provider.status()
      if (!alive) return
      setStatus(s)
      if (s.state !== 'ready') timer = setTimeout(check, RETRY_MS)
    }
    void check()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [provider, tick])

  const retry = useCallback(() => {
    setStatus({ state: 'checking' })
    setTick((t) => t + 1)
  }, [])
  return { status, retry }
}
