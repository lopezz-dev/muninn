import { Button, Card, Icon } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { AssistantAvailability } from '../../lib/assistant-status'

/** El chip del cerebro en la cabecera: verde si está listo, ámbar si falta algo. */
export function BrainChip({ status, label }: { status: AssistantAvailability; label: string }) {
  const { t } = useTranslation('assistant')
  const ready = status.state === 'ready'
  const text =
    status.state === 'handheld'
      ? t('brain.handheld')
      : status.state === 'checking'
        ? t('brain.checking')
        : status.state === 'offline'
          ? t('brain.offline')
          : status.state === 'no-model'
            ? t('brain.missing', { model: status.model })
            : label
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-fg-muted">
      <span
        aria-hidden="true"
        className={
          ready ? 'size-1.5 rounded-full bg-success' : 'size-1.5 rounded-full bg-project-amber'
        }
      />
      <span className="truncate">{text}</span>
    </span>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-raised text-xs font-semibold text-fg-muted">
        {n}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  )
}

/** Sin `children` cuando lo pone `<Trans>` (las etiquetas `<code>` del texto). */
const Code = ({ children }: { children?: ReactNode }) => (
  <code className="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px] break-all text-fg">
    {children}
  </code>
)

interface Props {
  status: AssistantAvailability
  url: string
  onRetry: () => void
}

/**
 * Lo que se ve cuando el asistente no puede contestar, con los pasos para arreglarlo (ADR-0041): en el móvil no hay
 * modelo; en el ordenador, Ollama apagado o el modelo sin descargar.
 */
export function ModelState({ status, url, onRetry }: Props) {
  const { t } = useTranslation('assistant')
  if (status.state === 'ready' || status.state === 'checking') return null
  if (status.state === 'handheld') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="flex items-center gap-2 text-md font-semibold">
          <Icon name="assistant" className="text-accent" />
          {t('state.handheldTitle')}
        </h2>
        <p className="text-sm text-fg-muted text-pretty">{t('state.handheldBody')}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/documentacion/$pagina" params={{ pagina: 'asistente' }}>
              {t('state.howItWorks')}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/documentacion/$pagina" params={{ pagina: 'asistentes-ia' }}>
              {t('state.useClaude')}
            </Link>
          </Button>
        </div>
      </Card>
    )
  }
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 text-md font-semibold">
          <Icon name="warning" className="text-project-amber" />
          {status.state === 'offline'
            ? t('state.offlineTitle')
            : t('state.missingTitle', { model: status.model })}
        </h2>
        <p className="text-sm text-fg-muted text-pretty">
          {status.state === 'offline'
            ? t('state.offlineBody', { url })
            : `${t('state.missingBody')}${status.models.length ? ` ${t('state.youHave', { models: status.models.join(', ') })}` : ''}`}
        </p>
      </div>
      <ol className="flex flex-col gap-2.5 text-sm">
        {status.state === 'offline' ? (
          <>
            <Step n={1}>
              <Trans t={t} i18nKey="state.installStep" components={{ code: <Code /> }} />
            </Step>
            <Step n={2}>
              <Trans t={t} i18nKey="state.originsStep" components={{ code: <Code /> }} />
            </Step>
            <Step n={3}>
              <Trans t={t} i18nKey="state.pullStep" components={{ code: <Code /> }} />
            </Step>
          </>
        ) : (
          <Step n={1}>
            <Trans
              t={t}
              i18nKey="state.missingStep"
              values={{ model: status.model }}
              components={{ code: <Code /> }}
            />
          </Step>
        )}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onRetry}>
          <Icon name="sync" size={14} />
          {t('state.retry')}
        </Button>
        <Button asChild>
          <Link to="/documentacion/$pagina" params={{ pagina: 'asistente' }}>
            {t('state.guide')}
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/ajustes/$seccion" params={{ seccion: 'asistente' }}>
            {t('state.settings')}
          </Link>
        </Button>
        <span className="text-xs text-fg-faint">{t('state.autoCheck')}</span>
      </div>
    </Card>
  )
}
