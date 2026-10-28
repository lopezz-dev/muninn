import type { Muninn } from '@muninn/core'
import { type QueryClient, queryOptions } from '@tanstack/react-query'

/**
 * Consultas de Finanzas. Todas cuelgan de `['finance', …]`: el tiempo real (`sync.ts`) y las acciones
 * refrescan ese prefijo de una vez. Aparte de `queries.ts` para no engordar el arranque.
 */
export const financeKeys = {
  all: ['finance'] as const,
  accounts: ['finance', 'accounts'] as const,
  /** Con las archivadas: para nombrar movimientos antiguos y para Ajustes de categorías. */
  categories: ['finance', 'categories'] as const,
  month: (month: string) => ['finance', 'transactions', month] as const,
  recent: ['finance', 'transactions', 'recent'] as const,
  subscriptions: ['finance', 'subscriptions'] as const,
  /** Panel del mes `AAAA-MM` (lo calcula el core). */
  report: (month: string) => ['finance', 'report', month] as const,
  /** Los cobros que hay que avisar (Inicio y Resumen). */
  upcoming: ['finance', 'upcoming'] as const,
}

/** Suscripciones sin archivar, por próximo cobro (ADR-0038). */
export const subscriptionsQuery = (m: Muninn) =>
  queryOptions({
    queryKey: financeKeys.subscriptions,
    queryFn: () => m.finance.subscriptions.list(),
  })

/** Cobros dentro de sus días de aviso, y los vencidos. */
export const upcomingChargesQuery = (m: Muninn, enabled = true) =>
  queryOptions({
    queryKey: financeKeys.upcoming,
    queryFn: () => m.finance.subscriptions.upcoming(),
    enabled,
  })

/** Cuentas con su saldo (las archivadas incluidas: la pantalla decide qué enseñar). */
export const accountsQuery = (m: Muninn) =>
  queryOptions({
    queryKey: financeKeys.accounts,
    queryFn: () => m.finance.accounts.list({ includeArchived: true }),
  })

export const categoriesQuery = (m: Muninn) =>
  queryOptions({
    queryKey: financeKeys.categories,
    queryFn: () => m.finance.categories.list({ includeArchived: true }),
  })

/** Movimientos de un mes `AAAA-MM`: la lista los filtra en el navegador. */
export const monthTransactionsQuery = (m: Muninn, month: string) =>
  queryOptions({
    queryKey: financeKeys.month(month),
    queryFn: () => m.finance.transactions.list({ month }),
  })

export const recentTransactionsQuery = (m: Muninn) =>
  queryOptions({
    queryKey: financeKeys.recent,
    queryFn: () => m.finance.transactions.list({ limit: 6 }),
  })

export const invalidateFinance = (qc: QueryClient) =>
  qc.invalidateQueries({ queryKey: financeKeys.all })

/** Panel mensual: entradas, salidas, ahorro, por categoría y últimos 6 meses (calculado en el core). */
export const monthReportQuery = (m: Muninn, month: string) =>
  queryOptions({
    queryKey: financeKeys.report(month),
    queryFn: () => m.finance.report.month(month),
  })
