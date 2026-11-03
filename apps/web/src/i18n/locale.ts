/**
 * Idioma de la interfaz (ADR-0077). Con sesión, la fuente es `user_settings.preferences.locale` (te sigue a todos tus
 * dispositivos) y localStorage es la caché para el primer pintado. Sin elegir (`auto`), el del navegador si lo hablamos;
 * si no, inglés.
 */

export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

/** Lo que elige el usuario: un idioma o seguir al navegador. */
export type LocalePref = Locale | 'auto'

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_KEY = 'muninn.locale'

export const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && (LOCALES as readonly string[]).includes(v)

/** Valida lo guardado (localStorage, la cuenta): lo que no se entienda cuenta como `auto`. */
export const toLocalePref = (v: unknown): LocalePref => (isLocale(v) ? v : 'auto')

/** El primer idioma del navegador que hablamos (`es-ES` → `es`); si ninguno, inglés. */
export function browserLocale(languages: readonly string[] = navigatorLanguages()): Locale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}

/** El idioma que se usa con esa preferencia. */
export const resolveLocale = (pref: LocalePref, languages?: readonly string[]): Locale =>
  pref === 'auto' ? browserLocale(languages) : pref

function navigatorLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

/** Lo mínimo de `Storage` que usamos (inyectable en tests). */
export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>

function safeStorage(): LocaleStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** La preferencia de este dispositivo, sin fallar si no hay almacenamiento (modo privado). */
export function readLocalePref(storage: LocaleStorage | null = safeStorage()): LocalePref {
  try {
    return toLocalePref(storage?.getItem(LOCALE_KEY))
  } catch {
    return 'auto'
  }
}

export function writeLocalePref(pref: LocalePref, storage: LocaleStorage | null = safeStorage()) {
  try {
    storage?.setItem(LOCALE_KEY, pref)
  } catch {
    // Sin almacenamiento la preferencia dura hasta recargar; no es un error para el usuario.
  }
}
