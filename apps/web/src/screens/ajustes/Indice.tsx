import { cn, icons } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { AppIcon } from '../../components/AppIcon'
import { PageHeader } from '../../components/Page'
import { bySection, useChangedPrefs } from '../../lib/settings-changes'
import { useSectionHints } from './Ajustes'
import { SettingsResults, SettingsSearchField, useSettingsSearch } from './search'
import { ABOUT_SECTION, type SettingsSection, sectionsByGroup } from './sections'
import { ChangedDot, MicroTitle } from './ui'

function Row({
  section,
  hint,
  changed,
}: {
  section: SettingsSection
  hint?: string
  changed?: boolean
}) {
  return (
    <Link
      to="/ajustes/$seccion"
      params={{ seccion: section.id }}
      className={cn(
        'flex min-h-[52px] items-center gap-3 border-t border-border-subtle px-3.5 text-md text-fg first:border-t-0 hover:bg-surface-hover',
        section.soon && 'text-fg-muted',
      )}
    >
      <span className={cn('grid size-[30px] shrink-0 place-items-center rounded-md', section.tile)}>
        <AppIcon name={section.icon} size={17} />
      </span>
      <span className="min-w-0 flex-1 truncate">{section.label}</span>
      {hint ? <span className="text-sm text-fg-faint">{hint}</span> : null}
      {changed ? <ChangedDot /> : null}
      <icons.chevronRight aria-hidden="true" className="text-fg-faint" />
    </Link>
  )
}

/**
 * Ajustes en el móvil: buscador y la lista de secciones por grupos, como en los Ajustes del iPhone. Cada fila abre su
 * pantalla y esta vuelve aquí con «‹ Ajustes». En escritorio no se ve: `/ajustes` redirige a una sección y el menú va
 * en la columna de la izquierda.
 */
export function Indice() {
  const search = useSettingsSearch()
  const changed = bySection(useChangedPrefs())
  const hints = useSectionHints()

  return (
    <>
      <PageHeader title="Ajustes" />
      <SettingsSearchField search={search} />
      {search.searching ? (
        <SettingsResults search={search} />
      ) : (
        <nav aria-label="Secciones de ajustes" className="flex flex-col gap-4">
          {sectionsByGroup().map((g) => (
            <section key={g.id} className="flex flex-col gap-2">
              <MicroTitle className="px-1">{g.label}</MicroTitle>
              <div className="glass overflow-hidden rounded-lg border border-border">
                {g.sections.map((s) => (
                  <Row
                    key={s.id}
                    section={s}
                    hint={hints[s.id]}
                    changed={Boolean(changed[s.id]?.length)}
                  />
                ))}
              </div>
            </section>
          ))}
          <div className="glass overflow-hidden rounded-lg border border-border">
            <Row section={ABOUT_SECTION} hint={hints.acerca} />
          </div>
          <p className="flex items-center gap-1.5 px-1 text-xs text-fg-faint">
            <AppIcon name="keyboard" size={14} />
            Los atajos de teclado son para el ordenador.
          </p>
        </nav>
      )}
    </>
  )
}
