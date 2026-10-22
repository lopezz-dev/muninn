import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { accountsQuery, categoriesQuery } from '../../lib/finance-queries'
import { useMuninn } from '../../lib/muninn'

/** Cuentas y categorías (con las archivadas) e índices por id: lo que usan todas las vistas de Finanzas. */
export function useFinanceBase() {
  const m = useMuninn()
  const accounts = useQuery(accountsQuery(m))
  const categories = useQuery(categoriesQuery(m))
  const accountById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  )
  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )
  return {
    accounts: accounts.data,
    categories: categories.data,
    accountById,
    categoryById,
    loading: accounts.isPending || categories.isPending,
    error: accounts.error ?? categories.error,
  }
}
