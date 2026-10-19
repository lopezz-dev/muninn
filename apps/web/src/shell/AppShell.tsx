import { Outlet, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CommandPalette } from './CommandPalette'
import { Dock } from './Dock'
import { NewProjectDialog } from './NewProjectDialog'
import { sectionOf } from './nav'
import { Sidebar } from './Sidebar'
import { type ShellApi, ShellContext } from './shell-context'

/**
 * Estructura común de todas las pantallas: barra lateral en escritorio, dock en móvil (< 768 px),
 * buscador ⌘K y diálogos globales. Las pantallas se cargan en diferido dentro de `<Outlet />`.
 */
export function AppShell() {
  const [palette, setPalette] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  })
  const [newProject, setNewProject] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const openPalette = useCallback((query = '') => setPalette({ open: true, query }), [])
  const openNewProject = useCallback(() => setNewProject(true), [])
  const api = useMemo<ShellApi>(
    () => ({ openPalette, openNewProject }),
    [openPalette, openNewProject],
  )

  // ⌘K / Ctrl+K abre y cierra el buscador desde cualquier sitio, también dentro de un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => ({ open: !p.open, query: '' }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Al cambiar de sección, el foco va al contenido: quien navega con teclado o lector de
  // pantalla empieza por la pantalla nueva y no por el principio de la barra lateral.
  const section = useRouterState({ select: (s) => sectionOf(s.location.pathname) })
  const prevSection = useRef(section)
  useEffect(() => {
    if (prevSection.current === section) return
    prevSection.current = section
    mainRef.current?.focus({ preventScroll: true })
  }, [section])

  return (
    <ShellContext.Provider value={api}>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh">
        <Sidebar className="hidden md:flex" />
        <main
          id="contenido"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+148px)] outline-none md:px-8 md:pt-7 md:pb-8"
        >
          <Outlet />
        </main>
        <Dock className="md:hidden" />
      </div>
      <CommandPalette
        open={palette.open}
        initialQuery={palette.query}
        onOpenChange={(open) => setPalette((p) => ({ ...p, open }))}
      />
      <NewProjectDialog open={newProject} onOpenChange={setNewProject} />
    </ShellContext.Provider>
  )
}
