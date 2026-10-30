import {
  Button,
  cn,
  Dialog,
  DialogContent,
  Icon,
  IconButton,
  icons,
  SheetContent,
} from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { archivedTasksQuery } from '../../lib/queries'
import { deleteArchivedTasksWithUndo, restoreArchivedTask } from '../../lib/task-actions'
import { useIsDesktop } from '../../lib/use-media'

/** «hace 3 días», o «el 12 oct» cuando ya es una fecha. */
const when = (iso: string) => {
  const ago = timeAgo(iso)
  return /^\d/.test(ago) ? `el ${ago}` : ago
}

const DESCRIPTION = 'Recupera una para devolverla a su columna, o elimínala para siempre.'

/** Un clic en un aviso (su «Deshacer») no es un clic fuera: no cierra el diálogo. */
const keepOnToast = (e: Event) => {
  if ((e.target as Element | null)?.closest?.('[data-sonner-toaster]')) e.preventDefault()
}

interface ArchivedTasksProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * «Tareas archivadas» de un proyecto (ADR-0067): recuperarlas o eliminarlas para siempre, como Proyectos › Archivados.
 * Se monta con el tablero y no con el diálogo: así las que se están eliminando siguen ocultas aunque se cierre y se
 * vuelva a abrir antes de que acabe el aviso.
 */
export function ArchivedTasks({ projectId, open, onOpenChange }: ArchivedTasksProps) {
  const m = useMuninn()
  const qc = useQueryClient()
  const desktop = useIsDesktop()
  // Las que se están eliminando: desaparecen ya y vuelven con «Deshacer».
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const view = {
    hide: (ids: string[]) => setHidden((h) => new Set([...h, ...ids])),
    show: (ids: string[]) => setHidden((h) => new Set([...h].filter((id) => !ids.includes(id)))),
  }
  const query = useQuery({ ...archivedTasksQuery(m, projectId), enabled: open })
  const tasks = (query.data ?? []).filter((t) => !hidden.has(t.id))

  const removeAll =
    tasks.length > 1 ? (
      <Button
        variant="ghost"
        className="max-md:h-11"
        onClick={() => deleteArchivedTasksWithUndo(m, qc, projectId, tasks, view)}
      >
        <Icon name="trash" />
        Eliminar todas
      </Button>
    ) : null
  const list = (
    <>
      {query.isPending ? (
        <p className="py-6 text-center text-sm text-fg-muted">Cargando…</p>
      ) : query.isError ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          No se pudieron cargar. Comprueba tu conexión e inténtalo de nuevo.
        </p>
      ) : tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
          No hay tareas archivadas en este proyecto.
        </p>
      ) : (
        // A sangre: el relleno del diálogo es de 5 y el de la hoja, de 6.
        <ul className={cn('border-y border-border-subtle', desktop ? '-mx-5' : '-mx-6')}>
          {tasks.map((t) => (
            <li
              key={t.id}
              className={cn(
                'flex min-h-14 items-center gap-3 border-t border-border-subtle first:border-t-0 md:min-h-12',
                desktop ? 'px-5' : 'px-6',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm">
                  {t.source === 'github' ? (
                    <icons.github size={12} aria-label="De GitHub" className="shrink-0" />
                  ) : null}
                  <span className="truncate">{t.title}</span>
                </span>
                <span className="truncate text-xs text-fg-subtle">
                  {t.column.name} · archivada {when(t.archivedAt ?? t.updatedAt)}
                </span>
              </span>
              <Button
                size="sm"
                className="max-md:h-10"
                onClick={() => restoreArchivedTask(m, qc, t)}
              >
                Recuperar
              </Button>
              <IconButton
                size="sm"
                variant="danger"
                aria-label={`Eliminar «${t.title}»`}
                title="Eliminar para siempre"
                className="max-md:size-10"
                icon={<Icon name="trash" />}
                onClick={() => deleteArchivedTasksWithUndo(m, qc, projectId, [t], view)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )

  // Diálogo en el ordenador, hoja desde abajo en el teléfono (como `ProjectDialog`).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {desktop ? (
        <DialogContent
          title="Tareas archivadas"
          description={DESCRIPTION}
          footer={removeAll}
          onInteractOutside={keepOnToast}
        >
          {list}
        </DialogContent>
      ) : (
        <SheetContent
          side="bottom"
          title="Tareas archivadas"
          footer={removeAll ? <div className="ml-auto">{removeAll}</div> : undefined}
          onInteractOutside={keepOnToast}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">{DESCRIPTION}</p>
            {list}
          </div>
        </SheetContent>
      )}
    </Dialog>
  )
}
