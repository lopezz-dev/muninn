import { notify } from '@muninn/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account } from './auth'
import {
  authErrorMessage,
  completeAuthCallback,
  pendingAuthCallback,
  signInWithGitHubDesktop,
} from './login-actions'
import { OAuthAbortedError } from './oauth-callback'

/** Feedback de un intento de entrar con GitHub en escritorio que no ha acabado en sesión. */
export function notifyGitHubFailure(err: unknown) {
  if (err instanceof OAuthAbortedError) {
    if (err.reason === 'timeout')
      notify.error('GitHub no ha respondido', {
        description: 'Han pasado cinco minutos sin volver a la app. Inténtalo de nuevo.',
      })
    else if (err.reason === 'denied')
      notify.info('Acceso con GitHub cancelado', { description: 'No has dado permiso en GitHub.' })
    else notify.info('Acceso con GitHub cancelado')
    return
  }
  notify.error('No se pudo entrar con GitHub', { description: authErrorMessage(err) })
}

let launchChecked = false

/**
 * GitHub en la app de escritorio (ADR-0059): abre el navegador del sistema y espera el deep link de vuelta.
 * `enabled` es falso fuera de Tauri. `onSignedIn` entra en la app con la sesión ya guardada.
 */
export function useGitHubDesktopLogin(
  enabled: boolean,
  onSignedIn: (account: Account) => Promise<void>,
) {
  const [waiting, setWaiting] = useState(false)
  const abort = useRef<AbortController | null>(null)
  // La función de entrar cambia en cada render de la pantalla: se lee la última sin volver a empezar.
  const signedIn = useRef(onSignedIn)
  signedIn.current = onSignedIn

  // Si la app se abrió con el enlace de vuelta (estaba cerrada al volver de GitHub), se termina aquí.
  // `getCurrent` sigue devolviendo ese enlace toda la sesión: solo se mira la primera vez.
  useEffect(() => {
    if (!enabled || launchChecked) return
    launchChecked = true
    pendingAuthCallback()
      .then(async (callback) => {
        if (!callback) return
        const account = await completeAuthCallback(callback)
        notify.success('Sesión iniciada', { icon: 'user', description: account.name })
        await signedIn.current(account)
      })
      .catch(notifyGitHubFailure)
  }, [enabled])

  // Al salir de la pantalla se deja de escuchar.
  useEffect(() => () => abort.current?.abort(), [])

  const start = useCallback(async () => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setWaiting(true)
    try {
      const account = await signInWithGitHubDesktop({
        signal: ctrl.signal,
        onBrowser: () =>
          notify.info('Sigue en el navegador', {
            icon: 'github',
            description: 'Autoriza a Muninn en GitHub y vuelve aquí.',
          }),
      })
      if (!account) return
      notify.success('Sesión iniciada', { icon: 'user', description: account.name })
      await signedIn.current(account)
    } catch (err) {
      notifyGitHubFailure(err)
    } finally {
      if (abort.current === ctrl) {
        abort.current = null
        setWaiting(false)
      }
    }
  }, [])

  const cancel = useCallback(() => abort.current?.abort(), [])

  return { waiting, start, cancel }
}
