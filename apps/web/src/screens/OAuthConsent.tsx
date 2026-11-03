import { Button, Card, Icon, type IconName, notify } from '@muninn/ui'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { resetAuth } from '../lib/auth'
import { useAuth } from '../lib/muninn'
import {
  approveAppWithMfa,
  consentErrorMessage,
  consentSecondFactor,
  decideConsent,
  getConsentRequest,
  redirectHost,
  scopeLabels,
} from '../lib/oauth-consent'
import { Logo } from '../shell/Logo'

const route = getRouteApi('/oauth/consent')

type State =
  | { kind: 'loading' }
  | { kind: 'ask'; details: OAuthAuthorizationDetails; secondFactor: 'none' | 'passed' }
  | { kind: 'mfa'; details: OAuthAuthorizationDetails }
  | { kind: 'leaving'; host: string }
  | { kind: 'error'; message: string }

/**
 * Autorizar a una app (claude.ai, Claude en el móvil) a usar tu Muninn por el MCP remoto (ADR-0036). Supabase
 * Auth manda aquí con `?authorization_id=…`; al aprobar o rechazar, se vuelve a la app con el resultado.
 */
export function OAuthConsent() {
  const { t } = useTranslation('auth')
  const { authorization_id: id } = route.useSearch()
  const auth = useAuth()
  const router = useRouter()
  const [state, setState] = useState<State>(
    id ? { kind: 'loading' } : { kind: 'error', message: t('oauth.missingRequest') },
  )
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)

  useEffect(() => {
    document.title = t('oauth.pageTitle')
    if (!id) return
    let alive = true
    Promise.all([getConsentRequest(id), consentSecondFactor()]).then(
      ([req, secondFactor]) => {
        if (!alive) return
        if (req.kind === 'redirect') {
          // Ya diste permiso a esta app: se vuelve sin preguntar.
          setState({ kind: 'leaving', host: redirectHost(req.url) })
          location.assign(req.url)
        } else if (secondFactor === 'pending') {
          // La cuenta tiene segundo factor y esta sesión no lo ha pasado: sin él, la app no vería nada (ADR-0066).
          setState({ kind: 'mfa', details: req.details })
        } else setState({ kind: 'ask', details: req.details, secondFactor })
      },
      (err) => alive && setState({ kind: 'error', message: consentErrorMessage(err) }),
    )
    return () => {
      alive = false
    }
  }, [id, t])

  // A /login, que con la sesión a medias pide el código y vuelve aquí (la solicitud sigue pendiente).
  const writeCode = () => {
    resetAuth()
    void router.navigate({
      to: '/login',
      search: { redirect: `${location.pathname}${location.search}` },
      replace: true,
    })
  }

  const decide = async (approve: boolean) => {
    if (!id || state.kind !== 'ask') return
    const app = state.details.client.name || t('oauth.theApp')
    setBusy(approve ? 'approve' : 'deny')
    try {
      // Antes de aprobar, que el servidor sepa que la aprobaste con el segundo factor (ADR-0066). Si no queda apuntada
      // (falla o devuelve `false`), se aprueba igual: sin la fila, la app solo pierde acceso con el factor activado, y se avisa.
      let mfaFailed = false
      if (approve && state.secondFactor === 'passed' && auth.kind === 'user')
        mfaFailed = !(await approveAppWithMfa(
          state.details.authorization_id,
          auth.account.id,
        ).catch((err) => {
          console.warn('No se pudo apuntar la aprobación con el segundo factor', err)
          return false
        }))
      const url = await decideConsent(id, approve)
      const host = redirectHost(url)
      if (approve)
        notify.success(t('oauth.granted', { app }), {
          icon: 'check',
          description: mfaFailed
            ? t('oauth.grantedNoMfa', { host })
            : t('oauth.returningTo', { host }),
        })
      else
        notify.info(t('oauth.denied'), {
          icon: 'close',
          description: t('oauth.returningTo', { host }),
        })
      setState({ kind: 'leaving', host })
      location.assign(url)
    } catch (err) {
      const message = consentErrorMessage(err)
      notify.error(approve ? t('oauth.grantFailed') : t('oauth.denyFailed'), {
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
          ) : state.kind === 'mfa' ? (
            <>
              <Heading title={t('oauth.mfaTitle')}>
                <Trans
                  t={t}
                  i18nKey="oauth.mfaText"
                  values={{ app: state.details.client.name || t('oauth.thisApp') }}
                  components={{ b: <span className="font-medium text-fg" /> }}
                />
              </Heading>
              <Button variant="primary" size="lg" className="font-semibold" onClick={writeCode}>
                {t('oauth.writeCode')}
              </Button>
            </>
          ) : state.kind === 'error' ? (
            <>
              <Heading title={t('oauth.errorTitle')}>{state.message}</Heading>
              <Button asChild variant="primary" size="lg">
                <Link to="/">{t('oauth.goHome')}</Link>
              </Button>
            </>
          ) : (
            <p role="status" className="text-base text-fg-subtle">
              {state.kind === 'leaving'
                ? t('oauth.returningTo', { host: state.host })
                : t('oauth.loading')}
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
  const { t } = useTranslation('auth')
  const app = details.client.name || t('oauth.anApp')
  const host = redirectHost(details.redirect_uri)
  const scopes = scopeLabels(details.scope)
  const points: { icon: IconName; text: React.ReactNode }[] = [
    { icon: 'projects', text: t('oauth.pointAccess') },
    { icon: 'archive', text: t('oauth.pointNoDelete') },
    {
      icon: 'external',
      text: (
        <Trans
          t={t}
          i18nKey="oauth.pointReturn"
          values={{ host }}
          components={{ b: <b className="font-medium text-fg" /> }}
        />
      ),
    },
  ]
  return (
    <>
      <Heading title={t('oauth.wants', { app })}>
        <Trans
          t={t}
          i18nKey="oauth.signInAs"
          values={{ email: details.user.email }}
          components={{ b: <span className="font-medium text-fg" /> }}
        />
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
        <p className="text-xs text-fg-subtle">
          {t('oauth.alsoAsks', { scopes: scopes.join(' · ') })}
        </p>
      ) : null}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="primary"
          size="lg"
          className="font-semibold"
          disabled={busy !== null}
          onClick={() => onDecide(true)}
        >
          {busy === 'approve' ? t('oauth.granting') : t('oauth.allow')}
        </Button>
        <Button size="lg" disabled={busy !== null} onClick={() => onDecide(false)}>
          {busy === 'deny' ? t('oauth.denying') : t('oauth.deny')}
        </Button>
      </div>
      <p className="text-[12.5px] leading-normal text-fg-faint">{t('oauth.trustHint')}</p>
    </>
  )
}
