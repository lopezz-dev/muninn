import { Button, Icon, notify, Switch, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import {
  DEFAULT_ASSISTANT,
  normalizeUrl,
  saveAssistantPrefs,
  useAssistantPrefs,
} from '../../lib/assistant-settings'
import { useEnabledModules } from '../../lib/modules'
import { changeReportPrefs, reportPrefs } from '../../lib/morning-report-prefs'
import { useAuth, useMuninn } from '../../lib/muninn'
import { fail } from '../../lib/mutations'
import { settingsQuery } from '../../lib/queries'
import { bySection, resetPrefs, useChangedPrefs } from '../../lib/settings-changes'
import { PrefGroup, PrefRow } from './ui'

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
 * Ajustes › Modelo local (ADR-0041): dónde está Ollama y qué modelo usa. Se guarda en la cuenta. El cerebro es siempre
 * local; Claude se conecta aparte, por MCP. No llevan marca de «cambiado»: son configuración de tu equipo (ADR-0053).
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
    <>
      <PrefGroup title="Estado" icon="assistant">
        <PrefRow
          icon="assistant"
          tile="bg-project-green/15 text-project-green"
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
        </PrefRow>
      </PrefGroup>
      <PrefGroup title="Conexión" icon="sync" padded>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div id="ajuste-ollama">
              <TextField
                label="Dirección de Ollama"
                hint="Normalmente no hace falta cambiarla."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                spellCheck={false}
              />
            </div>
            <div id="ajuste-modelo">
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
            </div>
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
      </PrefGroup>
      <p className="px-0.5 text-xs text-fg-faint">
        {auth.kind === 'user'
          ? 'Se guarda en tu cuenta. Solo se usa en el ordenador donde está Ollama: en el móvil no hay modelo.'
          : 'En la demo el asistente responde con un guion y no usa Ollama.'}{' '}
        <Link
          to="/documentacion/$pagina"
          params={{ pagina: 'asistente' }}
          hash="instalar-ollama"
          className="underline"
        >
          Cómo instalarlo
        </Link>
      </p>
    </>
  )
}

/**
 * Ajustes › Informe de la mañana (ADR-0043): activarlo, la hora y «Hacer ahora». Se prepara en el ordenador que tenga
 * Muninn abierto a esa hora (o al abrirlo después) y se guarda como nota fijada.
 */
export function InformeAjustes() {
  const m = useMuninn()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const modules = useEnabledModules()
  const prefs = reportPrefs(useQuery(settingsQuery(m)).data)
  const changed = bySection(useChangedPrefs()).informe ?? []
  const [time, setTime] = useState(prefs.time)
  const [busy, setBusy] = useState(false)
  useEffect(() => setTime(prefs.time), [prefs.time])

  const now = async () => {
    setBusy(true)
    const id = notify.loading('Preparando tu informe…', { icon: 'assistant' })
    try {
      // Diferido: lleva @muninn/assistant, que Ajustes no necesita para nada más.
      const { generateMorningReport } = await import('../../lib/morning-report')
      const note = await generateMorningReport(m, qc, { modules, force: true })
      notify.dismiss(id)
      if (note) {
        notify.success('Informe listo', {
          icon: 'assistant',
          id: `morning-report-${note.id}`,
          action: {
            label: 'Abrir',
            onClick: () => void navigate({ to: '/notas/$noteId', params: { noteId: note.id } }),
          },
        })
      }
    } catch (err) {
      notify.dismiss(id)
      fail('No se pudo preparar el informe', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PrefGroup title="Cada día" icon="sun">
        <PrefRow
          id="informe-activo"
          icon="sun"
          tile="bg-project-amber/15 text-project-amber"
          title="Informe de la mañana"
          description="Tus tareas de hoy y vencidas, los cobros próximos y el resumen de noticias, en una nota fijada."
          htmlFor="ajuste-informe-switch"
          changed={changed.includes('reportEnabled')}
          onReset={() => void resetPrefs(m, qc, ['reportEnabled'], 'Informe desactivado')}
        >
          <Switch
            id="ajuste-informe-switch"
            checked={prefs.enabled}
            onCheckedChange={(enabled) => void changeReportPrefs(m, qc, { enabled })}
          />
        </PrefRow>
        <PrefRow
          id="informe-hora"
          icon="clock"
          title="Hora"
          description="Si a esa hora el ordenador está apagado, se hace al abrir Muninn ese día (y lo dice)."
          changed={changed.includes('reportTime')}
          onReset={() => void resetPrefs(m, qc, ['reportTime'], 'Hora del informe: 08:30')}
          resetLabel="Volver a las 08:30"
        >
          <TextField
            label="Hora del informe"
            hideLabel
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => {
              if (/^\d{2}:\d{2}$/.test(time) && time !== prefs.time)
                void changeReportPrefs(m, qc, { time })
            }}
            className="w-32"
          />
        </PrefRow>
      </PrefGroup>
      <PrefGroup title="Ahora" icon="assistant">
        <PrefRow
          id="informe-ahora"
          icon="assistant"
          title="Hacer ahora"
          description={
            prefs.lastDate
              ? `El último es del ${prefs.lastDate}. Si ya hay uno hoy, se hace otro.`
              : 'Para ver cómo queda. Usa el modelo de este ordenador si está listo.'
          }
        >
          <Button onClick={now} disabled={busy}>
            <Icon name="assistant" size={14} />
            {busy ? 'Preparando…' : 'Hacer ahora'}
          </Button>
        </PrefRow>
      </PrefGroup>
    </>
  )
}
