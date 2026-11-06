import { Button, Icon, type IconName, icons, notify, TextField } from '@muninn/ui'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { t as tr } from '../i18n'
import { enterDemo, hasSupabase, isTauri, loadSupabase, safeRedirect } from '../lib/auth'
import { captchaSiteKey, useCaptcha } from '../lib/captcha'
import { useGitHubDesktopLogin } from '../lib/github-desktop-login'
import {
  authErrorMessage,
  enabledProviders,
  sendEmailCode,
  signInWithGitHub,
  verifyEmailCode,
} from '../lib/login-actions'
import { usePageMeta } from '../lib/seo'
import { forgetUserData } from '../lib/session'
import { Logo } from '../shell/Logo'

const route = getRouteApi('/login')

/** Supabase permite un correo por minuto y dirección. */
const RESEND_SECONDS = 60

// Función y no constante: los textos salen en el idioma activo al pintar.
const features = (): { icon: IconName; title: string; text: string }[] => [
  {
    icon: 'projects',
    title: tr('login.features.kanbanTitle', { ns: 'auth' }),
    text: tr('login.features.kanbanText', { ns: 'auth' }),
  },
  {
    icon: 'assistant',
    title: tr('login.features.assistantTitle', { ns: 'auth' }),
    text: tr('login.features.assistantText', { ns: 'auth' }),
  },
  {
    icon: 'sync',
    title: tr('login.features.syncTitle', { ns: 'auth' }),
    text: tr('login.features.syncText', { ns: 'auth' }),
  },
]

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

function useCountdown() {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, () => setLeft(RESEND_SECONDS)] as const
}

/** Inicio de sesión con código por correo o GitHub. Diseño: Login.dc.html. */
export function Login() {
  const { t } = useTranslation('auth')
  const router = useRouter()
  const search = route.useSearch()
  const target = safeRedirect(search.redirect)

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'send' | 'verify' | 'github' | null>(null)
  const [resendIn, startCountdown] = useCountdown()
  const [github, setGithub] = useState(false)
  // Sin servidor no hay nada que proteger: ni widget ni script de Cloudflare.
  const captcha = useCaptcha(hasSupabase ? captchaSiteKey : null)
  const waitingCaptcha = captcha.required && captcha.status !== 'ready'

  usePageMeta({
    title: t('login.metaTitle'),
    description: t('login.metaDescription'),
  })

  useEffect(() => {
    if (!hasSupabase) return
    // Se adelanta la descarga de supabase-js mientras se escribe el correo.
    loadSupabase().catch(() => {})
    // Solo se ofrece GitHub si está activado en el proyecto.
    enabledProviders()
      .then((p) => setGithub(Boolean(p.github)))
      .catch(() => setGithub(false))
  }, [])

  // GitHub vuelve con `error_description` si se cancela o falla el permiso.
  useEffect(() => {
    if (search.error_description) {
      notify.error(t('notify.githubFailed'), { description: search.error_description })
    }
  }, [search.error_description, t])

  useEffect(() => {
    if (captcha.status === 'error') {
      notify.error(t('notify.captchaFailed'), { description: t('notify.captchaFailedHint') })
    }
  }, [captcha.status, t])

  const goIn = async () => {
    forgetUserData()
    await router.invalidate()
    await router.navigate({ href: target, replace: true })
  }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const value = email.trim()
    if (!isEmail(value)) {
      setError(t('validation.email'))
      return
    }
    if (captcha.required && !captcha.token) {
      setError(
        captcha.status === 'error'
          ? t('validation.captchaMissing')
          : t('validation.captchaWaiting'),
      )
      return
    }
    setError(null)
    setBusy('send')
    try {
      await sendEmailCode(value, captcha.token)
      setEmail(value)
      setCode('')
      setStep('code')
      startCountdown()
      notify.success(t('notify.codeSent'), { icon: 'send', description: value })
    } catch (err) {
      const message = authErrorMessage(err)
      setError(message)
      notify.error(t('notify.sendFailed'), { description: message })
    } finally {
      // El token es de un solo uso: se pide otro para el siguiente envío (o el reenvío).
      captcha.reset()
      setBusy(null)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) {
      setError(t('validation.fullCode'))
      return
    }
    setError(null)
    setBusy('verify')
    try {
      const account = await verifyEmailCode(email, token)
      notify.success(t('notify.signedIn'), { icon: 'user', description: account.name })
      await goIn()
    } catch (err) {
      const message = authErrorMessage(err)
      setError(message)
      notify.error(t('notify.signInFailed'), { description: message })
      setBusy(null)
    }
  }

  // En escritorio, GitHub se abre en el navegador del sistema y vuelve por deep link (ADR-0059).
  const desktopGitHub = useGitHubDesktopLogin(isTauri && hasSupabase, goIn)

  const withGitHub = async () => {
    if (isTauri) return desktopGitHub.start()
    setBusy('github')
    try {
      await signInWithGitHub(target)
      // El navegador se va a GitHub: nos quedamos en «cargando».
    } catch (err) {
      notify.error(t('notify.githubOpenFailed'), { description: authErrorMessage(err) })
      setBusy(null)
    }
  }

  const demo = async () => {
    enterDemo()
    notify.info(t('notify.demo'), { icon: 'info', description: t('notify.demoHint') })
    await goIn()
  }

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <section className="hidden min-w-0 flex-[1_1_520px] flex-col gap-10 border-r border-border-subtle bg-sidebar px-16 py-14 lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="size-[34px]" />
          <span className="text-xl font-semibold tracking-tight">Muninn</span>
        </div>
        <div className="mt-auto flex max-w-[520px] flex-col gap-[18px]">
          <h1 className="text-[44px] leading-[1.1] font-semibold tracking-[-0.03em]">
            {t('login.tagline')}
          </h1>
          <p className="text-[17px] leading-relaxed text-fg-muted">{t('login.pitch')}</p>
        </div>
        <ul className="flex max-w-[520px] flex-col gap-[18px]">
          {features().map((f) => (
            <li key={f.title} className="flex items-start gap-3 text-base leading-normal">
              <Icon name={f.icon} className="mt-[3px] text-accent" />
              <span className="text-fg-muted">
                <b className="block font-medium text-fg">{f.title}</b>
                {f.text}
              </span>
            </li>
          ))}
        </ul>
        <span className="text-xs text-fg-faint">v{__APP_VERSION__}</span>
      </section>

      <section className="grid min-w-0 flex-[1_1_480px] place-items-center px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-14 md:px-8 md:py-14">
        <div className="flex w-full max-w-[380px] flex-col gap-[18px]">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="text-md font-semibold tracking-tight">Muninn</span>
          </div>

          {step === 'email' ? (
            <form
              aria-label={t('login.formLabel')}
              noValidate
              onSubmit={send}
              className="flex flex-col gap-[18px]"
            >
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">{t('login.title')}</h2>
                <p className="text-base text-fg-subtle">{t('login.subtitle')}</p>
              </div>
              <TextField
                label={t('login.email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t('login.emailPlaceholder')}
                size="lg"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                error={error}
                disabled={!hasSupabase || busy !== null}
                autoFocus
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="font-semibold"
                disabled={!hasSupabase || busy !== null || waitingCaptcha}
              >
                {busy === 'send'
                  ? t('login.sending')
                  : captcha.status === 'loading'
                    ? t('login.checking')
                    : t('login.sendCode')}
              </Button>
            </form>
          ) : (
            <form
              aria-label={t('login.codeFormLabel')}
              noValidate
              onSubmit={verify}
              className="flex flex-col gap-[18px]"
            >
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">
                  {t('login.checkInbox')}
                </h2>
                <p className="text-base text-fg-subtle">
                  <Trans
                    t={t}
                    i18nKey="login.codeSentTo"
                    values={{ email }}
                    components={{ b: <span className="font-medium text-fg" /> }}
                  />
                </p>
              </div>
              <TextField
                label={t('login.code')}
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={10}
                size="lg"
                className="[&_input]:font-mono [&_input]:tracking-[0.3em]"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''))
                  if (error) setError(null)
                }}
                error={error}
                disabled={busy !== null}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="font-semibold"
                disabled={busy !== null}
              >
                {busy === 'verify' ? t('login.signingIn') : t('login.signIn')}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="cursor-pointer text-fg-muted hover:text-fg"
                  onClick={() => {
                    setStep('email')
                    setError(null)
                  }}
                >
                  <icons.chevronLeft aria-hidden="true" className="mr-1 inline align-[-3px]" />
                  {t('login.otherEmail')}
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-accent hover:text-accent-hover disabled:cursor-default disabled:text-fg-faint"
                  disabled={resendIn > 0 || busy !== null || waitingCaptcha}
                  onClick={() => send()}
                >
                  {resendIn > 0 ? t('login.resendIn', { seconds: resendIn }) : t('login.resend')}
                </button>
              </div>
            </form>
          )}

          {/* Fuera de los dos formularios: el reenvío del código también necesita token. */}
          {captcha.required ? (
            <div className="flex flex-col gap-2">
              <div ref={captcha.ref} />
              {captcha.status === 'loading' ? (
                <p role="status" className="text-xs text-fg-faint">
                  {t('login.captchaChecking')}
                </p>
              ) : captcha.status === 'error' ? (
                <p role="alert" className="text-xs text-danger">
                  {t('login.captchaFailed')}{' '}
                  <button
                    type="button"
                    onClick={captcha.retry}
                    className="cursor-pointer text-accent hover:text-accent-hover"
                  >
                    {t('login.retry')}
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 'email' && github ? (
            <>
              <div className="flex items-center gap-3 text-xs text-fg-faint">
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
                {t('login.or')}
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
              <Button
                size="lg"
                onClick={withGitHub}
                disabled={busy !== null || desktopGitHub.waiting}
                className="gap-2.5"
              >
                <Icon name="github" />
                {desktopGitHub.waiting
                  ? t('login.waitingGitHub')
                  : busy === 'github'
                    ? t('login.openingGitHub')
                    : t('login.continueGitHub')}
              </Button>
              {desktopGitHub.waiting ? (
                <button
                  type="button"
                  onClick={desktopGitHub.cancel}
                  className="cursor-pointer self-center text-[12.5px] text-accent hover:text-accent-hover"
                >
                  {t('login.cancel')}
                </button>
              ) : null}
            </>
          ) : null}

          {search.error_description && step === 'email' ? (
            <p role="alert" className="text-xs text-danger">
              {t('login.githubError', { message: search.error_description })}
            </p>
          ) : null}

          <p className="mt-1.5 text-[12.5px] leading-normal text-fg-faint">
            {hasSupabase ? t('login.tryWithoutAccount') : t('login.noServer')}
            <button
              type="button"
              onClick={demo}
              disabled={busy !== null}
              className="cursor-pointer text-accent hover:text-accent-hover"
            >
              {t('login.demo')}
            </button>
            {t('login.demoHint')}
          </p>
          {/* Pública (ADR-0076): también es por donde los buscadores llegan a las guías. */}
          <p className="text-[12.5px] leading-normal text-fg-faint">
            {t('login.docsBefore')}
            <Link to="/docs" className="text-accent hover:text-accent-hover">
              {t('login.docsLink')}
            </Link>
            {t('login.docsAfter')}
          </p>
        </div>
      </section>
    </div>
  )
}
