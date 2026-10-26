import { Button, Card, Icon, notify, TextField } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import {
  DEFAULT_ASSISTANT,
  normalizeUrl,
  saveAssistantPrefs,
  useAssistantPrefs,
} from '../../lib/assistant-settings'
import { useAuth, useMuninn } from '../../lib/muninn'

function Row({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-border-subtle py-3 first:border-t-0">
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className="text-base font-medium">{title}</span>
        {description ? <span className="text-[12.5px] text-fg-subtle">{description}</span> : null}
      </div>
      {children}
    </div>
  )
}

/** Modelos que hay en Ollama ahora mismo (sin cargar `@muninn/assistant`: es una sola petición). */
async function listModels(url: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) return null
    const body = (await res.json()) as { models?: { name?: string }[] }
    return (body.models ?? []).map((m) => m.name ?? '').filter(Boolean)
  } catch {
    return null
  }
}

/**
 * Ajustes › Asistente e IA (Ajustes.dc.html, ADR-0041): dónde está Ollama y qué modelo usa. Se guarda en la cuenta. El
 * cerebro es siempre local; Claude se conecta aparte, por MCP.
 */
export function AsistenteAjustes() {
  const m = useMuninn()
  const qc = useQueryClient()
  const auth = useAuth()
  const prefs = useAssistantPrefs()
  const [url, setUrl] = useState(prefs.ollamaUrl)
  const [model, setModel] = useState(prefs.model)
  const [models, setModels] = useState<string[] | null | undefined>(undefined)

  useEffect(() => setUrl(prefs.ollamaUrl), [prefs.ollamaUrl])
  useEffect(() => setModel(prefs.model), [prefs.model])

  const check = async (target = prefs.ollamaUrl) => {
    setModels(undefined)
    const found = await listModels(target)
    setModels(found)
    return found
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: se comprueba al entrar y al cambiar la dirección guardada
  useEffect(() => {
    void check()
  }, [prefs.ollamaUrl])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const next = { ollamaUrl: normalizeUrl(url), model: model.trim() || DEFAULT_ASSISTANT.model }
    if (next.ollamaUrl === prefs.ollamaUrl && next.model === prefs.model) {
      notify.info('No has cambiado nada')
      return
    }
    await saveAssistantPrefs(m, qc, next, { label: 'Ajustes del asistente guardados' })
  }

  const test = async () => {
    const found = await check(normalizeUrl(url))
    if (found === null)
      notify.error('Ollama no responde', { description: `No hay nada en ${normalizeUrl(url)}` })
    else if (!found.some((x) => x === model || x === `${model}:latest`)) {
      notify.error(`Ollama responde, pero falta ${model}`, { description: `ollama pull ${model}` })
    } else notify.success('Ollama está listo', { icon: 'assistant', description: model })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="px-[18px] py-1.5">
        <Row
          title="Cerebro"
          description="Un modelo que corre en tu ordenador con Ollama: gratis y privado, tus datos no salen de casa."
        >
          <span className="flex items-center gap-1.5 text-sm text-fg-muted">
            <span
              aria-hidden="true"
              className={
                models?.length
                  ? 'size-1.5 rounded-full bg-success'
                  : 'size-1.5 rounded-full bg-project-amber'
              }
            />
            {models === undefined
              ? 'Comprobando…'
              : models === null
                ? 'Ollama no responde'
                : 'Local · Ollama'}
          </span>
        </Row>
        <form onSubmit={save} className="flex flex-col gap-3 border-t border-border-subtle py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Dirección de Ollama"
              hint="Normalmente no hace falta cambiarla."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              spellCheck={false}
            />
            <TextField
              label="Modelo"
              hint={
                models?.length
                  ? `En tu Ollama: ${models.join(', ')}`
                  : `Recomendado: ${DEFAULT_ASSISTANT.model} (5,2 GB).`
              }
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="asistente-modelos"
              spellCheck={false}
            />
            <datalist id="asistente-modelos">
              {(models ?? []).map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              Guardar
            </Button>
            <Button onClick={test}>
              <Icon name="sync" size={14} />
              Probar conexión
            </Button>
          </div>
        </form>
        <p className="border-t border-border-subtle py-3 text-xs text-fg-faint">
          {auth.kind === 'user'
            ? 'Se guarda en tu cuenta. Solo se usa en el ordenador donde está Ollama: en el móvil no hay modelo.'
            : 'En la demo el asistente responde con un guion y no usa Ollama.'}{' '}
          <Link to="/documentacion/$pagina" params={{ pagina: 'asistente' }} className="underline">
            Cómo instalarlo
          </Link>
        </p>
      </Card>
    </div>
  )
}
