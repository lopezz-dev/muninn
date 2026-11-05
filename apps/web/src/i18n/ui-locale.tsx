import { type UiLocale, UiLocaleProvider } from '@muninn/ui'
import { type ReactNode, useMemo, useSyncExternalStore } from 'react'
import { i18n, intlLocale, t } from '.'

/** Los textos de `@muninn/ui` en el idioma activo (ADR-0077): el paquete no usa i18next, se los pasa la app. */
export function uiLocale(): UiLocale {
  return {
    locale: intlLocale(),
    labels: {
      today: t('ui.today'),
      clearDate: t('ui.clearDate'),
      thisMonth: t('ui.thisMonth'),
      noDate: t('ui.noDate'),
      prevMonth: t('ui.prevMonth'),
      nextMonth: t('ui.nextMonth'),
      prevYear: t('ui.prevYear'),
      nextYear: t('ui.nextYear'),
      close: t('ui.close'),
      closeNotification: t('ui.closeNotification'),
      monthOfYear: (month, year) => t('ui.monthOfYear', { month, year }),
    },
  }
}

/** Da a `@muninn/ui` su idioma y lo cambia con el de la app. Envuelve también al `<Toaster />`. */
export function AppUiLocale({ children }: { children: ReactNode }) {
  const lng = useSyncExternalStore(
    (cb) => {
      i18n.on('languageChanged', cb)
      return () => i18n.off('languageChanged', cb)
    },
    () => i18n.language,
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: `lng` es la señal de que cambiaron los textos
  const value = useMemo(uiLocale, [lng])
  return <UiLocaleProvider value={value}>{children}</UiLocaleProvider>
}
