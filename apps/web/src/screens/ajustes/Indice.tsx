import { Card, Chip, Icon, icons } from '@muninn/ui'
import { Link } from '@tanstack/react-router'
import { PageHeader } from '../../components/Page'
import { SETTINGS_SECTIONS } from './sections'

/**
 * Ajustes en el móvil: la lista de secciones, como en los Ajustes del iPhone. Cada fila abre su pantalla y
 * esta vuelve aquí con «‹ Ajustes». En escritorio no se ve: `/ajustes` redirige a una sección y el menú va
 * en la columna de la izquierda.
 */
export function Indice() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <Card className="overflow-hidden">
        <nav aria-label="Secciones de ajustes">
          {SETTINGS_SECTIONS.map((s) => (
            <Link
              key={s.id}
              to="/ajustes/$seccion"
              params={{ seccion: s.id }}
              className="flex min-h-14 items-center gap-3.5 border-t border-border-subtle px-4 text-md text-fg first:border-t-0 hover:bg-surface-hover"
            >
              <Icon name={s.icon} size={20} className="text-fg-subtle" />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.soon ? <Chip>{s.soon.phase}</Chip> : null}
              <icons.chevronRight aria-hidden="true" className="text-fg-faint" />
            </Link>
          ))}
        </nav>
      </Card>
    </>
  )
}
