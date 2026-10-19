import { ACCENTS, type AccentName, Card, Kbd, Switch } from '@muninn/ui'
import { getRouteApi } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { EmptyState, PageHeader } from '../../components/Page'
import { type Swatch, SwatchPicker } from '../../components/SwatchPicker'
import { ACCENT_LABEL, changeAppearance, useAppearance } from '../../lib/appearance'
import { PALETTE_SHORTCUT } from '../../shell/shell-context'
import { settingsSection } from './sections'

const route = getRouteApi('/ajustes/$seccion')

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

function Apariencia() {
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
        Se guarda en este dispositivo. Cuando inicies sesión, te seguirá a todos.
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
      {section.id === 'apariencia' ? (
        <Apariencia />
      ) : section.id === 'atajos' ? (
        <Atajos />
      ) : section.soon ? (
        <EmptyState icon={section.icon} title={section.label} soon={section.soon.phase}>
          {section.soon.text}
        </EmptyState>
      ) : null}
    </>
  )
}
