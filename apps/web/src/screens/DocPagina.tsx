import { Button, cn, icons } from '@muninn/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/Page'
import { type Doc, docLink, groupLabel, neighbours } from '../lib/docs'
import { usePageMeta } from '../lib/seo'
import { type CalloutLook, Markdown } from '../markdown/Markdown'
import { outline, slugify } from '../markdown/outline'
import { DOCS } from './docs/content'
import { DocIcon, DocTile } from './docs/look'
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

/** Los avisos de las guías: «Estado» con el círculo a medias, «Próximamente» en neutro con reloj. */
function calloutLook(label: string): CalloutLook {
  const l = slugify(label)
  if (l.startsWith('proximamente')) return { icon: <icons.clock size={17} />, tone: 'neutral' }
  if (l.startsWith('estado')) return { icon: <DocIcon name="partial" size={17} /> }
  return { icon: <icons.info size={17} /> }
}

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

/** Guía anterior o siguiente, con su icono y su grupo. */
function Neighbour({ doc, dir }: { doc: Doc; dir: 'prev' | 'next' }) {
  const next = dir === 'next'
  const Arrow = next ? icons.move : icons.chevronLeft
  return (
    <Link
      to="/documentacion/$pagina"
      params={{ pagina: doc.slug }}
      className={cn(
        'glass flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border px-4 py-3.5 text-fg md:py-2.5 outline-none transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent',
        next && 'flex-row-reverse text-right',
      )}
    >
      <Arrow size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
      <DocTile doc={doc} size="sm" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-fg-subtle">
          {next ? 'Siguiente' : 'Anterior'} · {groupLabel(doc.group)}
        </span>
        <span className="truncate text-base font-medium">{doc.title}</span>
      </span>
    </Link>
  )
}

/**
 * Una guía (ADR-0052): cabecera con icono, estado y tiempo de lectura; el texto y, en pantallas anchas,
 * «En esta página» a su lado (desplegable en el móvil); la guía anterior y siguiente al final.
 *
 * En escritorio (ADR-0071) la guía cabe en la ventana: el texto hace scroll en `#guia` y «Anterior / Siguiente»
 * queda fijo debajo. En el móvil hace scroll la página y van al final, como siempre.
 */
export function DocPagina() {
  const { pagina } = route.useParams()
  const doc = DOCS.find((d) => d.slug === pagina)
  const toc = useMemo(() => (doc ? outline(doc.body) : []), [doc])
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
        className="mt-10 flex-1"
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
  const sections = toc.filter((t) => t.depth === 2).length

  return (
    <div className="flex min-w-0 flex-1 gap-8 md:min-h-0">
      <article className="flex min-w-0 max-w-[1000px] flex-1 flex-col md:min-h-0">
        <div
          id="guia"
          data-scroll-restoration-id="guia"
          className="flex min-w-0 flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-3 md:pb-6"
        >
          <Link
            to="/documentacion"
            className="-mb-1 flex h-11 items-center gap-1.5 self-start text-md text-accent md:hidden"
          >
            <icons.chevronLeft size={18} aria-hidden="true" />
            Documentación
          </Link>
          <nav
            aria-label="Estás en"
            className="hidden items-center gap-1.5 text-sm text-fg-subtle md:flex"
          >
            <Link to="/documentacion" className="flex items-center gap-1.5 hover:text-fg">
              <icons.docs size={14} aria-hidden="true" />
              Documentación
            </Link>
            <icons.chevronRight size={12} aria-hidden="true" className="text-fg-faint" />
            <span>{groupLabel(doc.group)}</span>
            <icons.chevronRight size={12} aria-hidden="true" className="text-fg-faint" />
            <span className="text-fg-muted">{doc.title}</span>
          </nav>

          <div className="flex items-center gap-3.5 md:gap-4">
            <DocTile doc={doc} size="lg" />
            <h1 className="min-w-0 text-[28px] leading-tight font-semibold tracking-tight text-fg md:text-[34px]">
              {doc.title}
            </h1>
          </div>
          {doc.description ? <p className="text-lg text-fg-muted">{doc.description}</p> : null}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fg-subtle">
            <StatusBadge status={doc.status} />
            <span className="flex items-center gap-1.5">
              <icons.clock size={14} aria-hidden="true" />
              {doc.minutes} min de lectura
            </span>
            {sections > 1 ? (
              <span className="flex items-center gap-1.5">
                <DocIcon name="list" size={14} />
                {sections} apartados
              </span>
            ) : null}
          </p>

          {toc.length > 1 ? (
            <details className="group glass rounded-lg border border-border xl:hidden">
              <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-3.5 text-md text-fg [&::-webkit-details-marker]:hidden">
                <DocIcon name="list" size={16} className="text-fg-subtle" />
                En esta página
                <span className="text-fg-subtle">· {toc.length} apartados</span>
                <icons.chevronDown
                  size={16}
                  aria-hidden="true"
                  className="ml-auto text-fg-subtle transition-transform group-open:rotate-180"
                />
              </summary>
              <ul className="flex flex-col border-t border-border-subtle py-1.5">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      onClick={(e) => jump(e, t.id)}
                      className={cn(
                        'flex min-h-10 items-center px-3.5 text-base text-fg-muted hover:text-fg',
                        t.depth === 3 && 'pl-7 text-sm',
                      )}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <Markdown
            source={doc.body}
            headingIds
            callouts={calloutLook}
            renderLink={renderLink}
            className="mt-2"
          />
        </div>

        {prev || next ? (
          <nav
            aria-label="Otras guías"
            className="mt-8 flex shrink-0 flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row md:mt-0 md:pt-3"
          >
            {prev ? (
              <Neighbour doc={prev} dir="prev" />
            ) : (
              <span className="hidden flex-1 sm:block" />
            )}
            {next ? (
              <Neighbour doc={next} dir="next" />
            ) : (
              <span className="hidden flex-1 sm:block" />
            )}
          </nav>
        ) : null}
      </article>

      {toc.length > 1 ? (
        <aside
          aria-label="En esta página"
          className="hidden min-h-0 w-[220px] shrink-0 flex-col gap-1 overflow-y-auto pt-1 xl:flex"
        >
          <span className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-fg-subtle uppercase">
            <DocIcon name="list" size={13} />
            En esta página
          </span>
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
