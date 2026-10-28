import { Button, cn, icons } from '@muninn/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/Page'
import { docLink, neighbours } from '../lib/docs'
import { usePageMeta } from '../lib/seo'
import { Markdown } from '../markdown/Markdown'
import { outline, slugify } from '../markdown/outline'
import { DOCS } from './docs/content'
import { StatusBadge } from './docs/StatusBadge'

const route = getRouteApi('/_app/documentacion/$pagina')

const linkClass = 'text-accent underline-offset-2 hover:underline'

/** Va a un apartado de la misma guía sin recargar ni tocar el historial de más. */
function jump(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id)
  if (!el) return
  e.preventDefault()
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(history.state, '', `#${id}`)
}

/** Enlaces dentro de una guía: a un apartado (`#id`) o a otra guía (`05-notas.md#archivar`). */
function renderLink(href: string, children: ReactNode): ReactNode | undefined {
  if (href.startsWith('#')) {
    const id = slugify(decodeURIComponent(href.slice(1)))
    return (
      <a href={`#${id}`} onClick={(e) => jump(e, id)} className={linkClass}>
        {children}
      </a>
    )
  }
  const doc = docLink(href)
  if (!doc) return undefined
  return (
    <Link
      to="/documentacion/$pagina"
      params={{ pagina: doc.slug }}
      hash={doc.hash ? slugify(decodeURIComponent(doc.hash)) : undefined}
      className={linkClass}
    >
      {children}
    </Link>
  )
}

/** El título de cada guía ya sale de sus metadatos: se quita el `# Título` con que empiezan. */
const withoutTitle = (body: string) => body.replace(/^\s*#\s+.*\r?\n/, '')

/** Título del apartado que se está leyendo, para resaltarlo en «En esta página». */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | undefined>(ids[0])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ids` cambia con la guía (su clave es su contenido)
  useEffect(() => {
    setActive(ids[0])
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return
    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target.id)
          else seen.delete(e.target.id)
        }
        // El primero (en el orden del documento) de los que se ven.
        const first = ids.find((id) => seen.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    for (const el of els) io.observe(el)
    return () => io.disconnect()
  }, [ids.join('|')])
  return active
}

/** Una guía (Documentacion.dc.html): título, texto, índice de la página y guía anterior y siguiente. */
export function DocPagina() {
  const { pagina } = route.useParams()
  const doc = DOCS.find((d) => d.slug === pagina)
  const body = useMemo(() => (doc ? withoutTitle(doc.body) : ''), [doc])
  const toc = useMemo(() => outline(body), [body])
  const active = useActiveHeading(toc.map((t) => t.id))

  usePageMeta({
    title: doc?.title ?? 'Documentación',
    description: doc?.description || undefined,
  })

  if (!doc) {
    return (
      <EmptyState
        icon="docs"
        title="No encontramos esta guía"
        className="mt-10"
        actions={
          <Button asChild variant="primary">
            <Link to="/documentacion">Ver la documentación</Link>
          </Button>
        }
      >
        Puede que el enlace sea de una versión anterior de la ayuda.
      </EmptyState>
    )
  }

  const { prev, next } = neighbours(DOCS, doc.slug)
  const nav =
    'flex min-w-0 flex-col gap-0.5 rounded-md py-1 text-fg transition-colors hover:text-accent'

  return (
    <div className="flex min-w-0 gap-10 md:px-2">
      <article className="flex min-w-0 max-w-[720px] flex-1 flex-col gap-4">
        <Link
          to="/documentacion"
          className="-mb-1 flex h-9 items-center gap-1.5 text-sm text-fg-subtle md:hidden"
        >
          <icons.chevronLeft size={14} />
          Documentación
        </Link>
        <p className="flex items-center gap-2 text-sm text-fg-subtle">
          Guía · {DOCS.indexOf(doc) + 1} de {DOCS.length}
          <StatusBadge status={doc.status} />
        </p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-fg md:text-[32px]">
          {doc.title}
        </h1>
        {doc.description ? <p className="text-lg text-fg-muted">{doc.description}</p> : null}

        <Markdown source={body} headingIds callouts renderLink={renderLink} className="mt-2" />

        <div className="mt-6 flex justify-between gap-4 border-t border-border-subtle pt-5">
          {prev ? (
            <Link to="/documentacion/$pagina" params={{ pagina: prev.slug }} className={nav}>
              <span className="text-xs text-fg-subtle">Anterior</span>
              <span className="text-base font-medium">← {prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to="/documentacion/$pagina"
              params={{ pagina: next.slug }}
              className={cn(nav, 'text-right')}
            >
              <span className="text-xs text-fg-subtle">Siguiente</span>
              <span className="text-base font-medium">{next.title} →</span>
            </Link>
          ) : null}
        </div>
      </article>

      {toc.length > 1 ? (
        <aside
          aria-label="En esta página"
          className="sticky top-7 hidden max-h-[calc(100dvh-3.5rem)] w-[180px] shrink-0 flex-col gap-1 self-start overflow-y-auto pt-16 xl:flex"
        >
          <span className="mb-1.5 text-xs font-semibold text-fg-subtle">En esta página</span>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(e) => jump(e, t.id)}
              aria-current={active === t.id ? 'location' : undefined}
              className={cn(
                'border-l py-0.5 pl-3 text-sm leading-snug transition-colors',
                t.depth === 3 && 'pl-5',
                active === t.id
                  ? 'border-accent text-fg'
                  : 'border-border text-fg-subtle hover:text-fg',
              )}
            >
              {t.text}
            </a>
          ))}
        </aside>
      ) : null}
    </div>
  )
}
