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
import { useTranslation } from 'react-i18next'
import { t as tr } from '../../i18n'
import { timeAgo } from '../../lib/dates'
import { useMuninn } from '../../lib/muninn'
import { archivedTasksQuery } from '../../lib/queries'
import { deleteArchivedTasksWithUndo, restoreArchivedTask } from '../../lib/task-actions'
import { useIsDesktop } from '../../lib/use-media'

/** «archivada hace 3 días», o «archivada el 12 oct» cuando ya es una fecha (a partir de una semana, como `timeAgo`). */
const archivedWhen = (iso: string) => {
  const ago = timeAgo(iso)
  return Math.abs(Date.now() - new Date(iso).getTime()) >= 7 * 86_400_000
    ? tr('archived.archivedOn', { ns: 'board', date: ago })
    : tr('archived.archivedAgo', { ns: 'board', when: ago })
}

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
  const { t } = useTranslation('board')
  const description = t('archived.description')
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
        {t('archived.deleteAll')}
      </Button>
    ) : null
  const list = (
    <>
      {query.isPending ? (
        <p className="py-6 text-center text-sm text-fg-muted">{t('loading')}</p>
      ) : query.isError ? (
        <p className="py-6 text-center text-sm text-fg-muted">{t('archived.loadFailed')}</p>
      ) : tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
          {t('archived.empty')}
        </p>
      ) : (
        // A sangre: el relleno del diálogo es de 5 y el de la hoja, de 6.
        <ul className={cn('border-y border-border-subtle', desktop ? '-mx-5' : '-mx-6')}>
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                'flex min-h-14 items-center gap-3 border-t border-border-subtle first:border-t-0 md:min-h-12',
                desktop ? 'px-5' : 'px-6',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm">
                  {task.source === 'github' ? (
                    <icons.github size={12} aria-label={t('fromGithub')} className="shrink-0" />
                  ) : null}
                  <span className="truncate">{task.title}</span>
                </span>
                <span className="truncate text-xs text-fg-subtle">
                  {task.column.name} · {archivedWhen(task.archivedAt ?? task.updatedAt)}
                </span>
              </span>
              <Button
                size="sm"
                className="max-md:h-10"
                onClick={() => restoreArchivedTask(m, qc, task)}
              >
                {t('archived.restore')}
              </Button>
              <IconButton
                size="sm"
                variant="danger"
                aria-label={t('archived.deleteOne', { title: task.title })}
                title={t('archived.deleteForever')}
                className="max-md:size-10"
                icon={<Icon name="trash" />}
                onClick={() => deleteArchivedTasksWithUndo(m, qc, projectId, [task], view)}
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
          title={t('header.archivedTasks')}
          description={description}
          footer={removeAll}
          onInteractOutside={keepOnToast}
        >
          {list}
        </DialogContent>
      ) : (
        <SheetContent
          side="bottom"
          title={t('header.archivedTasks')}
          footer={removeAll ? <div className="ml-auto">{removeAll}</div> : undefined}
          onInteractOutside={keepOnToast}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">{description}</p>
            {list}
          </div>
        </SheetContent>
      )}
    </Dialog>
  )
}
