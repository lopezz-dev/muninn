import { ACCENTS, type AccentName, Avatar, Button, icons, Kbd, Switch } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { EmptyState } from '../../components/Page'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { ACCENT_LABEL, changeAppearance, useAppearance } from '../../lib/appearance'
import { isTauri } from '../../lib/auth'
import { externalLink } from '../../lib/external-link'
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
import { Sesiones } from './Seguridad'
import { type SettingsSection, settingsSection } from './sections'
import { HelpAside, PrefGroup, PrefRow, SectionHeader, useFlashHash } from './ui'

const route = getRouteApi('/_app/ajustes/$seccion')

const ACCENT_OPTIONS: Swatch<AccentName>[] = (Object.keys(ACCENTS) as AccentName[]).map((a) => ({
  value: a,
  label: ACCENT_LABEL[a],
  color: ACCENTS[a],
}))

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Código por correo',
  github: 'GitHub',
}

/** Para resetear desde una fila o desde la cabecera de la sección. */
export function useReset(section: string) {
  const m = useMuninn()
  const qc = useQueryClient()
  const changed = bySection(useChangedPrefs())[section] ?? []
  const reset = (keys: PrefKey[], label: string) => void resetPrefs(m, qc, keys, label)
  return { changed, reset }
}

function Cuenta() {
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
        title="Estás en modo demo"
        actions={
          <>
            <Button asChild variant="primary">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button onClick={end} disabled={busy}>
              Salir del modo demo
            </Button>
          </>
        }
      >
        Tus datos viven en memoria y se pierden al recargar. Inicia sesión para guardarlos en tu
        cuenta y verlos en todos tus dispositivos.
      </EmptyState>
    )
  }

  const { account } = auth
  return (
    <>
      <PrefGroup title="Perfil" icon="user">
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
      <PrefGroup title="Acceso" icon="link">
        <PrefRow
          id="acceso"
          icon={account.provider === 'github' ? 'github' : 'send'}
          title="Método de acceso"
          description="Sin contraseñas: entras con un código o con GitHub."
        >
          <span className="text-sm text-fg-muted">
            {PROVIDER_LABEL[account.provider] ?? account.provider}
          </span>
        </PrefRow>
        <PrefRow
          id="sesion"
          icon="close"
          title="Sesión"
          description="Se cierra solo en este dispositivo. Tus datos siguen en tu cuenta."
        >
          <Button onClick={end} disabled={busy}>
            {busy ? 'Cerrando…' : 'Cerrar sesión'}
          </Button>
        </PrefRow>
      </PrefGroup>
      <SegundoFactor />
      <Sesiones />
      <AppsConAcceso />
    </>
  )
}

function Datos() {
  const auth = useAuth()
  if (auth.kind === 'demo') {
    return (
      <EmptyState
        icon="sync"
        title="Datos en memoria"
        actions={
          <Button asChild variant="primary">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        }
      >
        Estás en modo demo: tus datos viven en memoria y se pierden al recargar. Con una cuenta se
        guardan en el servidor y los ves en todos tus dispositivos.
      </EmptyState>
    )
  }
  return (
    <PrefGroup title="Tus datos" icon="sync">
      <PrefRow
        id="donde"
        icon="archive"
        title="Dónde se guardan"
        description="En tu cuenta de Muninn, en un servidor de la Unión Europea (París). Solo tú puedes verlos."
      >
        <span className="flex items-center gap-1.5 text-sm text-fg-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          Guardado
        </span>
      </PrefRow>
      <PrefRow
        id="dispositivos"
        icon="sync"
        title="Entre dispositivos"
        description="Entra con la misma cuenta y verás lo mismo. Lo que cambies en otro dispositivo aparece al momento, sin recargar."
      >
        <span className="text-sm text-fg-muted">Al momento</span>
      </PrefRow>
      <PrefRow
        id="sin-conexion"
        icon="download"
        title="Sin conexión"
        description="La app guarda en este dispositivo lo último que viste: puedes abrirla y consultarlo sin red. Para cambiar algo necesitas conexión. Al cerrar sesión, se borra."
      >
        <span className="text-sm text-fg-muted">Solo lectura</span>
      </PrefRow>
    </PrefGroup>
  )
}

function Apariencia() {
  const auth = useAuth()
  const appearance = useAppearance()
  const { changed, reset } = useReset('apariencia')
  return (
    <>
      <PrefGroup title="Tema" icon="glass">
        <PrefRow
          id="tema"
          icon="palette"
          title="Modo"
          description="Muninn está pensado en oscuro. El tema claro llegará más adelante."
        >
          <span className="flex items-center gap-2 text-sm text-fg-muted">
            Oscuro
            <span className="inline-flex items-center gap-1 rounded-xs border border-dashed border-border-strong px-1.5 py-px text-2xs font-semibold tracking-wide uppercase">
              <icons.clock size={10} aria-hidden="true" />
              Claro, próximamente
            </span>
          </span>
        </PrefRow>
        <PrefRow
          id="cristal"
          icon="glass"
          title="Cristal"
          description="Desenfoque translúcido en paneles y menús de toda la app."
          htmlFor="ajuste-cristal-switch"
          changed={changed.includes('glass')}
          onReset={() => reset(['glass'], 'Cristal restablecido')}
        >
          <Switch
            id="ajuste-cristal-switch"
            checked={appearance.glass}
            onCheckedChange={(glass) => changeAppearance({ glass })}
          />
        </PrefRow>
      </PrefGroup>
      <PrefGroup title="Color" icon="palette">
        <PrefRow
          id="acento"
          icon="palette"
          tile="bg-accent-soft text-accent"
          title="Color de acento"
          description="Botones, selección y la pestaña activa de la barra de abajo. Por defecto, ámbar."
          changed={changed.includes('accent')}
          onReset={() => reset(['accent'], 'Acento restablecido')}
          resetLabel="Volver a ámbar"
        >
          <SwatchPicker
            legend="Color de acento"
            hideLegend
            name="accent"
            value={appearance.accent}
            options={ACCENT_OPTIONS}
            onChange={(accent) => changeAppearance({ accent })}
          />
        </PrefRow>
      </PrefGroup>
      <p className="px-0.5 text-xs text-fg-faint">
        {auth.kind === 'user'
          ? 'Se guarda en tu cuenta: te sigue a todos tus dispositivos.'
          : 'Se guarda en este dispositivo. Cuando inicies sesión, te seguirá a todos.'}
      </p>
    </>
  )
}

const SHORTCUTS: { group: string; id: string; items: { keys: string[]; action: string }[] }[] = [
  {
    group: 'Buscador',
    id: 'atajos-buscador',
    items: [
      { keys: [PALETTE_SHORTCUT], action: 'Abrir o cerrar el buscador' },
      { keys: ['↑', '↓'], action: 'Moverse por los resultados' },
      { keys: ['↵'], action: 'Abrir el resultado elegido' },
      { keys: ['/'], action: 'Ir al buscador de Ajustes o de la Documentación' },
    ],
  },
  {
    group: 'Tablero',
    id: 'atajos-tablero',
    items: [
      { keys: ['N'], action: 'Nueva tarea (fuera de un campo de texto)' },
      { keys: ['Espacio'], action: 'Con una tarjeta o columna enfocada, recogerla y soltarla' },
      { keys: ['←', '↑', '→', '↓'], action: 'Con algo recogido, moverlo' },
    ],
  },
  {
    group: 'En toda la app',
    id: 'atajos-general',
    items: [
      {
        keys: [USER_MENU_SHORTCUT],
        action: 'Abrir el menú de tu cuenta, al pie de la barra lateral',
      },
      { keys: ['Esc'], action: 'Cerrar un diálogo, un menú o el panel de una tarea' },
      { keys: ['Tab'], action: 'Pasar al siguiente control (el primero: «Saltar al contenido»)' },
    ],
  },
]

function Atajos() {
  return (
    <>
      {SHORTCUTS.map((g) => (
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
  return (
    <PrefGroup title="Muninn" icon="info">
      <PrefRow
        id="version"
        icon="info"
        title="Versión"
        description={
          isTauri
            ? 'En el ordenador, Muninn busca versiones nuevas al abrirse y te avisa con «Reiniciar».'
            : 'En el navegador y en el móvil, la app se actualiza sola al volver a abrirla.'
        }
      >
        <span className="font-mono text-sm text-fg-muted">v{__APP_VERSION__}</span>
      </PrefRow>
      <PrefRow
        icon="docs"
        title="Documentación"
        description="Guías de cada parte de Muninn: qué funciona ya y qué falta."
      >
        <Button asChild size="sm">
          <Link to="/documentacion">Abrir</Link>
        </Button>
      </PrefRow>
      <PrefRow
        icon="github"
        title="Código"
        description="Muninn es de código abierto, con licencia MIT."
      >
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

export const RESET_LABEL: Record<string, string> = {
  apariencia: 'Apariencia restablecida',
  informe: 'Informe de la mañana restablecido',
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
        onReset={() =>
          reset(changed, RESET_LABEL[section.id] ?? `${section.label}: valores de fábrica`)
        }
      />
      <SectionContent section={section} />
    </>
  )
}

export function Seccion() {
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
