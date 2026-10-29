import { Button, icons, notify, TextField } from '@muninn/ui'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { type Account, safeRedirect } from '../../lib/auth'
import {
  abandonSecondFactor,
  secondFactorErrorMessage,
  verifySecondFactor,
} from '../../lib/second-factor'
import { usePageMeta } from '../../lib/seo'
import { forgetUserData } from '../../lib/session'
import { Logo } from '../../shell/Logo'
import { Login } from '../Login'

const route = getRouteApi('/login')

/** La pantalla de /login: el formulario o, si la cuenta tiene segundo factor y falta escribirlo, su código (ADR-0061). */
export function Entrada() {
  const auth = route.useRouteContext({ select: (c) => c.auth })
  return auth.kind === 'mfa' ? <SecondFactor account={auth.account} /> : <Login />
}

function SecondFactor({ account }: { account: Account }) {
  const router = useRouter()
  const search = route.useSearch()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'verify' | 'leave' | null>(null)

  usePageMeta({ title: 'Segundo factor', description: 'Escribe el código de tu app de códigos.' })

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length !== 6) {
      setError('Escribe las 6 cifras que salen ahora en tu app.')
      return
    }
    setError(null)
    setBusy('verify')
    try {
      await verifySecondFactor(token)
      notify.success('Sesión iniciada', { icon: 'user', description: account.name })
      forgetUserData()
      await router.invalidate()
      await router.navigate({ href: safeRedirect(search.redirect), replace: true })
    } catch (err) {
      const message = secondFactorErrorMessage(err)
      setError(message)
      notify.error('No se pudo comprobar el código', { description: message })
      setCode('')
      setBusy(null)
    }
  }

  const leave = async () => {
    setBusy('leave')
    try {
      await abandonSecondFactor()
      await router.invalidate()
    } catch (err) {
      notify.error('No se pudo salir', { description: secondFactorErrorMessage(err) })
    }
    setBusy(null)
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-14 text-fg md:px-8">
      <form
        aria-label="Segundo factor"
        noValidate
        onSubmit={verify}
        className="flex w-full max-w-[380px] flex-col gap-[18px]"
      >
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-md font-semibold tracking-tight">Muninn</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Falta un paso</h1>
          <p className="text-base text-fg-subtle">
            Tu cuenta tiene segundo factor. Abre tu app de códigos y escribe el de{' '}
            <span className="font-medium text-fg">Muninn</span>
            {account.email ? (
              <>
                {' '}
                para <span className="font-medium text-fg">{account.email}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <TextField
          label="Código de la app"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={7}
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
          {busy === 'verify' ? 'Comprobando…' : 'Entrar'}
        </Button>
        <button
          type="button"
          className="cursor-pointer self-start text-sm text-fg-muted hover:text-fg"
          onClick={() => void leave()}
          disabled={busy !== null}
        >
          <icons.chevronLeft aria-hidden="true" className="mr-1 inline align-[-3px]" />
          Usar otra cuenta
        </button>
        <p className="text-[12.5px] leading-normal text-fg-faint">
          ¿Sin el móvil de la app? Añade Muninn a otra app de códigos con la clave de configuración
          que guardaste al activarlo.
        </p>
      </form>
    </div>
  )
}
