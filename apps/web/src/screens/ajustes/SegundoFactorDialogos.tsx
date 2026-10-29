import type { MfaEnrollment } from '@muninn/core'
import {
  Button,
  CodeField,
  cn,
  copyText,
  Dialog,
  DialogContent,
  Icon,
  notify,
  SheetContent,
  SuccessMark,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { useMuninn } from '../../lib/muninn'
import { useIsDesktop } from '../../lib/use-media'

/**
 * Activar y desactivar el segundo factor (ADR-0061), cada uno en su diálogo: en el ordenador, centrado; en el teléfono,
 * hoja desde abajo. Se montan al abrirse y se desmontan al cerrar, así que cada vez empiezan de cero. Ni activar ni
 * desactivar tienen «Deshacer»: el secreto cambia cada vez, así que el texto dice qué pasa.
 */

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : 'Algo ha fallado. Inténtalo de nuevo.'

/** La clave de configuración en grupos de cuatro, para copiarla a mano sin perderse. */
const secretGroups = (s: string) => s.match(/.{1,4}/g) ?? [s]

/** Tras un error el campo estaba desactivado (y sin foco): se lo devolvemos para escribir otro código. */
const refocus = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

/** Diálogo en el ordenador, hoja desde abajo en el teléfono (como `ProjectDialog`). */
function Ventana({
  title,
  description,
  footer,
  onClose,
  keepOnOutsideClick,
  children,
}: {
  title: string
  description?: ReactNode
  footer: ReactNode
  onClose: () => void
  /** Un clic fuera no cierra: a mitad del alta se perdería el QR. Escape y la X sí cierran. */
  keepOnOutsideClick?: boolean
  children: ReactNode
}) {
  const desktop = useIsDesktop()
  const outside = keepOnOutsideClick ? (e: Event) => e.preventDefault() : undefined
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      {desktop ? (
        <DialogContent
          title={title}
          description={description}
          footer={footer}
          onInteractOutside={outside}
        >
          {children}
        </DialogContent>
      ) : (
        <SheetContent
          side="bottom"
          title={title}
          footer={<div className="ml-auto flex gap-2">{footer}</div>}
          onInteractOutside={outside}
        >
          <div className="flex flex-col gap-4">
            {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
            {children}
          </div>
        </SheetContent>
      )}
    </Dialog>
  )
}

// ─── Activar ─────────────────────────────────────────────────────────────────

const STEPS = ['Escanea', 'Guarda la clave', 'Confirma'] as const

/** Los tres pasos del alta, con el actual resaltado y los hechos con su check. En el teléfono, solo el nombre del actual. */
function Steps({ current }: { current: number }) {
  return (
    <ol aria-label="Pasos" className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current
        const now = i === current
        return (
          <li
            key={label}
            aria-current={now ? 'step' : undefined}
            className="flex flex-1 items-center gap-2 last:flex-none"
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular transition-colors duration-200',
                done
                  ? 'bg-success-soft text-success'
                  : now
                    ? 'bg-accent text-accent-fg'
                    : 'border border-border-strong text-fg-subtle',
              )}
            >
              {done ? <Icon name="check" size={13} weight="bold" /> : i + 1}
              {done ? <span className="sr-only">Hecho:</span> : null}
            </span>
            <span
              className={cn(
                'text-xs whitespace-nowrap',
                now ? 'font-medium text-fg' : 'text-fg-subtle max-sm:sr-only',
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px min-w-3 flex-1 transition-colors duration-300',
                  done ? 'bg-success/40' : 'bg-border-strong',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Paso 1: el QR, sobre fondo claro para que lo lea cualquier cámara. */
function ScanStep({ enrollment, onManual }: { enrollment: MfaEnrollment; onManual: () => void }) {
  return (
    <>
      <p className="text-sm text-fg-muted">
        Abre tu app de códigos (Google Authenticator, 1Password, Authy…), añade una cuenta nueva y
        escanea este código con la cámara.
      </p>
      <div className="flex justify-center py-1">
        {enrollment.qrCode ? (
          <div className="rounded-xl bg-fg p-3 shadow-popover">
            <img
              src={enrollment.qrCode}
              alt="Código QR para añadir Muninn a tu app de códigos"
              className="size-44"
            />
          </div>
        ) : (
          // La demo no genera QR (memory-account): se pasa directamente a la clave.
          <div className="flex size-50 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-4 text-center text-xs text-fg-subtle">
            <AppIcon name="qr" size={28} />
            En la demo no hay código QR. Usa la clave del siguiente paso.
          </div>
        )}
      </div>
      <p className="text-center text-xs text-fg-subtle">
        ¿No puedes escanearlo?{' '}
        <button
          type="button"
          onClick={onManual}
          className="cursor-pointer font-medium text-accent underline-offset-2 hover:underline"
        >
          Escribe la clave a mano
        </button>
      </p>
    </>
  )
}

/** Paso 2: la clave, en grupos de cuatro y con «Copiar», y por qué guardarla. */
function KeyStep({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])
  const copy = async () => {
    if (await copyText(secret)) {
      setCopied(true)
      notify.success('Clave copiada', { icon: 'check' })
    } else notify.error('No se pudo copiar', { description: 'Cópiala a mano.' })
  }
  return (
    <>
      <p className="text-sm text-fg-muted">
        Si no has escaneado el QR, escribe esta clave en tu app. Y guárdala en un lugar seguro, como
        tu gestor de contraseñas: si pierdes el móvil, con ella añades Muninn a otra app.
      </p>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border-strong bg-surface-sunken p-4">
        <span className="self-start text-xs font-medium text-fg-subtle">
          Clave de configuración
        </span>
        <code className="grid grid-cols-4 gap-x-4 gap-y-1.5 font-mono text-md tracking-[0.12em] text-fg select-all">
          {secretGroups(secret).map((group, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: los grupos de una clave no cambian de sitio.
            <span key={i}>{group}</span>
          ))}
        </code>
        <Button
          size="sm"
          className={cn('self-stretch sm:self-center', copied && 'text-success hover:text-success')}
          onClick={() => void copy()}
        >
          {copied ? (
            <Icon name="check" size={14} weight="bold" />
          ) : (
            <AppIcon name="copy" size={14} />
          )}
          {copied ? 'Copiada' : 'Copiar clave'}
        </Button>
      </div>
      <p className="flex gap-2 text-xs text-fg-subtle">
        <Icon name="info" size={14} className="mt-px shrink-0" />
        Muninn aún no tiene códigos de recuperación: esta clave es tu copia de seguridad.
      </p>
    </>
  )
}

const ENROLL_FORM = 'mfa-alta'
const ENROLL_CODE = 'mfa-alta-codigo'

/** Activar: escanear → guardar la clave → confirmar el código, y un final con el check. */
export function ActivarSegundoFactor({ onClose }: { onClose: () => void }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const begin = async () => {
    setLoadError(null)
    try {
      setEnrollment(await m.account.mfa.enroll())
    } catch (err) {
      setLoadError(errorText(err))
    }
  }
  // Una sola alta por apertura: en desarrollo, StrictMode ejecuta los efectos dos veces y la segunda borraría la primera.
  const started = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al abrir.
  useEffect(() => {
    if (started.current) return
    started.current = true
    void begin()
  }, [])

  const confirm = async (value: string) => {
    if (!enrollment || busy || value.length < 6) return
    setBusy(true)
    setError(null)
    try {
      await m.account.mfa.confirm(enrollment.factorId, value)
      setStep(3)
      notify.success('Segundo factor activado', {
        icon: 'user',
        description: 'Al entrar, te pediremos un código de tu app.',
      })
      // También las sesiones: la de este dispositivo pasa a «con segundo factor».
      void qc.invalidateQueries({ queryKey: ['account'] })
    } catch (err) {
      setError(errorText(err))
      setCode('')
      refocus(ENROLL_CODE)
    }
    setBusy(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void confirm(code)
  }

  const back = (
    <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
      Atrás
    </Button>
  )
  const footer =
    step === 3 ? (
      <Button variant="primary" onClick={onClose}>
        Hecho
      </Button>
    ) : !enrollment ? (
      <Button variant="ghost" onClick={onClose}>
        Cancelar
      </Button>
    ) : step === 2 ? (
      <>
        {back}
        <Button
          type="submit"
          form={ENROLL_FORM}
          variant="primary"
          disabled={busy || code.length < 6}
        >
          {busy ? 'Comprobando…' : 'Activar'}
        </Button>
      </>
    ) : (
      <>
        {step > 0 ? back : null}
        <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
          Siguiente
        </Button>
      </>
    )

  return (
    <Ventana
      title="Activar el segundo factor"
      footer={footer}
      onClose={onClose}
      keepOnOutsideClick={step < 3}
    >
      <Steps current={step} />
      {loadError ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-danger">No se pudo preparar el alta. {loadError}</p>
          <Button size="sm" onClick={() => void begin()}>
            Reintentar
          </Button>
        </div>
      ) : !enrollment ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-fg-subtle">
          <span className="mn-spinner" aria-hidden="true" />
          Preparando tu código…
        </div>
      ) : (
        // La clave hace que cada paso entre con su pequeño desplazamiento.
        <div key={step} className="flex animate-step-in flex-col gap-4">
          {step === 0 ? <ScanStep enrollment={enrollment} onManual={() => setStep(1)} /> : null}
          {step === 1 ? <KeyStep secret={enrollment.secret} /> : null}
          {step === 2 ? (
            <form id={ENROLL_FORM} onSubmit={submit} noValidate className="flex flex-col gap-4">
              <p className="text-sm text-fg-muted">
                Escribe el código de seis cifras que te enseña ahora tu app para{' '}
                <span className="font-medium text-fg">Muninn</span>. Al completarlo, lo comprobamos.
              </p>
              <CodeField
                id={ENROLL_CODE}
                label="Código de la app"
                hint="Cambia cada 30 segundos: si está a punto de cambiar, espera al siguiente."
                autoFocus
                value={code}
                onChange={(v) => {
                  setCode(v)
                  if (error) setError(null)
                }}
                onComplete={(v) => void confirm(v)}
                error={error}
                disabled={busy}
                className="items-center [&>label]:self-start"
              />
            </form>
          ) : null}
          {step === 3 ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <SuccessMark />
              <p className="mt-2 text-lg font-semibold">Tu cuenta está más protegida</p>
              <p className="max-w-[340px] text-sm text-fg-muted">
                Cuando entres en un dispositivo nuevo, después del correo o de GitHub te pediremos
                un código de tu app.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Ventana>
  )
}

// ─── Desactivar ──────────────────────────────────────────────────────────────

const DISABLE_FORM = 'mfa-baja'
const DISABLE_CODE = 'mfa-baja-codigo'

/** Desactivar: pide un código actual y avisa de lo que supone. Sin envío automático: es lo que quita protección. */
export function DesactivarSegundoFactor({ onClose }: { onClose: () => void }) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || code.length < 6) return
    setBusy(true)
    setError(null)
    try {
      await m.account.mfa.disable(code)
      notify.success('Segundo factor desactivado', {
        icon: 'user',
        description: 'Ya no te pediremos el código al entrar.',
      })
      void qc.invalidateQueries({ queryKey: ['account'] })
      onClose()
    } catch (err) {
      setError(errorText(err))
      setCode('')
      setBusy(false)
      refocus(DISABLE_CODE)
    }
  }

  return (
    <Ventana
      title="Desactivar el segundo factor"
      description="Para confirmarlo, escribe el código que sale ahora en tu app."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={DISABLE_FORM}
            variant="danger"
            disabled={busy || code.length < 6}
          >
            {busy ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </>
      }
    >
      <form id={DISABLE_FORM} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <CodeField
          id={DISABLE_CODE}
          label="Código de la app"
          autoFocus
          value={code}
          onChange={(v) => {
            setCode(v)
            if (error) setError(null)
          }}
          error={error}
          disabled={busy}
          className="items-center [&>label]:self-start"
        />
        <div className="flex gap-2.5 rounded-lg bg-danger-soft p-3 text-sm text-fg-muted">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-danger" />
          <p>
            Para entrar bastará con el código del correo o con GitHub, y el servidor dejará de
            exigir tu app. Para volver a activarlo, tendrás que añadir Muninn otra vez a tu app.
          </p>
        </div>
      </form>
    </Ventana>
  )
}
