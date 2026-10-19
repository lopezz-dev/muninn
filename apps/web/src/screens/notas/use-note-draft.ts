import type { Note } from '@muninn/core'
import { notify } from '@muninn/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMuninn } from '../../lib/muninn'
import { reason } from '../../lib/mutations'
import { saveNoteText } from '../../lib/note-actions'
import { toggleTask } from '../../markdown/tasks'

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

/** Pausa tras la última pulsación antes de guardar. */
const AUTOSAVE_MS = 700

interface Text {
  title: string
  content: string
}

const same = (a: Text, b: Text) => a.title === b.title && a.content === b.content

/**
 * Texto de una nota en edición, con autoguardado. Lo que se escribe vive aquí (el campo manda) y se
 * guarda 700 ms después de la última pulsación, al salir del campo, al cambiar de nota y al ocultar la
 * pestaña. Si otro dispositivo cambia la nota y aquí no hay nada pendiente, se adopta su versión; si
 * hay cambios sin guardar, se conservan los propios y el siguiente guardado los impone.
 */
export function useNoteDraft(note: Note) {
  const m = useMuninn()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Text>({ title: note.title, content: note.content })
  const [status, setStatus] = useState<SaveStatus>('saved')
  const latest = useRef(draft)
  /** Lo último que el servidor confirmó. */
  const confirmed = useRef<Text>({ title: note.title, content: note.content })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inFlight = useRef(false)
  const id = note.id

  const save = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    if (inFlight.current) return false // al acabar el guardado en curso se vuelve a mirar
    const snap = latest.current
    if (same(snap, confirmed.current)) {
      setStatus((s) => (s === 'dirty' ? 'saved' : s))
      return true
    }
    inFlight.current = true
    setStatus('saving')
    try {
      const saved = await saveNoteText(m, qc, id, snap)
      confirmed.current = { title: saved.title, content: saved.content }
    } catch (err) {
      inFlight.current = false
      setStatus('error')
      notify.error('No se pudo guardar la nota', {
        description: reason(err),
        action: { label: 'Reintentar', onClick: () => void save() },
      })
      return false
    }
    inFlight.current = false
    if (same(latest.current, confirmed.current)) setStatus('saved')
    else {
      // Siguió escribiendo mientras se guardaba.
      setStatus('dirty')
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
    }
    return true
  }, [m, qc, id])

  const change = useCallback(
    (patch: Partial<Text>) => {
      latest.current = { ...latest.current, ...patch }
      setDraft(latest.current)
      setStatus('dirty')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
    },
    [save],
  )

  /** Marca o desmarca una casilla de tarea en el texto (desde la vista previa). */
  const toggle = useCallback(
    (index: number) => {
      const next = toggleTask(latest.current.content, index)
      if (next !== null) change({ content: next })
    },
    [change],
  )

  // Una versión nueva de otro dispositivo (o del propio MCP): se adopta si aquí no hay nada pendiente.
  useEffect(() => {
    const incoming = { title: note.title, content: note.content }
    if (same(incoming, confirmed.current)) return
    if (same(latest.current, confirmed.current) && !inFlight.current) {
      confirmed.current = incoming
      latest.current = incoming
      setDraft(incoming)
    }
  }, [note.title, note.content])

  // Sin pérdidas: al ocultar la pestaña y al salir de la nota se guarda lo pendiente.
  useEffect(() => {
    const flush = () => void save()
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [save])

  return { draft, status, change, toggle, save }
}
