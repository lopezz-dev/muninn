import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { type Locale, type LocalePref, readLocalePref, resolveLocale } from './locale'
import { common as enCommon } from './locales/en/common'
import { common as esCommon } from './locales/es/common'

/**
 * i18next para la interfaz (ADR-0077). `common` (el shell) viaja en el arranque en los dos idiomas; el resto de
 * namespaces, uno por pantalla, se pide al usarlos (`useTranslation('board')`) y entra en el chunk de su idioma.
 * Se inicia de forma síncrona: el primer pintado ya sale en su idioma.
 */
void i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend((lng: string, ns: string) =>
      import(`./locales/${lng}/${ns}.ts`).then((m) => m[ns]),
    ),
  )
  .init({
    lng: resolveLocale(readLocalePref()),
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    ns: ['common'],
    defaultNS: 'common',
    resources: { en: { common: enCommon }, es: { common: esCommon } },
    // `common` ya está; el backend solo pide los demás namespaces.
    partialBundledLanguages: true,
    initAsync: false,
    // React ya escapa lo que pinta.
    interpolation: { escapeValue: false },
    returnNull: false,
  })

const setDocumentLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}
setDocumentLang(i18n.language)
i18n.on('languageChanged', setDocumentLang)

export { i18n }

/** Todos los namespaces (el primero va en el arranque; los demás, en diferido). Uno nuevo se añade aquí y en `i18next.d.ts`. */
export const NAMESPACES = [
  'common',
  'palette',
  'dialogs',
  'settings',
  'security',
  'integrations',
  'board',
  'task',
  'home',
  'projects',
  'notes',
  'docs',
  'finance',
  'assistant',
  'news',
  'github',
  'auth',
] as const

/** Traduce fuera de un componente (avisos, etiquetas de datos). Dentro, mejor `useTranslation()`. */
export const t = i18n.t.bind(i18n)

/** El idioma activo. */
export const currentLocale = () => i18n.language as Locale

/** Aplica una preferencia (`auto` resuelve con el navegador). */
export const applyLocalePref = (pref: LocalePref) => i18n.changeLanguage(resolveLocale(pref))
