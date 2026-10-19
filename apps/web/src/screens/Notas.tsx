import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'

export function Notas() {
  return (
    <Page>
      <PageHeader title="Notas" description="Markdown, vinculado a tus proyectos y tareas." />
      <EmptyState
        icon="notes"
        title="Tus notas vivirán aquí"
        soon="Próximamente"
        preview={
          <div className="grid grid-cols-[180px_1fr] gap-4 pb-6">
            <div className="flex flex-col gap-2">
              <Ghost className="h-7" />
              <Ghost className="h-7 opacity-60" />
              <Ghost className="h-7 opacity-40" />
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <Ghost className="h-3.5 w-1/3" />
              <Ghost className="h-2 w-full" />
              <Ghost className="h-2 w-5/6" />
              <Ghost className="h-2 w-2/3" />
            </div>
          </div>
        }
      >
        Escribe en Markdown, fija las importantes y vincula cada nota a un proyecto o a una tarea.
        El editor llega junto al tablero, en esta misma fase.
      </EmptyState>
    </Page>
  )
}
