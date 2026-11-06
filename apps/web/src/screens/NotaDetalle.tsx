import { Button } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/Page'
import { useMuninn } from '../lib/muninn'
import { restoreNote } from '../lib/note-actions'
import { noteTitle } from '../lib/notes'
import { noteQuery } from '../lib/notes-queries'
import { useIsDesktop } from '../lib/use-media'
import { NoteEditor } from './notas/NoteEditor'

const route = getRouteApi('/_app/notes/$noteId')

/** La nota abierta. Una sola ruta (`/notes/$noteId`) con enlace compartible; `Notas.tsx` decide dónde se pinta. */
export function NotaDetalle() {
  const { t } = useTranslation('notes')
  const { noteId } = route.useParams()
  const m = useMuninn()
  const qc = useQueryClient()
  const desktop = useIsDesktop()
  const note = useQuery(noteQuery(m, qc, noteId))

  useEffect(() => {
    if (note.data) document.title = `${noteTitle(note.data)} · Muninn`
  }, [note.data])

  if (note.isError) {
    return (
      <EmptyState
        icon="notes"
        title={t('detail.notFoundTitle')}
        className="mt-10"
        actions={
          <Button asChild variant="primary">
            <Link to="/notes">{t('detail.seeNotes')}</Link>
          </Button>
        }
      >
        {t('detail.notFoundText')}
      </EmptyState>
    )
  }
  if (!note.data) return null

  if (note.data.archivedAt) {
    return (
      <EmptyState
        icon="archive"
        title={t('detail.archivedTitle')}
        className="mt-10"
        actions={
          <>
            <Button variant="primary" onClick={() => restoreNote(m, qc, noteId)}>
              {t('detail.restore')}
            </Button>
            <Button asChild variant="secondary">
              <Link to="/notes">{t('detail.seeNotes')}</Link>
            </Button>
          </>
        }
      >
        {t('detail.archivedText', { title: noteTitle(note.data) })}
      </EmptyState>
    )
  }

  // Un editor por nota: al cambiar de nota se guarda y se empieza de cero.
  return <NoteEditor key={noteId} note={note.data} desktop={desktop} />
}
