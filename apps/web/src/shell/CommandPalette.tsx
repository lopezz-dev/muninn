import { ColorDot, cn, Dialog, DialogContent, Icon, IconButton, icons, Kbd } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react'
import { changeAppearance, useAppearance } from '../lib/appearance'
import { useEnabledModules } from '../lib/modules'
import { useAuth, useMuninn } from '../lib/muninn'
import { projectsQuery } from '../lib/queries'
import { useEndSession } from '../lib/session'
import { SECTIONS, type SectionId, sectionEnabled } from './nav'
import {
  bestMatch,
  filterItems,
  GROUP_LABEL,
  groupItems,
  matchRange,
  type PaletteItem,
} from './palette-items'
import { useShell } from './shell-context'

const NAV_ORDER: SectionId[] = [
  'home',
  'projects',
  'notes',
  'finance',
  'assistant',
  'news',
  'github',
  'docs',
  'settings',
]

const NAV_KEYWORDS: Partial<Record<SectionId, string>> = {
  home: 'hoy resumen dashboard',
  projects: 'kanban tablero tareas',
  finance: 'gastos ingresos dinero cuentas',
  assistant: 'jarvis ia chat claude',
  docs: 'ayuda guia manual',
  settings: 'preferencias configuracion apariencia',
}

function Highlight({ label, query }: { label: string; query: string }) {
  const r = matchRange(label, query)
  if (!r) return <>{label}</>
  return (
    <>
      {label.slice(0, r[0])}
      <mark className="bg-transparent font-semibold text-accent">{label.slice(r[0], r[1])}</mark>
      {label.slice(r[1])}
    </>
  )
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery?: string
}

/** Buscador ⌘K: punto de entrada a todo. Diseño: Buscador.dc.html. */
export function CommandPalette({ open, onOpenChange, initialQuery = '' }: CommandPaletteProps) {
  const m = useMuninn()
  const shell = useShell()
  const navigate = useNavigate()
  const auth = useAuth()
  const endSession = useEndSession()
  const appearance = useAppearance()
  const modules = useEnabledModules()
  const projects = useQuery({ ...projectsQuery(m), enabled: open }).data ?? []
  const [query, setQuery] = useState(initialQuery)
  /** `null`: la mejor coincidencia (bestMatch). Un número: lo que eligió el usuario con flechas o ratón. */
  const [active, setActive] = useState<number | null>(null)
  const listId = useId()

  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      setActive(null)
    }
  }, [open, initialQuery])

  const items = useMemo(() => {
    const q = query.trim()
    const all: PaletteItem[] = []
    if (q) {
      all.push({
        id: 'ask',
        group: 'ask',
        label: `Preguntar a Muninn: «${q}»`,
        icon: 'assistant',
        keywords: q,
        run: () => navigate({ to: '/asistente', search: { q } }),
      })
      if (sectionEnabled('news', modules)) {
        all.push({
          id: 'search-news',
          group: 'ask',
          label: `Buscar en Noticias: «${q}»`,
          icon: 'news',
          keywords: q,
          run: () => navigate({ to: '/noticias', search: { q } }),
        })
      }
    }
    for (const id of NAV_ORDER) {
      if (!sectionEnabled(id, modules)) continue
      const s = SECTIONS[id]
      all.push({
        id: `nav-${id}`,
        group: 'nav',
        label: s.label,
        icon: s.icon,
        keywords: NAV_KEYWORDS[id],
        run: () => navigate({ to: s.to }),
      })
    }
    const tasksOn = sectionEnabled('projects', modules)
    for (const p of tasksOn ? projects : []) {
      all.push({
        id: `project-${p.id}`,
        group: 'projects',
        label: p.name,
        icon: 'projects',
        color: p.color,
        hint: 'Tablero',
        run: () => navigate({ to: '/proyectos/$projectId', params: { projectId: p.id } }),
      })
    }
    if (tasksOn) {
      all.push({
        id: 'new-project',
        group: 'actions',
        label: 'Nuevo proyecto…',
        icon: 'plus',
        keywords: 'crear anadir',
        run: shell.openNewProject,
      })
    }
    all.push(
      {
        id: 'toggle-glass',
        group: 'actions',
        label: appearance.glass ? 'Desactivar el cristal' : 'Activar el cristal',
        icon: 'glass',
        keywords: 'blur desenfoque transparencia apariencia',
        run: () => changeAppearance({ glass: !appearance.glass }),
      },
      {
        id: 'appearance',
        group: 'actions',
        label: 'Cambiar la apariencia…',
        icon: 'palette',
        keywords: 'acento color tema',
        run: () => navigate({ to: '/ajustes/$seccion', params: { seccion: 'apariencia' } }),
      },
      {
        id: 'sign-out',
        group: 'actions',
        label: auth.kind === 'user' ? 'Cerrar sesión' : 'Salir del modo demo',
        icon: 'user',
        keywords: 'salir logout desconectar cuenta',
        run: () => endSession(auth.kind),
      },
    )
    return filterItems(all, q)
  }, [
    query,
    projects,
    modules,
    appearance.glass,
    navigate,
    shell.openNewProject,
    auth.kind,
    endSession,
  ])

  const groups = groupItems(items)
  const optionId = (i: number) => `${listId}-opt-${i}`
  const current = Math.min(active ?? bestMatch(items, query), Math.max(0, items.length - 1))

  useEffect(() => {
    if (open) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' })
  })

  const run = (item: PaletteItem | undefined) => {
    if (!item) return
    onOpenChange(false)
    item.run()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    const n = items.length
    if (!n) return
    if (e.key === 'ArrowDown') setActive((current + 1) % n)
    else if (e.key === 'ArrowUp') setActive((current - 1 + n) % n)
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(n - 1)
    else if (e.key === 'Enter') run(items[current])
    else return
    e.preventDefault()
  }

  let index = -1
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Buscar o preguntar" bare size="lg">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-[18px]">
          <icons.search size={18} aria-hidden="true" className="text-fg-subtle" />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items.length ? optionId(current) : undefined}
            aria-autocomplete="list"
            aria-label="Buscar o preguntar"
            placeholder="Busca o pregunta…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(null)
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-lg text-fg outline-none placeholder:text-fg-faint"
          />
          <Kbd className="hidden md:inline-flex">Esc</Kbd>
          <IconButton
            aria-label="Cerrar"
            icon={<icons.close />}
            onClick={() => onOpenChange(false)}
            size="lg"
            className="-mr-3 md:hidden"
          />
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Resultados"
          className="max-h-[min(470px,60vh)] overflow-y-auto px-2 pt-1.5 pb-2"
        >
          {groups.map(({ group, items: groupItems }) => (
            // biome-ignore lint/a11y/useSemanticElements: dentro de un listbox, ARIA agrupa opciones con role="group" (un fieldset no vale).
            <div key={group} role="group" aria-labelledby={`${listId}-${group}`}>
              <div
                id={`${listId}-${group}`}
                className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold tracking-wider text-fg-faint uppercase"
              >
                {GROUP_LABEL[group]}
              </div>
              {groupItems.map((it) => {
                index += 1
                const i = index
                const selected = i === current
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: el teclado lo gestiona el combobox (aria-activedescendant).
                  <div
                    key={it.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    onClick={() => run(it)}
                    onMouseMove={() => setActive(i)}
                    className={cn(
                      'flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-base md:h-10',
                      selected ? 'bg-fg/[0.07] text-fg' : 'text-fg-muted',
                    )}
                  >
                    {it.group === 'ask' ? (
                      <span className="grid size-[26px] place-items-center rounded-md bg-accent-soft text-accent">
                        <Icon name={it.icon} size={14} />
                      </span>
                    ) : it.color ? (
                      <span className="grid size-4 place-items-center">
                        <ColorDot color={it.color} />
                      </span>
                    ) : (
                      <Icon name={it.icon} className="text-fg-subtle" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {it.group === 'ask' ? it.label : <Highlight label={it.label} query={query} />}
                    </span>
                    {it.hint ? <span className="text-xs text-fg-faint">{it.hint}</span> : null}
                    {selected ? <Kbd className="hidden md:inline-flex">↵</Kbd> : null}
                  </div>
                )
              })}
            </div>
          ))}
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-fg-subtle">Escribe para buscar.</p>
          ) : null}
        </div>

        <div className="hidden h-10 shrink-0 items-center gap-4 border-t border-border px-4 text-xs text-fg-subtle md:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            Moverse
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            Abrir
          </span>
          <span className="ml-auto">Secciones, proyectos y acciones · o pregunta a Muninn</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
