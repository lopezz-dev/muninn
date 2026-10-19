import { cn } from '@muninn/ui'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEnabledModules } from '../lib/modules'
import { Dock } from './Dock'
import { NewProjectDialog } from './NewProjectDialog'
import { sectionEnabled, sectionOf } from './nav'
import { Sidebar } from './Sidebar'
import { type NewTaskPreset, type ShellApi, ShellContext } from './shell-context'

// Diferidos: los diálogos y la pantalla de «módulo desactivado» no viajan con el shell.
// El buscador se pide nada más pintar el shell (fuera del JS del arranque) y casi siempre está listo al abrirlo.
const CommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
const ModuleOff = lazy(() => import('./ModuleOff').then((m) => ({ default: m.ModuleOff })))
const NewTaskDialog = lazy(() =>
  import('./NewTaskDialog').then((m) => ({ default: m.NewTaskDialog })),
)

/** Dentro de un campo o de un diálogo, las teclas sueltas son para escribir. */
const typingIn = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  Boolean(t.closest('input, textarea, select, [contenteditable="true"], [role=dialog]'))

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
  const [newTask, setNewTask] = useState<{ open: boolean; preset: NewTaskPreset; loaded: boolean }>(
    {
      open: false,
      preset: {},
      loaded: false,
    },
  )
  const mainRef = useRef<HTMLElement>(null)
  const modules = useEnabledModules()
  const tasksOn = sectionEnabled('projects', modules)

  const openPalette = useCallback((query = '') => setPalette({ open: true, query }), [])
  const openNewProject = useCallback(() => setNewProject(true), [])
  const openNewTask = useCallback(
    (preset: NewTaskPreset = {}) => setNewTask({ open: true, preset, loaded: true }),
    [],
  )
  const api = useMemo<ShellApi>(
    () => ({ openPalette, openNewProject, openNewTask }),
    [openPalette, openNewProject, openNewTask],
  )

  // ⌘K / Ctrl+K abre y cierra el buscador desde cualquier sitio, también dentro de un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => ({ open: !p.open, query: '' }))
      } else if (
        e.key.toLowerCase() === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !typingIn(e.target) &&
        tasksOn
      ) {
        // N: tarea nueva, como en el diseño.
        e.preventDefault()
        openNewTask()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openNewTask, tasksOn])

  // Al cambiar de sección, el foco va al contenido: quien navega con teclado o lector de
  // pantalla empieza por la pantalla nueva y no por el principio de la barra lateral.
  const section = useRouterState({ select: (s) => sectionOf(s.location.pathname) })
  const prevSection = useRef(section)
  useEffect(() => {
    if (prevSection.current === section) return
    prevSection.current = section
    mainRef.current?.focus({ preventScroll: true })
  }, [section])

  // Una sección cuyo módulo está desactivado no se pinta: en su lugar, cómo activarlo.
  const off = section && !sectionEnabled(section, modules) ? section : null

  // El detalle de una tarea en móvil ocupa toda la pantalla y trae su propia barra de acciones.
  const immersive = useRouterState({
    select: (s) => /^\/proyectos\/[^/]+\/tareas\//.test(s.location.pathname),
  })

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
          className={cn(
            'min-w-0 flex-1 px-5 pt-[calc(env(safe-area-inset-top)+28px)] outline-none md:px-8 md:pt-7 md:pb-8',
            immersive
              ? 'pb-[calc(env(safe-area-inset-bottom)+104px)]'
              : 'pb-[calc(env(safe-area-inset-bottom)+148px)]',
          )}
        >
          {off ? (
            <Suspense fallback={null}>
              <ModuleOff section={off} />
            </Suspense>
          ) : (
            <Outlet />
          )}
        </main>
        {immersive ? null : <Dock className="md:hidden" />}
      </div>
      <Suspense fallback={null}>
        <CommandPalette
          open={palette.open}
          initialQuery={palette.query}
          onOpenChange={(open) => setPalette((p) => ({ ...p, open }))}
        />
      </Suspense>
      <NewProjectDialog open={newProject} onOpenChange={setNewProject} />
      {newTask.loaded ? (
        <Suspense fallback={null}>
          <NewTaskDialog
            open={newTask.open}
            preset={newTask.preset}
            onOpenChange={(open) => setNewTask((t) => ({ ...t, open }))}
            onNewProject={openNewProject}
          />
        </Suspense>
      ) : null}
    </ShellContext.Provider>
  )
}
