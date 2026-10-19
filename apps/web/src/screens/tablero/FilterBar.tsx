import {
  Button,
  cn,
  Dialog,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  SheetContent,
} from '@muninn/ui'
import { FilterChip } from '../../components/FilterChip'
import { PRIORITIES } from '../../lib/board'
import {
  activeGroups,
  type BoardFilter,
  DUE_OPTIONS,
  NO_FILTER,
  SOURCE_OPTIONS,
  toggle,
} from '../../lib/board-filter'

interface Option<T extends string> {
  value: T
  label: string
}

interface GroupProps {
  filter: BoardFilter
  onChange: (next: BoardFilter) => void
  /** Etiquetas que hay en el tablero. */
  labels: string[]
}

/** Los cuatro grupos de opciones, con la clave del filtro a la que corresponde cada uno. */
function groups({ filter, onChange, labels }: GroupProps) {
  return [
    {
      id: 'priorities',
      label: 'Prioridad',
      options: PRIORITIES as Option<string>[],
      selected: filter.priorities as string[],
      toggle: (v: string) =>
        onChange({ ...filter, priorities: toggle(filter.priorities, v as never) }),
      clear: () => onChange({ ...filter, priorities: [] }),
    },
    {
      id: 'labels',
      label: 'Etiquetas',
      options: labels.map((l) => ({ value: l, label: l })),
      selected: filter.labels,
      toggle: (v: string) => onChange({ ...filter, labels: toggle(filter.labels, v) }),
      clear: () => onChange({ ...filter, labels: [] }),
      empty: 'Aún no hay etiquetas en este tablero.',
    },
    {
      id: 'sources',
      label: 'Origen',
      options: SOURCE_OPTIONS as Option<string>[],
      selected: filter.sources as string[],
      toggle: (v: string) => onChange({ ...filter, sources: toggle(filter.sources, v as never) }),
      clear: () => onChange({ ...filter, sources: [] }),
    },
    {
      id: 'due',
      label: 'Vence',
      options: DUE_OPTIONS as Option<string>[],
      selected: filter.due as string[],
      toggle: (v: string) => onChange({ ...filter, due: toggle(filter.due, v as never) }),
      clear: () => onChange({ ...filter, due: [] }),
    },
  ]
}

/** «Prioridad», «Prioridad · Alta» o «Prioridad · 2», según lo elegido. */
function summary(label: string, options: Option<string>[], selected: string[]) {
  if (selected.length === 0) return label
  if (selected.length === 1) {
    return `${label} · ${options.find((o) => o.value === selected[0])?.label ?? selected[0]}`
  }
  return `${label} · ${selected.length}`
}

function FilterMenu({ g }: { g: ReturnType<typeof groups>[number] }) {
  const on = g.selected.length > 0
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar por ${g.label.toLowerCase()}`}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:outline-2 focus-visible:outline-accent',
            on
              ? 'border-border-strong bg-surface-raised text-fg'
              : 'border-border text-fg-muted hover:text-fg',
          )}
        >
          {summary(g.label, g.options, g.selected)}
          <icons.chevronDown size={12} className="text-fg-subtle" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="max-h-72 min-w-44 overflow-y-auto">
        {g.options.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-fg-subtle">{g.empty}</p>
        ) : (
          g.options.map((o) => (
            <MenuItem
              key={o.value}
              // Se queda abierto: se pueden elegir varias opciones seguidas.
              onSelect={(e) => {
                e.preventDefault()
                g.toggle(o.value)
              }}
            >
              <span className="flex items-center gap-2">
                <span className="grid size-3.5 place-items-center">
                  {g.selected.includes(o.value) ? (
                    <icons.check size={13} className="text-accent" aria-hidden="true" />
                  ) : null}
                </span>
                {o.label}
              </span>
            </MenuItem>
          ))
        )}
        {on ? (
          <>
            <MenuSeparator />
            <MenuItem onSelect={g.clear}>Quitar selección</MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  )
}

function SearchField({
  value,
  onChange,
  touch,
}: {
  value: string
  onChange: (v: string) => void
  touch?: boolean
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 border border-border text-fg-subtle focus-within:border-accent',
        touch ? 'h-11 rounded-lg bg-surface px-3.5' : 'h-7 w-60 rounded-md px-2.5',
      )}
    >
      <icons.search size={touch ? 16 : 14} aria-hidden="true" />
      <input
        type="search"
        aria-label="Filtrar tareas por texto"
        placeholder="Filtrar tareas…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // 16 px en móvil: con menos, iOS hace zoom al enfocar el campo.
        className="min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-faint md:text-[12.5px]"
      />
    </label>
  )
}

interface BarProps extends GroupProps {
  /** Tareas que se ven y total del tablero. */
  shown: number
  total: number
}

/** Barra de filtros del tablero de escritorio (Tablero.dc.html): texto, prioridad, etiquetas, origen y vencimiento. */
export function FilterBar({ filter, onChange, labels, shown, total }: BarProps) {
  const active = activeGroups(filter) > 0
  return (
    <search aria-label="Filtrar el tablero" className="flex flex-wrap items-center gap-2">
      <SearchField value={filter.query} onChange={(query) => onChange({ ...filter, query })} />
      {groups({ filter, onChange, labels }).map((g) => (
        <FilterMenu key={g.id} g={g} />
      ))}
      {active ? (
        <>
          <button
            type="button"
            onClick={() => onChange(NO_FILTER)}
            className="h-7 cursor-pointer rounded-md px-2 text-[12.5px] font-medium text-accent hover:underline"
          >
            Quitar filtros
          </button>
          <span role="status" className="ml-auto text-xs text-fg-subtle tabular">
            {shown} de {total} {total === 1 ? 'tarea' : 'tareas'}
          </span>
        </>
      ) : null}
    </search>
  )
}

/** Resumen y atajo para quitar los filtros (móvil, bajo la cabecera). */
export function FilterSummary({
  filter,
  onClear,
  shown,
  total,
}: {
  filter: BoardFilter
  onClear: () => void
  shown: number
  total: number
}) {
  if (activeGroups(filter) === 0) return null
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-fg-subtle">
      <icons.filter size={13} aria-hidden="true" />
      {shown} de {total} {total === 1 ? 'tarea' : 'tareas'}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto h-9 cursor-pointer px-1 text-sm font-medium text-accent"
      >
        Quitar filtros
      </button>
    </p>
  )
}

/** Hoja de filtros del móvil (M-Tablero): el mismo filtro con chips grandes. */
export function FilterSheet({
  open,
  onOpenChange,
  filter,
  onChange,
  labels,
  shown,
}: GroupProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  shown: number
}) {
  const active = activeGroups(filter) > 0
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        title="Filtrar tareas"
        footer={
          <>
            <Button
              size="lg"
              className="flex-1"
              disabled={!active}
              onClick={() => onChange(NO_FILTER)}
            >
              Quitar filtros
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Ver {shown} {shown === 1 ? 'tarea' : 'tareas'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5 pb-2">
          <SearchField
            touch
            value={filter.query}
            onChange={(query) => onChange({ ...filter, query })}
          />
          {groups({ filter, onChange, labels }).map((g) => (
            <fieldset key={g.id} className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-xs font-semibold tracking-wider text-fg-subtle uppercase">
                {g.label}
              </legend>
              {g.options.length === 0 ? (
                <p className="text-sm text-fg-faint">{g.empty}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <FilterChip
                      key={o.value}
                      touch
                      pressed={g.selected.includes(o.value)}
                      onClick={() => g.toggle(o.value)}
                    >
                      {o.label}
                    </FilterChip>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
        </div>
      </SheetContent>
    </Dialog>
  )
}
