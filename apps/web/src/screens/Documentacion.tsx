import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'

export function Documentacion() {
  return (
    <Page>
      <PageHeader title="Documentación" description="Guías de uso de Muninn." />
      <EmptyState
        icon="docs"
        title="Las guías llegan aquí muy pronto"
        soon="Próximamente"
        preview={
          <div className="grid grid-cols-[160px_1fr] gap-4 pb-6">
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Ghost key={i} className="h-2.5" />
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <Ghost className="h-4 w-1/2" />
              <Ghost className="h-2 w-full" />
              <Ghost className="h-2 w-11/12" />
              <Ghost className="h-2 w-3/4" />
            </div>
          </div>
        }
      >
        Esta sección mostrará las guías de uso con un buscador: instalación, proyectos y tablero,
        tareas, notas, asistentes de IA y privacidad. Mientras, están en la carpeta docs/user del
        repositorio.
      </EmptyState>
    </Page>
  )
}
