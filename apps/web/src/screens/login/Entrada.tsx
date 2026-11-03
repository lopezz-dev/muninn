import { Button, icons, notify, TextField } from '@muninn/ui'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { type Account, safeRedirect } from '../../lib/auth'
import {
  abandonSecondFactor,
  recoveryCodeErrorMessage,
  secondFactorErrorMessage,
  verifyRecoveryCode,
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
  const { t } = useTranslation('auth')
  const router = useRouter()
  const search = route.useSearch()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'verify' | 'leave' | null>(null)
  // Sin el móvil: un código de recuperación en lugar del de la app (ADR-0075).
  const [recovery, setRecovery] = useState(false)

  usePageMeta({
    title: t('secondFactor.metaTitle'),
    description: t('secondFactor.metaDescription'),
  })

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    const token = recovery ? code.trim() : code.replace(/\D/g, '')
    if (recovery ? token.length < 6 : token.length !== 6) {
      setError(recovery ? t('secondFactor.recoveryRequired') : t('secondFactor.digitsRequired'))
      return
    }
    setError(null)
    setBusy('verify')
    try {
      if (recovery) await verifyRecoveryCode(token)
      else await verifySecondFactor(token)
      notify.success(t('secondFactor.signedIn'), {
        icon: 'user',
        description: recovery ? t('secondFactor.recoveryUsed') : account.name,
      })
      forgetUserData()
      await router.invalidate()
      await router.navigate({ href: safeRedirect(search.redirect), replace: true })
    } catch (err) {
      const message = recovery ? recoveryCodeErrorMessage(err) : secondFactorErrorMessage(err)
      setError(message)
      notify.error(t('secondFactor.checkFailed'), { description: message })
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
      notify.error(t('secondFactor.leaveFailed'), { description: secondFactorErrorMessage(err) })
    }
    setBusy(null)
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-14 text-fg md:px-8">
      <form
        aria-label={t('secondFactor.formLabel')}
        noValidate
        onSubmit={verify}
        className="flex w-full max-w-[380px] flex-col gap-[18px]"
      >
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-md font-semibold tracking-tight">Muninn</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
            {t('secondFactor.title')}
          </h1>
          {recovery ? (
            <p className="text-base text-fg-subtle">{t('secondFactor.recoveryIntro')}</p>
          ) : (
            <p className="text-base text-fg-subtle">
              {account.email ? (
                <Trans
                  t={t}
                  i18nKey="secondFactor.appIntroFor"
                  values={{ email: account.email }}
                  components={{ b: <span className="font-medium text-fg" /> }}
                />
              ) : (
                <Trans
                  t={t}
                  i18nKey="secondFactor.appIntro"
                  components={{ b: <span className="font-medium text-fg" /> }}
                />
              )}
            </p>
          )}
        </div>
        {recovery ? (
          <TextField
            key="recuperacion"
            label={t('secondFactor.recoveryCode')}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="abcde-12345"
            maxLength={40}
            size="lg"
            className="[&_input]:font-mono [&_input]:tracking-[0.08em]"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              if (error) setError(null)
            }}
            error={error}
            disabled={busy !== null}
          />
        ) : (
          <TextField
            key="app"
            label={t('secondFactor.appCode')}
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
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="font-semibold"
          disabled={busy !== null}
        >
          {busy === 'verify' ? t('secondFactor.checking') : t('secondFactor.signIn')}
        </Button>
        <button
          type="button"
          className="cursor-pointer self-start text-sm text-fg-muted hover:text-fg"
          onClick={() => void leave()}
          disabled={busy !== null}
        >
          <icons.chevronLeft aria-hidden="true" className="mr-1 inline align-[-3px]" />
          {t('secondFactor.otherAccount')}
        </button>
        <p className="text-[12.5px] leading-normal text-fg-faint">
          {recovery ? (
            <>
              {t('secondFactor.havePhone')}
              <button
                type="button"
                className="cursor-pointer font-medium text-accent hover:underline"
                onClick={() => {
                  setRecovery(false)
                  setCode('')
                  setError(null)
                }}
                disabled={busy !== null}
              >
                {t('secondFactor.useAppCode')}
              </button>
            </>
          ) : (
            <>
              {t('secondFactor.noPhone')}
              <button
                type="button"
                className="cursor-pointer font-medium text-accent hover:underline"
                onClick={() => {
                  setRecovery(true)
                  setCode('')
                  setError(null)
                }}
                disabled={busy !== null}
              >
                {t('secondFactor.useRecovery')}
              </button>
              {t('secondFactor.orSetupKey')}
            </>
          )}
        </p>
      </form>
    </div>
  )
}
