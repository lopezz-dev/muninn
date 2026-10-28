import { cn } from '@muninn/ui'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { typingIn } from '../lib/keyboard'
import { useEnabledModules } from '../lib/modules'
import { useMuninn } from '../lib/muninn'
import { settingsQuery } from '../lib/queries'
import { sectionEnabled, sectionOf } from './nav'
import { Sidebar } from './Sidebar'
import { type NewTaskPreset, type ShellApi, ShellContext } from './shell-context'
import { TabBar } from './TabBar'

// Diferidos: los diálogos, la pantalla de «módulo desactivado» y el aviso de «sin conexión» no viajan con el shell.
// El buscador se pide nada más pintar el shell (fuera del JS del arranque) y casi siempre está listo al abrirlo.
const CommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette })),
)
const ModuleOff = lazy(() => import('./ModuleOff').then((m) => ({ default: m.ModuleOff })))
const OfflineNotice = lazy(() =>
  import('./OfflineNotice').then((m) => ({ default: m.OfflineNotice })),
)
// Solo se descarga si el informe de la mañana está activado (ADR-0043): lleva @muninn/assistant.
const MorningReportRunner = lazy(() =>
  import('./MorningReportRunner').then((m) => ({ default: m.MorningReportRunner })),
)
const NewTaskDialog = lazy(() =>
  import('./NewTaskDialog').then((m) => ({ default: m.NewTaskDialog })),
)
const NewProjectDialog = lazy(() =>
  import('./NewProjectDialog').then((m) => ({ default: m.NewProjectDialog })),
)

/**
 * Estructura común de todas las pantallas (ADR-0054): barra lateral completa en el ordenador (≥ 1024 px), raíl de
 * iconos en tablet (768–1023 px) y barra de pestañas en el teléfono (< 768 px); buscador ⌘K y diálogos globales.
 * Las pantallas se cargan en diferido dentro de `<Outlet />`.
 */
export function AppShell() {
  const [palette, setPalette] = useState<{ open: boolean; query: string }>({
    open: false,
    query: '',
  })
  const [newProject, setNewProject] = useState({ open: false, loaded: false })
  const [newTask, setNewTask] = useState<{ open: boolean; preset: NewTaskPreset; loaded: boolean }>(
    {
      open: false,
      preset: {},
      loaded: false,
    },
  )
  const mainRef = useRef<HTMLElement>(null)
  const modules = useEnabledModules()
  const settings = useQuery(settingsQuery(useMuninn())).data
  const reportOn =
    (settings?.preferences.morningReport as { enabled?: unknown } | undefined)?.enabled === true
  const tasksOn = sectionEnabled('projects', modules)

  const openPalette = useCallback((query = '') => setPalette({ open: true, query }), [])
  const openNewProject = useCallback(() => setNewProject({ open: true, loaded: true }), [])
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

  // El detalle de una tarea y una nota abierta ocupan toda la pantalla en móvil y traen sus propias barras.
  const immersive = useRouterState({
    select: (s) => /^\/(?:proyectos\/[^/]+\/tareas|notas)\/./.test(s.location.pathname),
  })

  return (
    <ShellContext.Provider value={api}>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      {/*
       * Escritorio: la ventana no hace scroll; lo hace <main> (ADR-0050). Así una pantalla puede medir justo el
       * alto de la ventana (`Page fit`) y llevar el scroll dentro de su lista. En el móvil sigue el scroll de la
       * página, que es el que conocen Safari y la barra de pestañas.
       */}
      <div className="flex min-h-dvh md:h-dvh">
        <Sidebar className="hidden md:flex" />
        <main
          id="contenido"
          ref={mainRef}
          tabIndex={-1}
          data-scroll-restoration-id="contenido"
          className={cn(
            // overflow-x-clip: red de seguridad para que nada empuje la pantalla hacia los lados en el teléfono. No
            // crea contenedor de scroll, así que los `sticky` siguen pegándose a la ventana.
            'flex min-w-0 flex-1 flex-col px-5 max-md:overflow-x-clip pt-[calc(env(safe-area-inset-top)+24px)] outline-none md:overflow-y-auto md:px-7 md:pt-7 md:pb-8 lg:px-8',
            immersive
              ? 'pb-[calc(env(safe-area-inset-bottom)+104px)]'
              : 'pb-[calc(env(safe-area-inset-bottom)+112px)]',
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
        {immersive ? null : <TabBar className="md:hidden" />}
      </div>
      <Suspense fallback={null}>
        <CommandPalette
          open={palette.open}
          initialQuery={palette.query}
          onOpenChange={(open) => setPalette((p) => ({ ...p, open }))}
        />
        <OfflineNotice />
      </Suspense>
      {reportOn ? (
        <Suspense fallback={null}>
          <MorningReportRunner />
        </Suspense>
      ) : null}
      {newProject.loaded ? (
        <Suspense fallback={null}>
          <NewProjectDialog
            open={newProject.open}
            onOpenChange={(open) => setNewProject((p) => ({ ...p, open }))}
          />
        </Suspense>
      ) : null}
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
