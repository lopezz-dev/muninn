import {
  ACCENTS,
  type AccentName,
  Avatar,
  Button,
  icons,
  Kbd,
  SegmentedControl,
  Switch,
} from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../../components/Page'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { t } from '../../i18n'
import { browserLocale, type LocalePref } from '../../i18n/locale'
import { ACCENT_LABEL, changeAppearance, useAppearance } from '../../lib/appearance'
import { isTauri } from '../../lib/auth'
import { externalLink } from '../../lib/external-link'
import { changeLocale, useLocalePref } from '../../lib/locale-pref'
import { useAuth, useMuninn } from '../../lib/muninn'
import { useEndSession } from '../../lib/session'
import { bySection, type PrefKey, resetPrefs, useChangedPrefs } from '../../lib/settings-changes'
import { PALETTE_SHORTCUT, USER_MENU_SHORTCUT } from '../../shell/shell-context'
import { AppsConAcceso } from './AppsConAcceso'
import { AsistenteAjustes, InformeAjustes } from './AsistenteAjustes'
import { Barra } from './Barra'
import { Integraciones } from './Integraciones'
import { Modulos } from './Modulos'
import { Notificaciones } from './Notificaciones'
import { SegundoFactor } from './SegundoFactor'
import { AvisoDispositivoNuevo, Sesiones } from './Seguridad'
import { resetSectionLabel, type SettingsSection, settingsSection } from './sections'
import { HelpAside, PrefGroup, PrefRow, SectionHeader, useFlashHash } from './ui'

const route = getRouteApi('/_app/ajustes/$seccion')

// Funciones, no constantes: los textos se leen al pintar, en el idioma activo (ADR-0077).
const accentOptions = (): Swatch<AccentName>[] =>
  (Object.keys(ACCENTS) as AccentName[]).map((a) => ({
    value: a,
    label: ACCENT_LABEL[a],
    color: ACCENTS[a],
  }))

const providerLabel = (provider: string) =>
  provider === 'email'
    ? t('account.providerEmail', { ns: 'settings' })
    : provider === 'github'
      ? 'GitHub'
      : provider

/** Para resetear desde una fila o desde la cabecera de la sección. */
export function useReset(section: string) {
  const m = useMuninn()
  const qc = useQueryClient()
  const changed = bySection(useChangedPrefs())[section] ?? []
  const reset = (keys: PrefKey[], label: string) => void resetPrefs(m, qc, keys, label)
  return { changed, reset }
}

function Cuenta() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const endSession = useEndSession()
  const [busy, setBusy] = useState(false)
  const end = async () => {
    setBusy(true)
    await endSession(auth.kind)
    setBusy(false)
  }

  if (auth.kind === 'demo') {
    return (
      <EmptyState
        icon="user"
        title={t('account.demoTitle')}
        actions={
          <>
            <Button asChild variant="primary">
              <Link to="/login">{t('account.signIn')}</Link>
            </Button>
            <Button onClick={end} disabled={busy}>
              {t('account.leaveDemo')}
            </Button>
          </>
        }
      >
        {t('account.demoText')}
      </EmptyState>
    )
  }

  const { account } = auth
  return (
    <>
      <PrefGroup title={t('account.profile')} icon="user">
        <div className="flex items-center gap-3.5 px-4 py-4 md:px-[18px]">
          <Avatar name={account.name} src={account.avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-md font-semibold">{account.name}</span>
            {account.email && account.email !== account.name ? (
              <span className="truncate text-sm text-fg-subtle">{account.email}</span>
            ) : null}
          </div>
        </div>
      </PrefGroup>
      <PrefGroup title={t('account.access')} icon="link">
        <PrefRow
          id="acceso"
          icon={account.provider === 'github' ? 'github' : 'send'}
          title={t('account.method')}
          description={t('account.methodText')}
        >
          <span className="text-sm text-fg-muted">{providerLabel(account.provider)}</span>
        </PrefRow>
        <PrefRow
          id="sesion"
          icon="close"
          title={t('account.session')}
          description={t('account.sessionText')}
        >
          <Button onClick={end} disabled={busy}>
            {busy ? t('account.signingOut') : t('account.signOut')}
          </Button>
        </PrefRow>
      </PrefGroup>
      <SegundoFactor />
      <Sesiones />
      <AvisoDispositivoNuevo />
      <AppsConAcceso />
    </>
  )
}

function Datos() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  if (auth.kind === 'demo') {
    return (
      <EmptyState
        icon="sync"
        title={t('data.demoTitle')}
        actions={
          <Button asChild variant="primary">
            <Link to="/login">{t('account.signIn')}</Link>
          </Button>
        }
      >
        {t('data.demoText')}
      </EmptyState>
    )
  }
  return (
    <PrefGroup title={t('data.title')} icon="sync">
      <PrefRow id="donde" icon="archive" title={t('data.where')} description={t('data.whereText')}>
        <span className="flex items-center gap-1.5 text-sm text-fg-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          {t('data.saved')}
        </span>
      </PrefRow>
      <PrefRow
        id="dispositivos"
        icon="sync"
        title={t('data.devices')}
        description={t('data.devicesText')}
      >
        <span className="text-sm text-fg-muted">{t('data.instant')}</span>
      </PrefRow>
      <PrefRow
        id="sin-conexion"
        icon="download"
        title={t('data.offline')}
        description={t('data.offlineText')}
      >
        <span className="text-sm text-fg-muted">{t('data.readOnly')}</span>
      </PrefRow>
    </PrefGroup>
  )
}

/** Idioma de la app (ADR-0077): seguir al navegador o fijar uno. */
function IdiomaRow({ changed, onReset }: { changed: boolean; onReset: () => void }) {
  const { t } = useTranslation()
  const pref = useLocalePref()
  return (
    <PrefRow
      id="idioma"
      icon="globe"
      title={t('language.title')}
      description={t('language.description')}
      changed={changed}
      onReset={onReset}
    >
      <SegmentedControl<LocalePref>
        aria-label={t('language.title')}
        value={pref}
        onValueChange={(next) => void changeLocale(next)}
        options={[
          {
            value: 'auto',
            label: t('language.auto', { language: t(`language.${browserLocale()}`) }),
          },
          { value: 'en', label: t('language.en') },
          { value: 'es', label: t('language.es') },
        ]}
      />
    </PrefRow>
  )
}

function Apariencia() {
  const auth = useAuth()
  const appearance = useAppearance()
  const { changed, reset } = useReset('apariencia')
  const { t } = useTranslation(['settings', 'common'])
  return (
    <>
      <PrefGroup title={t('language.title', { ns: 'common' })} icon="globe">
        <IdiomaRow
          changed={changed.includes('locale')}
          onReset={() => reset(['locale'], t('language.restored', { ns: 'common' }))}
        />
      </PrefGroup>
      <PrefGroup title={t('appearance.theme')} icon="glass">
        <PrefRow
          id="tema"
          icon="palette"
          title={t('appearance.mode')}
          description={t('appearance.modeText')}
        >
          <span className="flex items-center gap-2 text-sm text-fg-muted">
            {t('appearance.dark')}
            <span className="inline-flex items-center gap-1 rounded-xs border border-dashed border-border-strong px-1.5 py-px text-2xs font-semibold tracking-wide uppercase">
              <icons.clock size={10} aria-hidden="true" />
              {t('appearance.lightSoon')}
            </span>
          </span>
        </PrefRow>
        <PrefRow
          id="cristal"
          icon="glass"
          title={t('appearance.glass')}
          description={t('appearance.glassText')}
          htmlFor="ajuste-cristal-switch"
          changed={changed.includes('glass')}
          onReset={() => reset(['glass'], t('appearance.glassReset'))}
        >
          <Switch
            id="ajuste-cristal-switch"
            checked={appearance.glass}
            onCheckedChange={(glass) => changeAppearance({ glass })}
          />
        </PrefRow>
      </PrefGroup>
      <PrefGroup title={t('appearance.color')} icon="palette">
        <PrefRow
          id="acento"
          icon="palette"
          tile="bg-accent-soft text-accent"
          title={t('appearance.accent')}
          description={t('appearance.accentText')}
          changed={changed.includes('accent')}
          onReset={() => reset(['accent'], t('appearance.accentReset'))}
          resetLabel={t('appearance.backToAmber')}
        >
          <SwatchPicker
            legend={t('appearance.accent')}
            hideLegend
            name="accent"
            value={appearance.accent}
            options={accentOptions()}
            onChange={(accent) => changeAppearance({ accent })}
          />
        </PrefRow>
      </PrefGroup>
      <p className="px-0.5 text-xs text-fg-faint">
        {auth.kind === 'user' ? t('savedToAccountFooter') : t('appearance.deviceFooter')}
      </p>
    </>
  )
}

/** Los atajos por grupo. Una función, no una constante: los textos se leen al pintar (ADR-0077). */
const shortcuts = (): {
  group: string
  id: string
  items: { keys: string[]; action: string }[]
}[] => [
  {
    group: t('shortcuts.search', { ns: 'settings' }),
    id: 'atajos-buscador',
    items: [
      { keys: [PALETTE_SHORTCUT], action: t('shortcuts.openSearch', { ns: 'settings' }) },
      { keys: ['↑', '↓'], action: t('shortcuts.moveResults', { ns: 'settings' }) },
      { keys: ['↵'], action: t('shortcuts.openResult', { ns: 'settings' }) },
      { keys: ['/'], action: t('shortcuts.focusSearch', { ns: 'settings' }) },
    ],
  },
  {
    group: t('shortcuts.board', { ns: 'settings' }),
    id: 'atajos-tablero',
    items: [
      { keys: ['N'], action: t('shortcuts.newTask', { ns: 'settings' }) },
      {
        keys: [t('shortcuts.space', { ns: 'settings' })],
        action: t('shortcuts.pickUp', { ns: 'settings' }),
      },
      { keys: ['←', '↑', '→', '↓'], action: t('shortcuts.moveItem', { ns: 'settings' }) },
    ],
  },
  {
    group: t('shortcuts.general', { ns: 'settings' }),
    id: 'atajos-general',
    items: [
      { keys: [USER_MENU_SHORTCUT], action: t('shortcuts.accountMenu', { ns: 'settings' }) },
      { keys: ['Esc'], action: t('shortcuts.close', { ns: 'settings' }) },
      { keys: ['Tab'], action: t('shortcuts.nextControl', { ns: 'settings' }) },
    ],
  },
]

function Atajos() {
  useTranslation('settings')
  return (
    <>
      {shortcuts().map((g) => (
        <PrefGroup key={g.id} title={g.group} icon="keyboard">
          <dl id={`ajuste-${g.id}`}>
            {g.items.map((s) => (
              <div
                key={s.action}
                className="flex items-center gap-3 border-t border-border-subtle px-4 py-3 first:border-t-0 md:px-[18px]"
              >
                <dt className="flex-1 text-base">{s.action}</dt>
                <dd className="flex gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </PrefGroup>
      ))}
    </>
  )
}

function Acerca() {
  const { t } = useTranslation('settings')
  return (
    <PrefGroup title="Muninn" icon="info">
      <PrefRow
        id="version"
        icon="info"
        title={t('about.version')}
        description={isTauri ? t('about.versionDesktop') : t('about.versionWeb')}
      >
        <span className="font-mono text-sm text-fg-muted">v{__APP_VERSION__}</span>
      </PrefRow>
      <PrefRow icon="docs" title={t('about.docs')} description={t('about.docsText')}>
        <Button asChild size="sm">
          <Link to="/documentacion">{t('about.open')}</Link>
        </Button>
      </PrefRow>
      <PrefRow icon="github" title={t('about.code')} description={t('about.codeText')}>
        <Button asChild size="sm">
          <a {...externalLink('https://github.com/lopezz-dev/muninn')}>
            GitHub
            <icons.external size={13} aria-hidden="true" />
          </a>
        </Button>
      </PrefRow>
    </PrefGroup>
  )
}

const BODY: Record<string, () => ReactNode> = {
  cuenta: () => <Cuenta />,
  apariencia: () => <Apariencia />,
  barra: () => <Barra />,
  atajos: () => <Atajos />,
  modulos: () => <Modulos />,
  notificaciones: () => <Notificaciones />,
  asistente: () => <AsistenteAjustes />,
  informe: () => <InformeAjustes />,
  integraciones: () => <Integraciones />,
  datos: () => <Datos />,
  acerca: () => <Acerca />,
}

/** El contenido de una sección, sin su cabecera: lo comparten la pantalla de Ajustes y la hoja «Tu cuenta» del móvil. */
export function SectionContent({ section }: { section: SettingsSection }) {
  const body = BODY[section.id]
  return body ? (
    body()
  ) : section.soon ? (
    <EmptyState icon="bell" title={section.label} soon={section.soon.phase}>
      {section.soon.text}
    </EmptyState>
  ) : null
}

function Body({ section }: { section: SettingsSection }) {
  const { changed, reset } = useReset(section.id)
  return (
    <>
      <SectionHeader
        section={section}
        changed={changed.length}
        onReset={() => reset(changed, resetSectionLabel(section))}
      />
      <SectionContent section={section} />
    </>
  )
}

export function Seccion() {
  useTranslation('settings')
  const { seccion } = route.useParams()
  const section = settingsSection(seccion)
  useFlashHash()
  if (!section) return null
  return (
    <div className="flex min-w-0 flex-1 gap-10 xl:gap-12">
      {/* En el móvil no se llega aquí: las secciones se abren en la hoja «Tu cuenta» (ADR-0072). */}
      <div className="flex min-w-0 max-w-[820px] flex-1 flex-col gap-6">
        <Body section={section} />
      </div>
      <HelpAside section={section} />
    </div>
  )
}
