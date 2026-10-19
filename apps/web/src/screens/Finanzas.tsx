import { EmptyState, Ghost, Page, PageHeader } from '../components/Page'

export function Finanzas() {
  return (
    <Page>
      <PageHeader
        title="Finanzas"
        description="Gastos, ingresos, ahorro, inversión y suscripciones."
      />
      <EmptyState
        icon="finance"
        title="Tu dinero, de un vistazo"
        soon="Fase 3"
        preview={
          <div className="flex flex-col gap-4 pb-6">
            <div className="grid grid-cols-3 gap-3">
              <Ghost className="h-14" />
              <Ghost className="h-14" />
              <Ghost className="h-14" />
            </div>
            <div className="flex h-20 items-end gap-2">
              {[40, 65, 30, 80, 55, 70, 45, 90, 60, 35, 75, 50].map((h, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: barras decorativas fijas.
                  key={i}
                  className="flex-1 rounded-xs bg-border"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        }
      >
        Apunta movimientos en céntimos exactos, separa por categorías y recibe un aviso antes de
        cada cobro de tus suscripciones. Llega en la fase 3, junto a la app instalable en el iPhone.
      </EmptyState>
    </Page>
  )
}
