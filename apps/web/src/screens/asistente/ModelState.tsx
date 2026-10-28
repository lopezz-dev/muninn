import { Button, Card, Icon } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { AssistantAvailability } from '../../lib/assistant-status'

/** El chip del cerebro en la cabecera: verde si está listo, ámbar si falta algo. */
export function BrainChip({ status, label }: { status: AssistantAvailability; label: string }) {
  const ready = status.state === 'ready'
  const text =
    status.state === 'handheld'
      ? 'Sin modelo en este dispositivo'
      : status.state === 'checking'
        ? 'Buscando Ollama…'
        : status.state === 'offline'
          ? 'Ollama no responde'
          : status.state === 'no-model'
            ? `Falta ${status.model}`
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

const Code = ({ children }: { children: ReactNode }) => (
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
  if (status.state === 'ready' || status.state === 'checking') return null
  if (status.state === 'handheld') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="flex items-center gap-2 text-md font-semibold">
          <Icon name="assistant" className="text-accent" />
          El asistente usa el modelo de tu ordenador
        </h2>
        <p className="text-sm text-fg-muted text-pretty">
          Muninn piensa con un modelo que corre en tu ordenador, y en este dispositivo no hay
          ninguno. Para preguntarle, abre Muninn en el ordenador donde está Ollama. Desde aquí
          puedes usar Claude con el conector de Muninn, y todo lo que cambie el asistente lo verás
          en tus tareas y en su historial.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/documentacion/$pagina" params={{ pagina: 'asistente' }}>
              Cómo funciona
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/documentacion/$pagina" params={{ pagina: 'asistentes-ia' }}>
              Usar Claude
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
            ? 'No encuentro Ollama en este ordenador'
            : `Falta el modelo ${status.model}`}
        </h2>
        <p className="text-sm text-fg-muted text-pretty">
          {status.state === 'offline'
            ? `El asistente habla con Ollama en ${url} y no responde: puede que no esté instalado, que esté cerrado o que no acepte peticiones de Muninn.`
            : `Ollama está en marcha, pero no tiene descargado el modelo que elegiste.${status.models.length ? ` Tienes: ${status.models.join(', ')}.` : ''}`}
        </p>
      </div>
      <ol className="flex flex-col gap-2.5 text-sm">
        {status.state === 'offline' ? (
          <>
            <Step n={1}>
              Instala Ollama desde <Code>ollama.com/download</Code> (o ábrelo si ya lo tienes: vive
              en la bandeja del sistema).
            </Step>
            <Step n={2}>
              Permite que Muninn le hable: variable <Code>OLLAMA_ORIGINS</Code> con los orígenes de
              la guía y reinicia Ollama.
            </Step>
            <Step n={3}>
              Descarga el modelo: <Code>ollama pull qwen3:8b</Code>.
            </Step>
          </>
        ) : (
          <Step n={1}>
            En una terminal: <Code>ollama pull {status.model}</Code>, o elige otro modelo en Ajustes
            › Asistente e IA.
          </Step>
        )}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onRetry}>
          <Icon name="sync" size={14} />
          Reintentar
        </Button>
        <Button asChild>
          <Link to="/documentacion/$pagina" params={{ pagina: 'asistente' }}>
            Guía paso a paso
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/ajustes/$seccion" params={{ seccion: 'asistente' }}>
            Ajustes del asistente
          </Link>
        </Button>
        <span className="text-xs text-fg-faint">
          Se vuelve a comprobar solo cada pocos segundos.
        </span>
      </div>
    </Card>
  )
}
