import { Button, Icon, notify, Switch, TextField } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GuideLink } from '../../components/GuideLink'
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
  const { t } = useTranslation('integrations')
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
      notify.info(t('assistant.nothingChanged'))
      return
    }
    await saveAssistantPrefs(m, qc, next, { label: t('assistant.saved') })
  }

  const test = async () => {
    const found = await check(normalizeUrl(url))
    if (found === null)
      notify.error(t('assistant.ollamaDown'), {
        description: t('assistant.nothingAt', { url: normalizeUrl(url) }),
      })
    else if (!found.some((x) => x === model || x === `${model}:latest`)) {
      notify.error(t('assistant.modelMissing', { model }), { description: `ollama pull ${model}` })
    } else notify.success(t('assistant.ollamaReady'), { icon: 'assistant', description: model })
  }

  return (
    <>
      <PrefGroup title={t('assistant.statusTitle')} icon="assistant">
        <PrefRow
          icon="assistant"
          tile="bg-project-green/15 text-project-green"
          title={t('assistant.brain')}
          description={t('assistant.brainHint')}
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
              ? t('assistant.checking')
              : models === null
                ? t('assistant.ollamaDown')
                : t('assistant.local')}
          </span>
        </PrefRow>
      </PrefGroup>
      <PrefGroup title={t('assistant.connection')} icon="sync" padded>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div id="ajuste-ollama">
              <TextField
                label={t('assistant.ollamaUrl')}
                hint={t('assistant.ollamaUrlHint')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                spellCheck={false}
              />
            </div>
            <div id="ajuste-modelo">
              <TextField
                label={t('assistant.model')}
                hint={
                  models?.length
                    ? t('assistant.inYourOllama', { models: models.join(', ') })
                    : t('assistant.recommended', { model: DEFAULT_ASSISTANT.model })
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
              {t('assistant.save')}
            </Button>
            <Button onClick={test}>
              <Icon name="sync" size={14} />
              {t('assistant.testConnection')}
            </Button>
          </div>
        </form>
      </PrefGroup>
      <p className="px-0.5 text-xs text-fg-faint">
        {auth.kind === 'user' ? t('assistant.savedInAccount') : t('assistant.demo')}{' '}
        <GuideLink
          doc="assistant"
          hash={{ en: 'install-ollama', es: 'instalar-ollama' }}
          className="underline"
        >
          {t('assistant.howToInstall')}
        </GuideLink>
      </p>
    </>
  )
}

/**
 * Ajustes › Informe de la mañana (ADR-0043): activarlo, la hora y «Hacer ahora». Se prepara en el ordenador que tenga
 * Muninn abierto a esa hora (o al abrirlo después) y se guarda como nota fijada.
 */
export function InformeAjustes() {
  const { t } = useTranslation('integrations')
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
    const id = notify.loading(t('report.preparing'), { icon: 'assistant' })
    try {
      // Diferido: lleva @muninn/assistant, que Ajustes no necesita para nada más.
      const { generateMorningReport } = await import('../../lib/morning-report')
      const note = await generateMorningReport(m, qc, { modules, force: true })
      notify.dismiss(id)
      if (note) {
        notify.success(t('report.ready'), {
          icon: 'assistant',
          id: `morning-report-${note.id}`,
          action: {
            label: t('report.open'),
            onClick: () => void navigate({ to: '/notes/$noteId', params: { noteId: note.id } }),
          },
        })
      }
    } catch (err) {
      notify.dismiss(id)
      fail(t('report.failed'), err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PrefGroup title={t('report.daily')} icon="sun">
        <PrefRow
          id="informe-activo"
          icon="sun"
          tile="bg-project-amber/15 text-project-amber"
          title={t('report.title')}
          description={t('report.description')}
          htmlFor="ajuste-informe-switch"
          changed={changed.includes('reportEnabled')}
          onReset={() => void resetPrefs(m, qc, ['reportEnabled'], t('report.turnedOff'))}
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
          title={t('report.time')}
          description={t('report.timeHint')}
          changed={changed.includes('reportTime')}
          onReset={() => void resetPrefs(m, qc, ['reportTime'], t('report.timeReset'))}
          resetLabel={t('report.timeResetLabel')}
        >
          <TextField
            label={t('report.timeLabel')}
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
      <PrefGroup title={t('report.now')} icon="assistant">
        <PrefRow
          id="informe-ahora"
          icon="assistant"
          title={t('report.makeNow')}
          description={
            prefs.lastDate ? t('report.lastOne', { date: prefs.lastDate }) : t('report.firstOne')
          }
        >
          <Button onClick={now} disabled={busy}>
            <Icon name="assistant" size={14} />
            {busy ? t('report.preparingShort') : t('report.makeNow')}
          </Button>
        </PrefRow>
      </PrefGroup>
    </>
  )
}
