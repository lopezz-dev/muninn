import { createContext, type ReactNode, useContext } from 'react'

/**
 * Idioma de los componentes de `@muninn/ui` (ADR-0077, punto 7 de la tarea de i18n). El paquete no usa i18next: la app
 * le pasa el idioma y sus textos con `<UiLocaleProvider>`. Las fechas salen de `Intl` con `locale`; solo las etiquetas
 * fijas (botones, `aria-label`) van aquí, y sus traducciones viven en los `locales` de la app (namespace `common`, `ui.*`).
 * Sin proveedor (tests, galería), el inglés de respaldo de abajo, como la app por defecto.
 */
export interface UiLabels {
  today: string
  clearDate: string
  thisMonth: string
  noDate: string
  prevMonth: string
  nextMonth: string
  prevYear: string
  nextYear: string
  close: string
  closeNotification: string
  /** «Marzo de 2026» / «March 2026»: la etiqueta de cada mes en el selector de meses. */
  monthOfYear: (month: string, year: number) => string
}

export interface UiLocale {
  /** BCP 47 para `Intl` («en-GB», «es-ES»). */
  locale: string
  labels: UiLabels
}

/** Respaldo sin proveedor. Los textos de verdad los pone la app desde i18next. */
export const UI_LOCALE_EN: UiLocale = {
  locale: 'en-GB',
  labels: {
    today: 'Today',
    clearDate: 'Clear date',
    thisMonth: 'This month',
    noDate: 'No date',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    prevYear: 'Previous year',
    nextYear: 'Next year',
    close: 'Close',
    closeNotification: 'Close notification',
    monthOfYear: (month, year) => `${month} ${year}`,
  },
}

const UiLocaleContext = createContext<UiLocale>(UI_LOCALE_EN)

export function UiLocaleProvider({ value, children }: { value: UiLocale; children: ReactNode }) {
  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
}

export const useUiLocale = () => useContext(UiLocaleContext)
