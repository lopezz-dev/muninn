import { cn, icons, Kbd } from '@muninn/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { typingIn } from '../../lib/keyboard'
import { SETTINGS_INDEX, type SettingEntry, searchSettings } from '../../lib/settings-search'
import { SETTINGS_GROUPS, settingsSection } from './sections'

const sectionLabel = (id: string) => settingsSection(id)?.label ?? ''
const groupLabel = (id: string) => {
  const s = settingsSection(id)
  return SETTINGS_GROUPS.find((g) => g.id === s?.group)?.label
}

/**
 * Estado del buscador de Ajustes. La tecla `/` lleva al campo; dentro, ↑ ↓ eligen, ↵ va al ajuste y Esc borra. Al
 * elegir uno se abre su sección con `#ajuste-<id>`, y la fila se resalta.
 */
export function useSettingsSearch() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const searching = query.trim().length > 0
  // Agrupados por sección (en el orden del primer resultado de cada una), como se pintan: ↑ ↓ siguen ese orden.
  const hits = useMemo(() => {
    const found = searchSettings(SETTINGS_INDEX, query, sectionLabel)
    return [...new Set(found.map((h) => h.section))].flatMap((id) =>
      found.filter((h) => h.section === id),
    )
  }, [query])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const change = (q: string) => {
    setQuery(q)
    setActive(0)
  }

  const open = (hit: SettingEntry) => {
    change('')
    void navigate({
      to: '/ajustes/$seccion',
      params: { seccion: hit.section },
      hash: `ajuste-${hit.id}`,
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && searching) {
      e.preventDefault()
      change('')
    } else if (e.key === 'ArrowDown' && hits.length > 0) {
      e.preventDefault()
      setActive((i) => (i + 1) % hits.length)
    } else if (e.key === 'ArrowUp' && hits.length > 0) {
      e.preventDefault()
      setActive((i) => (i - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      const hit = hits[active]
      if (hit) {
        e.preventDefault()
        open(hit)
      }
    }
  }

  return { query, change, searching, hits, active, onKeyDown, inputRef }
}

export type SettingsSearch = ReturnType<typeof useSettingsSearch>

export function SettingsSearchField({
  search,
  className,
}: {
  search: SettingsSearch
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex h-11 items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 text-fg-subtle focus-within:border-accent md:h-8 md:gap-2 md:rounded-md md:bg-transparent md:px-2.5',
        className,
      )}
    >
      <icons.search size={15} aria-hidden="true" />
      <input
        ref={search.inputRef}
        type="search"
        role="combobox"
        aria-expanded={search.searching}
        aria-controls="resultados-ajustes"
        aria-activedescendant={search.searching ? `resultado-ajuste-${search.active}` : undefined}
        aria-label="Buscar un ajuste"
        placeholder="Buscar un ajuste"
        value={search.query}
        onChange={(e) => search.change(e.target.value)}
        onKeyDown={search.onKeyDown}
        className="min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-faint md:text-sm"
      />
      <Kbd className="hidden md:inline-flex">/</Kbd>
    </label>
  )
}

/**
 * Resultados del buscador, agrupados por sección. Listan y llevan: el ajuste se cambia en su fila, no aquí (así no
 * hay dos copias de cada control que se desfasen).
 */
export function SettingsResults({ search }: { search: SettingsSearch }) {
  const q = search.query.trim()
  const sections = [...new Set(search.hits.map((h) => h.section))]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4 border-b border-border-subtle pb-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-raised text-fg-muted">
          <icons.search size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes con «{q}»</h1>
          <p className="text-base text-fg-subtle" aria-live="polite">
            {search.hits.length === 0
              ? 'Ningún ajuste coincide. Prueba con otra palabra.'
              : `${search.hits.length === 1 ? '1 ajuste' : `${search.hits.length} ajustes`} en ${
                  sections.length === 1 ? '1 sección' : `${sections.length} secciones`
                }. Pulsa uno para ir a él; Esc borra la búsqueda.`}
          </p>
        </div>
      </header>
      <div id="resultados-ajustes" className="flex flex-col gap-5">
        {sections.map((id) => {
          const section = settingsSection(id)
          if (!section) return null
          return (
            <section key={id} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 px-0.5 text-2xs font-semibold tracking-wider text-fg-subtle uppercase">
                <AppIcon name={section.icon} size={13} />
                {groupLabel(id) ? `${groupLabel(id)} › ` : ''}
                {section.label}
              </h2>
              <ul className="glass overflow-hidden rounded-lg border border-border">
                {search.hits.map((hit, i) =>
                  hit.section === id ? (
                    <li
                      key={hit.id}
                      id={`resultado-ajuste-${i}`}
                      className="border-t border-border-subtle first:border-t-0"
                    >
                      <Link
                        to="/ajustes/$seccion"
                        params={{ seccion: hit.section }}
                        hash={`ajuste-${hit.id}`}
                        onClick={() => search.change('')}
                        className={cn(
                          'flex items-center gap-3.5 px-4 py-3 text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:px-[18px]',
                          i === search.active && 'bg-fg/[0.07]',
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-base font-medium">{hit.label}</span>
                          <span className="text-[12.5px] text-fg-subtle">{hit.description}</span>
                        </span>
                        {hit.soon ? (
                          <span className="inline-flex items-center gap-1 rounded-xs border border-dashed border-border-strong px-1.5 py-px text-2xs font-semibold tracking-wide text-fg-muted uppercase">
                            <icons.clock size={10} aria-hidden="true" />
                            Próximamente
                          </span>
                        ) : null}
                        <icons.chevronRight
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 text-fg-faint"
                        />
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
