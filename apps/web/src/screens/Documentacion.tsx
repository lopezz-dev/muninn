import { cn, icons } from '@muninn/ui'
import { Link, Outlet, useMatch } from '@tanstack/react-router'
import { Page } from '../components/Page'
import { type Doc, groupDocs } from '../lib/docs'
import { usePageMeta } from '../lib/seo'
import { useIsDesktop } from '../lib/use-media'
import { DOCS } from './docs/content'
import { DocIcon, DocTile, GROUP_ICON } from './docs/look'
import { StatusBadge } from './docs/StatusBadge'
import { DocResults, DocSearchField, useDocSearch } from './docs/search'

const GROUPS = groupDocs(DOCS)

/** Título de grupo: mayúsculas pequeñas con su icono. */
function GroupTitle({ id, label, className }: { id: string; label: string; className?: string }) {
  return (
    <h2
      className={cn(
        'flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-fg-subtle uppercase',
        className,
      )}
    >
      <DocIcon name={GROUP_ICON[id as keyof typeof GROUP_ICON] ?? 'docs'} size={13} />
      {label}
    </h2>
  )
}

/** Tarjeta de una guía en la portada. */
function DocCard({ doc, featured }: { doc: Doc; featured?: boolean }) {
  const soon = doc.status === 'proximamente'
  return (
    <Link
      to="/documentacion/$pagina"
      params={{ pagina: doc.slug }}
      className={cn(
        'flex gap-3 rounded-lg border border-border p-4 text-fg outline-none transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent',
        featured ? 'glass-raised md:p-5' : 'glass',
        soon && 'border-dashed bg-transparent',
      )}
    >
      <DocTile doc={doc} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-md font-medium">
          <span className={cn(soon && 'text-fg-muted')}>{doc.title}</span>
          <StatusBadge status={doc.status} />
        </span>
        {doc.description ? (
          <span className="text-sm leading-snug text-fg-subtle">{doc.description}</span>
        ) : null}
      </span>
    </Link>
  )
}

/** Qué significan «Parcial» y «Próximamente». */
function Leyenda() {
  return (
    <aside className="mt-1 flex flex-col gap-2 rounded-lg bg-surface-sunken px-4 py-3.5 text-sm leading-relaxed text-fg-subtle">
      <span className="flex items-center gap-1.5 font-medium text-fg-muted">
        <icons.info size={14} aria-hidden="true" />
        Qué significan las marcas
      </span>
      <span>
        <StatusBadge status="parcial" /> funciona, pero falta algo que la guía te cuenta.
      </span>
      <span>
        <StatusBadge status="proximamente" /> aún no existe: la guía explica qué llegará.
      </span>
    </aside>
  )
}

/**
 * Portada de la documentación (ADR-0052): buscador grande, «Empieza aquí» con el primer grupo y el resto de
 * guías por grupos. Con texto en el buscador, los resultados ocupan su sitio.
 */
function Portada() {
  const search = useDocSearch()
  usePageMeta({
    title: 'Documentación',
    description: 'Guías de cada parte de Muninn: qué funciona ya y qué falta.',
  })
  const [first, ...rest] = GROUPS

  return (
    <Page className="gap-7 md:gap-8">
      <header className="flex flex-col gap-5 border-b border-border-subtle pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="flex items-start gap-4">
          <Link
            to="/mas"
            aria-label="Volver"
            className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-surface text-fg md:hidden"
          >
            <icons.chevronLeft size={18} />
          </Link>
          <span className="hidden size-13 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent md:grid">
            <icons.docs size={26} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-2xs font-semibold tracking-wider text-fg-subtle uppercase">
              Ayuda · versión {__APP_VERSION__}
            </p>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight md:text-[34px]">
              Documentación
            </h1>
            <p className="max-w-xl text-md text-fg-muted">
              Guías cortas de cada parte de Muninn. Cada una dice qué funciona ya y qué falta.
            </p>
          </div>
        </div>
        <DocSearchField search={search} size="lg" className="w-full lg:w-[440px]" />
      </header>

      {search.searching ? (
        <section aria-label="Resultados de la búsqueda" className="max-w-3xl">
          <DocResults search={search} />
        </section>
      ) : (
        <>
          {first ? (
            <section className="flex flex-col gap-3" aria-label="Empieza aquí">
              <GroupTitle id={first.id} label="Empieza aquí" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {first.docs.map((d) => (
                  <DocCard key={d.slug} doc={d} featured />
                ))}
              </div>
            </section>
          ) : null}
          <div className="grid gap-7 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
            {rest.map((g, i) => (
              <section key={g.id} className="flex flex-col gap-2.5">
                <GroupTitle id={g.id} label={g.label} />
                {g.docs.map((d) => (
                  <DocCard key={d.slug} doc={d} />
                ))}
                {i === rest.length - 1 ? <Leyenda /> : null}
              </section>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}

/** Índice de la izquierda (escritorio, con una guía abierta): buscador y guías por grupos. */
function Indice() {
  const search = useDocSearch()
  return (
    <nav
      aria-label="Páginas de ayuda"
      className="sticky top-7 flex max-h-[calc(100dvh-3.5rem)] w-[248px] shrink-0 flex-col gap-3 self-start overflow-y-auto pb-4"
    >
      <Link
        to="/documentacion"
        className="flex items-center gap-2 px-1 text-xl font-semibold tracking-tight text-fg"
      >
        <icons.docs size={18} aria-hidden="true" className="text-accent" />
        Documentación
      </Link>
      <DocSearchField search={search} />
      {search.searching ? (
        <DocResults search={search} dense />
      ) : (
        GROUPS.map((g) => (
          <div key={g.id} className="flex flex-col gap-0.5">
            <GroupTitle id={g.id} label={g.label} className="px-2.5 pt-2 pb-1" />
            {g.docs.map((d) => (
              <Link
                key={d.slug}
                to="/documentacion/$pagina"
                params={{ pagina: d.slug }}
                className={cn(
                  'group flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  'data-[status=active]:bg-fg/[0.07] data-[status=active]:text-fg',
                )}
              >
                <DocIcon
                  name={d.icon}
                  size={16}
                  className="shrink-0 text-fg-subtle group-data-[status=active]:text-accent"
                />
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <StatusBadge status={d.status} compact />
              </Link>
            ))}
          </div>
        ))
      )}
      <p className="px-2.5 pt-3 text-xs leading-relaxed text-fg-faint">
        Versión {__APP_VERSION__} · generada desde <span className="font-mono">docs/user</span>
      </p>
    </nav>
  )
}

/**
 * Documentación (ADR-0027, ADR-0052): las guías de `docs/user`. Sin guía abierta, la portada. Con una guía,
 * en escritorio, el índice a la izquierda y la guía; en móvil, la guía a pantalla completa.
 */
export function Documentacion() {
  const desktop = useIsDesktop()
  const open = useMatch({ from: '/_app/documentacion/$pagina', shouldThrow: false })?.params.pagina

  if (!open) return <Portada />
  if (!desktop) return <Outlet />
  return (
    <Page className="flex-row gap-10 xl:gap-12">
      <Indice />
      <Outlet />
    </Page>
  )
}
