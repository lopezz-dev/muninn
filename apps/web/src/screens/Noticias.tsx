import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'

export function Noticias() {
  return (
    <Page>
      <PageHeader title="Noticias" description="Tus fuentes, resumidas cada mañana." />
      <EmptyState
        icon="news"
        title="Nada que leer todavía"
        soon="Fase 4"
        preview={
          <div className="flex flex-col gap-3 pb-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Ghost className="size-12 shrink-0" />
                <div className="flex flex-1 flex-col gap-2 pt-1">
                  <Ghost className="h-2.5 w-2/3" />
                  <Ghost className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        Elige tus fuentes RSS y Muninn te preparará un resumen diario, generado en tu ordenador.
      </EmptyState>
    </Page>
  )
}
