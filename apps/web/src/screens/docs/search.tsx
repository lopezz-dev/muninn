import { cn, icons, Kbd } from '@muninn/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { type DocHit, groupLabel, searchDocs } from '../../lib/docs'
import { typingIn } from '../../lib/keyboard'
import { DOCS } from './content'
import { DocTile } from './look'
import { StatusBadge } from './StatusBadge'

/**
 * Estado del buscador de la ayuda: el texto, los resultados y cuál está elegido. La tecla `/` lleva al
 * campo desde cualquier sitio de la pantalla; dentro, ↑ ↓ eligen, ↵ abre y Esc borra.
 */
export function useDocSearch() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const searching = query.trim().length > 0
  const hits = useMemo(() => (searching ? searchDocs(DOCS, query) : []), [query, searching])

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

  const open = (hit: DocHit) => {
    change('')
    void navigate({
      to: '/documentacion/$pagina',
      params: { pagina: hit.doc.slug },
      hash: hit.section?.id,
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

  return { query, change, searching, hits, active, onKeyDown, inputRef, open }
}

export type DocSearch = ReturnType<typeof useDocSearch>

/** El campo de búsqueda. `size="lg"` en la portada; el pequeño, en el índice de la izquierda. */
export function DocSearchField({
  search,
  size = 'sm',
  className,
}: {
  search: DocSearch
  size?: 'sm' | 'lg'
  className?: string
}) {
  const lg = size === 'lg'
  return (
    <label
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-border bg-surface text-fg-subtle focus-within:border-accent',
        lg ? 'h-11 px-3.5' : 'h-11 px-3.5 md:h-8 md:rounded-md md:bg-transparent md:px-2.5',
        className,
      )}
    >
      <icons.search size={lg ? 17 : 15} aria-hidden="true" />
      <input
        ref={search.inputRef as RefObject<HTMLInputElement>}
        type="search"
        role="combobox"
        aria-expanded={search.searching}
        aria-controls="resultados-ayuda"
        aria-activedescendant={search.searching ? `resultado-ayuda-${search.active}` : undefined}
        aria-label="Buscar en la ayuda"
        placeholder={lg ? 'Busca una guía, un apartado o una palabra' : 'Buscar en la ayuda'}
        value={search.query}
        onChange={(e) => search.change(e.target.value)}
        onKeyDown={search.onKeyDown}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-faint',
          lg ? 'md:text-base' : 'md:text-sm',
        )}
      />
      <Kbd className="hidden md:inline-flex">/</Kbd>
    </label>
  )
}

/** Los resultados: guía, apartado donde aparece y un trozo del texto. */
export function DocResults({ search, dense }: { search: DocSearch; dense?: boolean }) {
  if (search.hits.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-fg-subtle">
        Ninguna guía menciona «{search.query.trim()}».
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs text-fg-subtle" aria-live="polite">
        {search.hits.length === 1 ? '1 guía' : `${search.hits.length} guías`} · ↑ ↓ para elegir, ↵
        para abrir
      </p>
      <ul
        id="resultados-ayuda"
        aria-label="Resultados"
        className="glass flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border"
      >
        {search.hits.map((hit, i) => (
          <li key={hit.doc.slug} id={`resultado-ayuda-${i}`}>
            <Link
              to="/documentacion/$pagina"
              params={{ pagina: hit.doc.slug }}
              hash={hit.section?.id}
              onClick={() => search.change('')}
              className={cn(
                'flex gap-3 px-3.5 py-3 text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                i === search.active && 'bg-fg/[0.07]',
                dense && 'md:px-2.5 md:py-2',
              )}
            >
              <DocTile doc={hit.doc} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-base font-medium">
                  <span className="truncate">{hit.doc.title}</span>
                  {dense ? null : <StatusBadge status={hit.doc.status} />}
                </span>
                {hit.section ? (
                  <span className="flex min-w-0 items-center gap-1 text-sm text-fg-muted">
                    <icons.chevronRight
                      size={12}
                      aria-hidden="true"
                      className="shrink-0 text-fg-faint"
                    />
                    <span className="truncate">{hit.section.title}</span>
                  </span>
                ) : null}
                {hit.snippet ? (
                  <span
                    className={cn(
                      'text-xs leading-snug text-fg-subtle',
                      dense ? 'line-clamp-1' : 'line-clamp-2',
                    )}
                  >
                    {hit.snippet}
                  </span>
                ) : null}
                {dense ? null : (
                  <span className="text-2xs text-fg-faint">{groupLabel(hit.doc.group)}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
