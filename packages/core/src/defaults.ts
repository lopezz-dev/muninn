import type { CategoryKind, ColumnKind, FinanceColor } from './schemas'

/**
 * Lo que Muninn crea por su cuenta (las columnas de un proyecto nuevo, las categorías de Finanzas) sale en el idioma de
 * quien lo crea (ADR-0077). Una vez creado es un dato más: se renombra y no cambia si luego cambia el idioma.
 */
export type DataLocale = 'en' | 'es'

export const DATA_LOCALES: DataLocale[] = ['en', 'es']

export const isDataLocale = (v: unknown): v is DataLocale => v === 'en' || v === 'es'

const COLUMN_NAMES: Record<DataLocale, Record<ColumnKind, string>> = {
  en: {
    backlog: 'Backlog',
    todo: 'To do',
    in_progress: 'In progress',
    review: 'Review',
    done: 'Done',
  },
  es: {
    backlog: 'Backlog',
    todo: 'Pendiente',
    in_progress: 'En curso',
    review: 'Revisión',
    done: 'Hecho',
  },
}

const COLUMN_KINDS: ColumnKind[] = ['backlog', 'todo', 'in_progress', 'review', 'done']

/** Las columnas de un proyecto nuevo, en su orden. */
export const defaultColumns = (locale: DataLocale): { name: string; kind: ColumnKind }[] =>
  COLUMN_KINDS.map((kind) => ({ name: COLUMN_NAMES[locale][kind], kind }))

/** Categorías con las que empieza todo usuario (ADR-0037). La `key` es la misma en los dos idiomas. */
const CATEGORIES: {
  key: string
  name: Record<DataLocale, string>
  kind: CategoryKind
  color: FinanceColor
}[] = [
  { key: 'housing', name: { en: 'Housing', es: 'Vivienda' }, kind: 'expense', color: 'blue' },
  {
    key: 'groceries',
    name: { en: 'Groceries', es: 'Supermercado' },
    kind: 'expense',
    color: 'teal',
  },
  {
    key: 'subscriptions',
    name: { en: 'Subscriptions', es: 'Suscripciones' },
    kind: 'expense',
    color: 'amber',
  },
  {
    key: 'transport',
    name: { en: 'Transport', es: 'Transporte' },
    kind: 'expense',
    color: 'violet',
  },
  {
    key: 'restaurants',
    name: { en: 'Restaurants', es: 'Restaurantes' },
    kind: 'expense',
    color: 'green',
  },
  { key: 'leisure', name: { en: 'Leisure', es: 'Ocio' }, kind: 'expense', color: 'pink' },
  { key: 'health', name: { en: 'Health', es: 'Salud' }, kind: 'expense', color: 'teal' },
  { key: 'other_expense', name: { en: 'Other', es: 'Otros' }, kind: 'expense', color: 'gray' },
  { key: 'salary', name: { en: 'Salary', es: 'Nómina' }, kind: 'income', color: 'green' },
  { key: 'invoices', name: { en: 'Invoices', es: 'Facturas' }, kind: 'income', color: 'blue' },
  {
    key: 'other_income',
    name: { en: 'Other income', es: 'Otros ingresos' },
    kind: 'income',
    color: 'gray',
  },
]

/** Las categorías de serie en un idioma. */
export const defaultCategories = (
  locale: DataLocale,
): { key: string; name: string; kind: CategoryKind; color: FinanceColor }[] =>
  CATEGORIES.map((c) => ({ ...c, name: c.name[locale] }))
