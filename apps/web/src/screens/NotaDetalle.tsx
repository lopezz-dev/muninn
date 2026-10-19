import { Button } from '@muninn/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { EmptyState } from '../components/Page'
import { useMuninn } from '../lib/muninn'
import { restoreNote } from '../lib/note-actions'
import { noteTitle } from '../lib/notes'
import { noteQuery } from '../lib/notes-queries'
import { useIsDesktop } from '../lib/use-media'
import { NoteEditor } from './notas/NoteEditor'

const route = getRouteApi('/_app/notas/$noteId')

/** La nota abierta. Una sola ruta (`/notas/$noteId`) con enlace compartible; `Notas.tsx` decide dónde se pinta. */
export function NotaDetalle() {
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
        title="No encontramos esta nota"
        className="mt-10"
        actions={
          <Button asChild variant="primary">
            <Link to="/notas">Ver notas</Link>
          </Button>
        }
      >
        Puede que sea de otra cuenta o que ya no exista. En modo demo las notas se pierden al
        recargar.
      </EmptyState>
    )
  }
  if (!note.data) return null

  if (note.data.archivedAt) {
    return (
      <EmptyState
        icon="archive"
        title="Esta nota está archivada"
        className="mt-10"
        actions={
          <>
            <Button variant="primary" onClick={() => restoreNote(m, qc, noteId)}>
              Recuperar nota
            </Button>
            <Button asChild variant="secondary">
              <Link to="/notas">Ver notas</Link>
            </Button>
          </>
        }
      >
        «{noteTitle(note.data)}» no aparece en la lista. Recupérala para volver a verla y editarla.
      </EmptyState>
    )
  }

  // Un editor por nota: al cambiar de nota se guarda y se empieza de cero.
  return <NoteEditor key={noteId} note={note.data} desktop={desktop} />
}
