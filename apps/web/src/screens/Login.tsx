import { Button, Icon, type IconName, icons, notify, TextField } from '@muninn/ui'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { enterDemo, hasSupabase, isTauri, loadSupabase, safeRedirect } from '../lib/auth'
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

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'projects',
    title: 'Kanban a tu medida',
    text: 'Columnas propias por proyecto e issues de GitHub como tareas.',
  },
  {
    icon: 'assistant',
    title: 'Asistente local o Claude',
    text: 'Pregúntale cómo vas; nunca borra nada.',
  },
  { icon: 'sync', title: 'Escritorio y móvil', text: 'Tus datos, en todos tus dispositivos.' },
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

  usePageMeta({
    title: 'Iniciar sesión',
    description:
      'Entra en Muninn, tu sistema operativo personal, con un código por correo o con GitHub. O pruébalo sin cuenta en modo demo.',
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
      notify.error('No se pudo entrar con GitHub', { description: search.error_description })
    }
  }, [search.error_description])

  const goIn = async () => {
    forgetUserData()
    await router.invalidate()
    await router.navigate({ href: target, replace: true })
  }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const value = email.trim()
    if (!isEmail(value)) {
      setError('Escribe un correo válido, como tu@correo.com.')
      return
    }
    setError(null)
    setBusy('send')
    try {
      await sendEmailCode(value)
      setEmail(value)
      setCode('')
      setStep('code')
      startCountdown()
      notify.success('Código enviado', { icon: 'send', description: value })
    } catch (err) {
      const message = authErrorMessage(err)
      setError(message)
      notify.error('No se pudo enviar el código', { description: message })
    } finally {
      setBusy(null)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) {
      setError('Escribe el código completo que te ha llegado.')
      return
    }
    setError(null)
    setBusy('verify')
    try {
      const account = await verifyEmailCode(email, token)
      notify.success('Sesión iniciada', { icon: 'user', description: account.name })
      await goIn()
    } catch (err) {
      const message = authErrorMessage(err)
      setError(message)
      notify.error('No se pudo iniciar la sesión', { description: message })
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
      notify.error('No se pudo abrir GitHub', { description: authErrorMessage(err) })
      setBusy(null)
    }
  }

  const demo = async () => {
    enterDemo()
    notify.info('Modo demo', {
      icon: 'info',
      description: 'Los datos viven en memoria y se pierden al recargar',
    })
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
            Recuerda por ti.
          </h1>
          <p className="text-[17px] leading-relaxed text-fg-muted">
            Proyectos, tareas, notas y finanzas en un solo sitio, con un asistente que conoce todo
            el contexto.
          </p>
        </div>
        <ul className="flex max-w-[520px] flex-col gap-[18px]">
          {FEATURES.map((f) => (
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
              aria-label="Iniciar sesión"
              noValidate
              onSubmit={send}
              className="flex flex-col gap-[18px]"
            >
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Entrar en Muninn</h2>
                <p className="text-base text-fg-subtle">
                  Te enviamos un código al correo. Sin contraseñas.
                </p>
              </div>
              <TextField
                label="Correo electrónico"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tu@correo.com"
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
                disabled={!hasSupabase || busy !== null}
              >
                {busy === 'send' ? 'Enviando…' : 'Enviar código'}
              </Button>
            </form>
          ) : (
            <form
              aria-label="Escribir el código"
              noValidate
              onSubmit={verify}
              className="flex flex-col gap-[18px]"
            >
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Revisa tu correo</h2>
                <p className="text-base text-fg-subtle">
                  Escribe el código que hemos enviado a{' '}
                  <span className="font-medium text-fg">{email}</span>. Caduca en una hora.
                </p>
              </div>
              <TextField
                label="Código"
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
                {busy === 'verify' ? 'Entrando…' : 'Entrar'}
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
                  Usar otro correo
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-accent hover:text-accent-hover disabled:cursor-default disabled:text-fg-faint"
                  disabled={resendIn > 0 || busy !== null}
                  onClick={() => send()}
                >
                  {resendIn > 0 ? `Reenviar en ${resendIn} s` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}

          {step === 'email' && github ? (
            <>
              <div className="flex items-center gap-3 text-xs text-fg-faint">
                <span aria-hidden="true" className="h-px flex-1 bg-border" />o
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
                  ? 'Esperando a GitHub…'
                  : busy === 'github'
                    ? 'Abriendo GitHub…'
                    : 'Continuar con GitHub'}
              </Button>
              {desktopGitHub.waiting ? (
                <button
                  type="button"
                  onClick={desktopGitHub.cancel}
                  className="cursor-pointer self-center text-[12.5px] text-accent hover:text-accent-hover"
                >
                  Cancelar
                </button>
              ) : null}
            </>
          ) : null}

          {search.error_description && step === 'email' ? (
            <p role="alert" className="text-xs text-danger">
              GitHub: {search.error_description}
            </p>
          ) : null}

          <p className="mt-1.5 text-[12.5px] leading-normal text-fg-faint">
            {hasSupabase ? '¿Prefieres probarlo sin cuenta? ' : 'Este build no tiene servidor. '}
            <button
              type="button"
              onClick={demo}
              disabled={busy !== null}
              className="cursor-pointer text-accent hover:text-accent-hover"
            >
              Modo demo
            </button>
            : los datos viven en memoria y se pierden al recargar.
          </p>
        </div>
      </section>
    </div>
  )
}
