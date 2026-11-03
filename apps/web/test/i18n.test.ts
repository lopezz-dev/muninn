// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { i18n, NAMESPACES, t } from '../src/i18n'
import {
  browserLocale,
  LOCALE_KEY,
  readLocalePref,
  resolveLocale,
  toLocalePref,
  writeLocalePref,
} from '../src/i18n/locale'
import { changedPrefs } from '../src/lib/settings-changes'

/** `{ a: { b: 'x' } }` → `[['a.b', 'x']]`. */
function flat(obj: object, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : flat(v, `${prefix}${k}.`),
  )
}

const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

describe('idioma: preferencia y resolución', () => {
  it('toma el primer idioma del navegador que hablamos; si ninguno, inglés', () => {
    expect(browserLocale(['es-ES', 'en'])).toBe('es')
    expect(browserLocale(['fr-FR', 'en-GB'])).toBe('en')
    expect(browserLocale(['de', 'fr'])).toBe('en')
    expect(browserLocale([])).toBe('en')
  })

  it('«auto» sigue al navegador; un idioma fijo manda', () => {
    expect(resolveLocale('auto', ['es-MX'])).toBe('es')
    expect(resolveLocale('en', ['es-MX'])).toBe('en')
  })

  it('lo guardado que no se entiende cuenta como «auto»', () => {
    expect(toLocalePref('es')).toBe('es')
    expect(toLocalePref('fr')).toBe('auto')
    expect(toLocalePref(null)).toBe('auto')
  })

  it('lee y escribe en el almacenamiento, sin fallar si lanza', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
    writeLocalePref('es', storage)
    expect(data.get(LOCALE_KEY)).toBe('es')
    expect(readLocalePref(storage)).toBe('es')
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(readLocalePref(broken)).toBe('auto')
    expect(() => writeLocalePref('en', broken)).not.toThrow()
  })

  it('un idioma fijo cuenta como «cambiado» para Restablecer', () => {
    const look = { glass: true, accent: 'amber' } as const
    const report = { enabled: false, time: '08:30' }
    expect(changedPrefs(look, report, look, 'auto')).not.toContain('locale')
    expect(changedPrefs(look, report, look, 'en')).toContain('locale')
  })
})

const EN = import.meta.glob('../src/i18n/locales/en/*.ts', { eager: true }) as Record<
  string,
  Record<string, object>
>
const ES = import.meta.glob('../src/i18n/locales/es/*.ts', { eager: true }) as Record<
  string,
  Record<string, object>
>
const nsOf = (file: string) => file.replace(/^.*\/(\w+)\.ts$/, '$1')

describe('diccionarios', () => {
  it('cada namespace existe en los dos idiomas y está en NAMESPACES', () => {
    expect(Object.keys(EN).map(nsOf).sort()).toEqual(Object.keys(ES).map(nsOf).sort())
    expect(Object.keys(EN).map(nsOf).sort()).toEqual([...NAMESPACES].sort())
  })

  for (const [file, mod] of Object.entries(EN)) {
    const ns = nsOf(file)
    const enKeys = flat(mod[ns] ?? {})
    const esMod = ES[file.replace('/en/', '/es/')] ?? {}
    const esMap = new Map(flat(esMod[ns] ?? {}))

    it(`${ns}: el español tiene las mismas claves que el inglés, sin textos vacíos`, () => {
      expect([...esMap.keys()].sort()).toEqual(enKeys.map(([k]) => k).sort())
      for (const [, text] of [...enKeys, ...esMap]) expect(text.trim()).not.toBe('')
    })

    it(`${ns}: cada traducción usa las mismas variables {{…}} que el inglés`, () => {
      for (const [key, text] of enKeys) expect(vars(esMap.get(key) ?? ''), key).toEqual(vars(text))
    })
  }
})

describe('i18next', () => {
  afterEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('traduce el shell en los dos idiomas e interpola', async () => {
    expect(t('nav.settings')).toBe('Ajustes')
    await i18n.changeLanguage('en')
    expect(t('nav.settings')).toBe('Settings')
    expect(t('module.off', { name: 'Notes' })).toBe('Notes is turned off')
    expect(document.documentElement.lang).toBe('en')
  })
})
