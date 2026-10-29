import type { MfaEnrollment } from '@muninn/core'
import { Button, notify, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, type ReactNode, useState } from 'react'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { fail } from '../../lib/mutations'
import { keys } from '../../lib/queries'
import { PrefGroup, PrefRow } from './ui'

/**
 * Segundo factor con una app de códigos (TOTP), opcional (ADR-0061). Activarlo y desactivarlo no tiene «Deshacer»: el
 * secreto cambia cada vez, así que el aviso dice qué pasa.
 */

/** La clave de configuración en grupos de cuatro, para copiarla a mano sin perderse. */
const groupSecret = (s: string) => s.match(/.{1,4}/g)?.join(' ') ?? s

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : 'Algo ha fallado. Inténtalo de nuevo.'

/** Campo de seis cifras para un código de la app, con su envío y «Cancelar». */
function CodeForm({
  id,
  intro,
  submit,
  busyLabel,
  danger,
  onSubmit,
  onCancel,
}: {
  id: string
  intro: ReactNode
  submit: string
  busyLabel: string
  danger?: boolean
  onSubmit: (code: string) => Promise<void>
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit(code)
    } catch (err) {
      setError(errorText(err))
      setCode('')
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={send}
      noValidate
      className="flex flex-col gap-4 border-t border-border-subtle px-4 py-4 md:px-[18px]"
    >
      {intro}
      <TextField
        id={id}
        label="Código de la app"
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={7}
        className="max-w-[220px] [&_input]:font-mono [&_input]:tracking-[0.3em]"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ''))
          if (error) setError(null)
        }}
        error={error}
        disabled={busy}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={danger ? 'danger' : 'primary'}
          size="sm"
          disabled={busy || code.length < 6}
        >
          {busy ? busyLabel : submit}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/** Lo que enseña el alta: los pasos, el QR y la clave para teclearla a mano. */
function EnrollIntro({ enrollment }: { enrollment: MfaEnrollment }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(enrollment.secret)
      notify.success('Clave copiada', { icon: 'check' })
    } catch {
      notify.error('No se pudo copiar', { description: 'Cópiala a mano.' })
    }
  }
  return (
    <>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-fg-muted">
        <li>
          Abre tu app de códigos (Google Authenticator, 1Password, Authy…) y añade una cuenta nueva.
        </li>
        <li>Escanea el código QR o escribe la clave.</li>
        <li>Escribe aquí el código de seis cifras que te enseña.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        {enrollment.qrCode ? (
          <img
            src={enrollment.qrCode}
            alt="Código QR para añadir Muninn a tu app de códigos"
            className="size-40 rounded-md bg-fg p-2"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs text-fg-subtle">Clave de configuración</span>
          <code className="font-mono text-sm break-all text-fg">
            {groupSecret(enrollment.secret)}
          </code>
          <Button size="sm" variant="ghost" className="self-start" onClick={() => void copy()}>
            Copiar
          </Button>
          <span className="text-xs text-fg-faint">
            Guárdala en un lugar seguro: si pierdes el móvil, te sirve para añadir Muninn a otra
            app.
          </span>
        </div>
      </div>
    </>
  )
}

type Mode = { kind: 'idle' } | { kind: 'enroll'; enrollment: MfaEnrollment } | { kind: 'disable' }

/** Ajustes › Cuenta › Segundo factor. */
export function SegundoFactor() {
  const m = useMuninn()
  const qc = useQueryClient()
  const factors = useQuery({
    queryKey: keys.accountMfa,
    queryFn: () => m.account.mfa.factors(),
    enabled: m.account.available(),
  })
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  const active = factors.data?.find((f) => f.status === 'verified')

  const done = () => {
    setMode({ kind: 'idle' })
    // También las sesiones: la de este dispositivo pasa a «con segundo factor».
    void qc.invalidateQueries({ queryKey: ['account'] })
  }
  const start = async () => {
    setBusy(true)
    try {
      setMode({ kind: 'enroll', enrollment: await m.account.mfa.enroll() })
    } catch (err) {
      fail('No se pudo empezar a activar el segundo factor', err)
    }
    setBusy(false)
  }
  const confirm = async (enrollment: MfaEnrollment, code: string) => {
    await m.account.mfa.confirm(enrollment.factorId, code)
    notify.success('Segundo factor activado', {
      icon: 'user',
      description: 'A partir de ahora, al entrar te pediremos un código de tu app.',
    })
    done()
  }
  const disable = async (code: string) => {
    await m.account.mfa.disable(code)
    notify.success('Segundo factor desactivado', {
      icon: 'user',
      description:
        'Ya no te pediremos el código al entrar. Para volver a activarlo, añade Muninn otra vez a tu app.',
    })
    done()
  }

  if (!m.account.available()) return null
  return (
    <PrefGroup
      title="Segundo factor"
      icon="shield"
      description="Además del código del correo o de GitHub, un código de una app de tu móvil. Opcional."
    >
      <PrefRow
        id="segundo-factor"
        icon="key"
        tile={active ? 'bg-success/15 text-success' : undefined}
        title="App de códigos"
        description={
          factors.isPending
            ? 'Cargando…'
            : factors.isError
              ? 'No se pudo comprobar si está activado.'
              : active
                ? `Activado ${timeAgo(active.createdAt)}. Al entrar, te pedimos un código de la app.`
                : 'Desactivado. Para entrar basta con el código del correo o con GitHub.'
        }
      >
        {factors.isSuccess && mode.kind === 'idle' ? (
          active ? (
            <Button size="sm" onClick={() => setMode({ kind: 'disable' })}>
              Desactivar
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => void start()} disabled={busy}>
              {busy ? 'Preparando…' : 'Activar'}
            </Button>
          )
        ) : null}
      </PrefRow>
      {mode.kind === 'enroll' ? (
        <CodeForm
          id="ajuste-mfa-codigo"
          intro={<EnrollIntro enrollment={mode.enrollment} />}
          submit="Activar"
          busyLabel="Comprobando…"
          onSubmit={(code) => confirm(mode.enrollment, code)}
          onCancel={done}
        />
      ) : null}
      {mode.kind === 'disable' ? (
        <CodeForm
          id="ajuste-mfa-desactivar"
          intro={
            <p className="text-sm text-fg-muted">
              Para desactivarlo, escribe el código que sale ahora en tu app.
            </p>
          }
          submit="Desactivar"
          busyLabel="Desactivando…"
          danger
          onSubmit={disable}
          onCancel={done}
        />
      ) : null}
    </PrefGroup>
  )
}
