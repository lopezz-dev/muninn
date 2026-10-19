import { ACCENTS, type AccentName, Avatar, Button, Card, Kbd, Switch } from '@muninn/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { EmptyState, PageHeader } from '../../components/Page'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { ACCENT_LABEL, changeAppearance, useAppearance } from '../../lib/appearance'
import { useAuth } from '../../lib/muninn'
import { useEndSession } from '../../lib/session'
import { PALETTE_SHORTCUT } from '../../shell/shell-context'
import { Integraciones } from './Integraciones'
import { Modulos } from './Modulos'
import { settingsSection } from './sections'

const route = getRouteApi('/_app/ajustes/$seccion')

const ACCENT_OPTIONS: Swatch<AccentName>[] = (Object.keys(ACCENTS) as AccentName[]).map((a) => ({
  value: a,
  label: ACCENT_LABEL[a],
  color: ACCENTS[a],
}))

function Row({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string
  description?: string
  htmlFor?: string
  children: ReactNode
}) {
  const Title = htmlFor ? 'label' : 'span'
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-border-subtle py-3 first:border-t-0">
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <Title htmlFor={htmlFor} className="text-base font-medium">
          {title}
        </Title>
        {description ? <span className="text-[12.5px] text-fg-subtle">{description}</span> : null}
      </div>
      {children}
    </div>
  )
}

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Código por correo',
  github: 'GitHub',
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
    <Card className="px-[18px] py-1.5">
      <div className="flex items-center gap-3.5 py-3">
        <Avatar name={account.name} src={account.avatarUrl} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-md font-semibold">{account.name}</span>
          {account.email && account.email !== account.name ? (
            <span className="truncate text-sm text-fg-subtle">{account.email}</span>
          ) : null}
        </div>
      </div>
      <Row
        title="Método de acceso"
        description="Sin contraseñas: entras con un código o con GitHub."
      >
        <span className="text-sm text-fg-muted">
          {PROVIDER_LABEL[account.provider] ?? account.provider}
        </span>
      </Row>
      <Row
        title="Sesión"
        description="Se cierra solo en este dispositivo. Tus datos siguen en tu cuenta."
      >
        <Button onClick={end} disabled={busy}>
          {busy ? 'Cerrando…' : 'Cerrar sesión'}
        </Button>
      </Row>
    </Card>
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
    <Card className="px-[18px] py-1.5">
      <Row
        title="Dónde se guardan"
        description="En tu cuenta de Muninn, en un servidor de la Unión Europea (París). Solo tú puedes verlos."
      >
        <span className="flex items-center gap-1.5 text-sm text-fg-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          Guardado
        </span>
      </Row>
      <Row
        title="Entre dispositivos"
        description="Entra con la misma cuenta y verás lo mismo. Lo que cambies en otro dispositivo aparece al momento, sin recargar."
      >
        <span className="text-sm text-fg-muted">Al momento</span>
      </Row>
      <Row
        title="Sin conexión"
        description="La app guarda en este dispositivo lo último que viste: puedes abrirla y consultarlo sin red. Para cambiar algo necesitas conexión. Al cerrar sesión, se borra."
      >
        <span className="text-sm text-fg-muted">Solo lectura</span>
      </Row>
    </Card>
  )
}

function Apariencia() {
  const auth = useAuth()
  const appearance = useAppearance()
  return (
    <Card className="px-[18px] py-1.5">
      <Row title="Tema" description="El tema claro llegará más adelante.">
        <span className="text-sm text-fg-muted">Oscuro</span>
      </Row>
      <Row
        title="Cristal"
        description="Desenfoque translúcido en paneles y menús de toda la app."
        htmlFor="ajuste-cristal"
      >
        <Switch
          id="ajuste-cristal"
          checked={appearance.glass}
          onCheckedChange={(glass) => changeAppearance({ glass })}
        />
      </Row>
      <Row title="Color de acento" description="Botones, selección y la burbuja del dock.">
        <SwatchPicker
          legend="Color de acento"
          hideLegend
          name="accent"
          value={appearance.accent}
          options={ACCENT_OPTIONS}
          onChange={(accent) => changeAppearance({ accent })}
        />
      </Row>
      <p className="border-t border-border-subtle py-3 text-xs text-fg-faint">
        {auth.kind === 'user'
          ? 'Se guarda en tu cuenta: te sigue a todos tus dispositivos.'
          : 'Se guarda en este dispositivo. Cuando inicies sesión, te seguirá a todos.'}
      </p>
    </Card>
  )
}

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: [PALETTE_SHORTCUT], action: 'Abrir o cerrar el buscador' },
  { keys: ['↑', '↓'], action: 'Moverse por los resultados del buscador' },
  { keys: ['↵'], action: 'Abrir el resultado elegido' },
  { keys: ['Esc'], action: 'Cerrar el buscador, un diálogo o un menú' },
  { keys: ['Tab'], action: 'Pasar al siguiente control' },
]

function Atajos() {
  return (
    <Card className="px-[18px] py-1.5">
      <dl>
        {SHORTCUTS.map((s) => (
          <div
            key={s.action}
            className="flex items-center gap-3 border-t border-border-subtle py-3 first:border-t-0"
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
    </Card>
  )
}

export function Seccion() {
  const { seccion } = route.useParams()
  const section = settingsSection(seccion)
  if (!section) return null
  return (
    <>
      <PageHeader title={section.label} />
      {section.id === 'cuenta' ? (
        <Cuenta />
      ) : section.id === 'datos' ? (
        <Datos />
      ) : section.id === 'modulos' ? (
        <Modulos />
      ) : section.id === 'apariencia' ? (
        <Apariencia />
      ) : section.id === 'atajos' ? (
        <Atajos />
      ) : section.id === 'integraciones' ? (
        <Integraciones />
      ) : section.soon ? (
        <EmptyState icon={section.icon} title={section.label} soon={section.soon.phase}>
          {section.soon.text}
        </EmptyState>
      ) : null}
    </>
  )
}
