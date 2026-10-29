import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * CAPTCHA de la entrada con Cloudflare Turnstile (ADR-0060). Supabase Auth valida el token con la
 * clave secreta del proyecto; aquí solo va la clave pública del sitio. Sin ella no hay widget y el
 * formulario funciona como siempre (entornos locales y demo).
 */
export const captchaSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || null

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Lo que usamos de `window.turnstile`. */
interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let script: Promise<Turnstile> | null = null

/** Descarga el script de Turnstile una sola vez. Si falla, el siguiente intento lo vuelve a pedir. */
export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  script ??= new Promise<Turnstile>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_URL
    el.async = true
    el.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no cargó'))
    el.onerror = () => {
      el.remove()
      reject(new Error('Turnstile no cargó'))
    }
    document.head.append(el)
  }).catch((err) => {
    script = null
    throw err
  })
  return script
}

/** Opciones de Supabase Auth con el token, si lo hay. */
export function captchaOptions(token: string | null | undefined): { captchaToken?: string } {
  return token ? { captchaToken: token } : {}
}

/**
 * `off`: sin clave, no hace falta token. `loading`: el script o la comprobación no han terminado.
 * `ready`: hay token. `error`: no cargó o Cloudflare no pudo comprobar; se reintenta con `retry`.
 */
export type CaptchaStatus = 'off' | 'loading' | 'ready' | 'error'

/**
 * Monta el widget en el contenedor `ref`. Modo `interaction-only`: casi siempre es invisible y
 * solo pide un clic si Cloudflare duda. El token es de un solo uso: llama a `reset` tras cada envío.
 */
export function useCaptcha(siteKey: string | null = captchaSiteKey) {
  const ref = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<CaptchaStatus>(siteKey ? 'loading' : 'off')
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` vuelve a montar el widget al reintentar
  useEffect(() => {
    if (!siteKey || !ref.current) return
    let cancelled = false
    const el = ref.current
    setStatus('loading')
    loadTurnstile()
      .then((t) => {
        if (cancelled) return
        widget.current = t.render(el, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          theme: 'auto',
          language: 'es',
          size: 'flexible',
          'refresh-expired': 'auto',
          callback: (value: string) => {
            setToken(value)
            setStatus('ready')
          },
          'expired-callback': () => {
            setToken(null)
            setStatus('loading')
          },
          'error-callback': () => {
            setToken(null)
            setStatus('error')
            // Devolver true evita que Turnstile lo registre como error sin gestionar.
            return true
          },
          'timeout-callback': () => {
            setToken(null)
            setStatus('error')
          },
        })
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
      setToken(null)
    }
  }, [siteKey, attempt])

  /** Pide un token nuevo (tras usarlo o tras un fallo de Supabase). */
  const reset = useCallback(() => {
    if (!siteKey) return
    setToken(null)
    if (widget.current && window.turnstile) {
      setStatus('loading')
      window.turnstile.reset(widget.current)
    } else setAttempt((n) => n + 1)
  }, [siteKey])

  /** Tras un error: vuelve a montar el widget (y a descargar el script si no llegó). */
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { ref, token, status, reset, retry, required: Boolean(siteKey) }
}
