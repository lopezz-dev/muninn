import { Button, Card, Icon, type IconName, notify } from '@muninn/ui'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  consentErrorMessage,
  decideConsent,
  getConsentRequest,
  redirectHost,
  scopeLabels,
} from '../lib/oauth-consent'
import { Logo } from '../shell/Logo'

const route = getRouteApi('/oauth/consent')

type State =
  | { kind: 'loading' }
  | { kind: 'ask'; details: OAuthAuthorizationDetails }
  | { kind: 'leaving'; host: string }
  | { kind: 'error'; message: string }

/**
 * Autorizar a una app (claude.ai, Claude en el móvil) a usar tu Muninn por el MCP remoto (ADR-0036). Supabase
 * Auth manda aquí con `?authorization_id=…`; al aprobar o rechazar, se vuelve a la app con el resultado.
 */
export function OAuthConsent() {
  const { authorization_id: id } = route.useSearch()
  const [state, setState] = useState<State>(
    id ? { kind: 'loading' } : { kind: 'error', message: 'Falta la solicitud de autorización.' },
  )
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)

  useEffect(() => {
    document.title = 'Autorizar acceso · Muninn'
    if (!id) return
    let alive = true
    getConsentRequest(id).then(
      (req) => {
        if (!alive) return
        if (req.kind === 'redirect') {
          // Ya diste permiso a esta app: se vuelve sin preguntar.
          setState({ kind: 'leaving', host: redirectHost(req.url) })
          location.assign(req.url)
        } else setState({ kind: 'ask', details: req.details })
      },
      (err) => alive && setState({ kind: 'error', message: consentErrorMessage(err) }),
    )
    return () => {
      alive = false
    }
  }, [id])

  const decide = async (approve: boolean) => {
    if (!id || state.kind !== 'ask') return
    const app = state.details.client.name || 'La app'
    setBusy(approve ? 'approve' : 'deny')
    try {
      const url = await decideConsent(id, approve)
      const host = redirectHost(url)
      if (approve)
        notify.success(`${app} ya puede usar tu Muninn`, {
          icon: 'check',
          description: `Volviendo a ${host}…`,
        })
      else notify.info('Acceso rechazado', { icon: 'close', description: `Volviendo a ${host}…` })
      setState({ kind: 'leaving', host })
      location.assign(url)
    } catch (err) {
      const message = consentErrorMessage(err)
      notify.error(approve ? 'No se pudo dar el acceso' : 'No se pudo rechazar', {
        description: message,
      })
      setBusy(null)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-14 text-fg md:px-8">
      <div className="flex w-full max-w-[420px] flex-col gap-[18px]">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-md font-semibold tracking-tight">Muninn</span>
        </div>
        <Card className="flex flex-col gap-5 p-6">
          {state.kind === 'ask' ? (
            <Ask details={state.details} busy={busy} onDecide={decide} />
          ) : state.kind === 'error' ? (
            <>
              <Heading title="No se puede autorizar">{state.message}</Heading>
              <Button asChild variant="primary" size="lg">
                <Link to="/">Ir a Inicio</Link>
              </Button>
            </>
          ) : (
            <p role="status" className="text-base text-fg-subtle">
              {state.kind === 'leaving' ? `Volviendo a ${state.host}…` : 'Cargando la solicitud…'}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Heading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="text-base text-fg-subtle">{children}</p>
    </div>
  )
}

function Ask({
  details,
  busy,
  onDecide,
}: {
  details: OAuthAuthorizationDetails
  busy: 'approve' | 'deny' | null
  onDecide: (approve: boolean) => void
}) {
  const app = details.client.name || 'Una app'
  const host = redirectHost(details.redirect_uri)
  const scopes = scopeLabels(details.scope)
  const points: { icon: IconName; text: React.ReactNode }[] = [
    {
      icon: 'projects',
      text: 'Ver y cambiar tus proyectos, tareas y notas a través del MCP de Muninn, como si fueras tú.',
    },
    { icon: 'archive', text: 'Nunca borra nada: como mucho, archiva.' },
    {
      icon: 'external',
      text: (
        <>
          Al terminar vuelves a <b className="font-medium text-fg">{host}</b>.
        </>
      ),
    },
  ]
  return (
    <>
      <Heading title={`${app} quiere usar tu Muninn`}>
        Entrarás como <span className="font-medium text-fg">{details.user.email}</span>.
      </Heading>
      <ul className="flex flex-col gap-3">
        {points.map((p) => (
          <li key={p.icon} className="flex items-start gap-3 text-sm leading-normal text-fg-muted">
            <Icon name={p.icon} className="mt-[3px] shrink-0 text-accent" />
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
      {scopes.length > 0 ? (
        <p className="text-xs text-fg-subtle">También pide: {scopes.join(' · ')}.</p>
      ) : null}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          size="lg"
          className="font-semibold"
          disabled={busy !== null}
          onClick={() => onDecide(true)}
        >
          {busy === 'approve' ? 'Dando acceso…' : 'Permitir acceso'}
        </Button>
        <Button size="lg" disabled={busy !== null} onClick={() => onDecide(false)}>
          {busy === 'deny' ? 'Rechazando…' : 'Rechazar'}
        </Button>
      </div>
      <p className="text-[12.5px] leading-normal text-fg-faint">
        Da permiso solo a apps en las que confíes. Puedes quitarlo cuando quieras en Ajustes ›
        Cuenta › Apps con acceso.
      </p>
    </>
  )
}
