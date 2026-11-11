import type { z } from 'zod'
import { ValidationError } from './errors'
import {
  type FxRate,
  type FxRateQuery,
  type FxSeriesQuery,
  fxRateQuery,
  fxSeriesQuery,
  currencyCode as parseableCurrency,
} from './schemas'
import type { FxRateStore, Store } from './store'

/**
 * Divisas (ADR-0085): tipos de referencia del BCE, **unidades de la divisa por 1 EUR** en millonésimas. Todo en enteros:
 * los productos van con `BigInt` y se redondea una sola vez (ADR-0018). Este fichero no importa nada de Node ni de
 * Supabase: lo usa también la Edge Function `fx` (parser del BCE).
 */

/** 1 en millonésimas: el tipo del euro contra sí mismo. */
export const FX_ONE = 1_000_000

/** Primer día que se guarda del histórico del BCE (la primera carga de la función `fx`). */
export const FX_HISTORY_FROM = '2015-01-01'

/** Ficheros de tipos de referencia del euro del BCE (comprobados el 10-11-2026). */
export const ECB_URLS = {
  /** El último día publicado (comillas simples, una línea por divisa). */
  daily: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
  /** Los últimos 90 días (comillas dobles, todo en una línea). */
  last90: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml',
  /** Desde 1999, unos 8 MB (comillas dobles, todo en una línea; incluye divisas que ya no existen). */
  history: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml',
} as const
export type EcbFile = keyof typeof ECB_URLS

/** `round(n / d)`, con el medio lejos de cero (como `Math.round` para positivos, simétrico para negativos). */
export function divRound(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError('División por cero')
  const negative = n < 0n !== d < 0n
  const an = n < 0n ? -n : n
  const ad = d < 0n ? -d : d
  const q = (2n * an + ad) / (2n * ad)
  return negative ? -q : q
}

/** Un `bigint` que cabe en un `number` sin perder precisión, o un error (nunca un valor redondeado sin avisar). */
export function safeNumber(n: bigint): number {
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${n} no cabe en un número exacto`)
  }
  return Number(n)
}

/**
 * Texto decimal (`'1.0876'`, `'177.38'`) → millonésimas, sin pasar por coma flotante. Con más de seis decimales,
 * redondea en el séptimo. Lanza si no es un número positivo bien formado.
 */
export function millionthsFromDecimal(text: string): number {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim())
  if (!m) throw new ValidationError(`«${text}» no es un número decimal`)
  const frac = m[2] ?? ''
  let value = BigInt(m[1] ?? '0') * 1_000_000n + BigInt(frac.slice(0, 6).padEnd(6, '0'))
  if (frac.length > 6 && Number(frac[6]) >= 5) value += 1n
  return safeNumber(value)
}

/**
 * Un importe en centésimas de una divisa a centésimas de otra, con los dos tipos «por 1 EUR» en millonésimas
 * (el del euro es `FX_ONE`). Un solo redondeo, al final: `importe × tipo destino ÷ tipo origen`.
 */
export function convertCents(amount: number, fromRate: number, toRate: number): number {
  if (!Number.isSafeInteger(amount)) throw new ValidationError('El importe tiene que ser un entero')
  if (!(fromRate > 0 && toRate > 0)) throw new ValidationError('Los tipos tienen que ser positivos')
  return safeNumber(divRound(BigInt(amount) * BigInt(toRate), BigInt(fromRate)))
}

/** Centésimas de una divisa → céntimos de euro, con su tipo «por 1 EUR»: se **divide** (la trampa del ADR-0085). */
export const toEuroCents = (amount: number, rate: number) => convertCents(amount, rate, FX_ONE)

// ─── Lector de los ficheros del BCE ─────────────────────────────────────────

const DAY_CUBE = /<Cube\s+time=(['"])(\d{4}-\d{2}-\d{2})\1\s*>([\s\S]*?)<\/Cube>/g
const RATE_CUBE = /<Cube\s+currency=(['"])([A-Z]{3})\1\s+rate=(['"])([^'"]*)\3\s*\/>/g

/**
 * Tipos de un fichero del BCE (`eurofxref-daily`, `-hist-90d` o `-hist`). Sin DOM ni dependencias (corre en Deno).
 * El diario usa comillas simples y los históricos dobles; se aceptan las dos. Una divisa con un tipo que no se lee
 * (o cero) se salta; `since` descarta los días anteriores.
 */
export function parseEcbRates(xml: string, { since }: { since?: string } = {}): FxRate[] {
  const out: FxRate[] = []
  for (const day of xml.matchAll(DAY_CUBE)) {
    const date = day[2] as string
    if (since && date < since) continue
    for (const cube of (day[3] ?? '').matchAll(RATE_CUBE)) {
      const currency = cube[2] as string
      if (currency === 'EUR') continue
      let rate: number
      try {
        rate = millionthsFromDecimal(cube[4] ?? '')
      } catch {
        continue
      }
      if (rate > 0) out.push({ currency, date, rate, source: 'ecb' })
    }
  }
  return out
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * Qué fichero pedir según el último día guardado: nada guardado → el histórico (desde `FX_HISTORY_FROM`); un hueco de
 * más de cuatro días (el cron estuvo parado) → los últimos 90, o el histórico si el hueco es mayor; si no, el diario.
 */
export function planEcbFetch(latestStored: string | null, today: string): EcbFile {
  if (!latestStored) return 'history'
  const gap = daysBetween(latestStored, today)
  if (gap > 85) return 'history'
  if (gap > 4) return 'last90'
  return 'daily'
}

// ─── Tipos para la demo y los tests ─────────────────────────────────────────

/** Los del BCE del 10-11-2026: la base de los tipos de la demo. */
const DEMO_BASE: Record<string, number> = {
  USD: 1.1214,
  JPY: 177.38,
  GBP: 0.83545,
  CHF: 0.9203,
  SEK: 10.991,
  DKK: 7.4754,
  NOK: 10.6155,
  PLN: 4.387,
  CAD: 1.5852,
  AUD: 1.6244,
  CNY: 7.4801,
  HKD: 8.7973,
  INR: 105.3315,
  KRW: 1501.56,
  BRL: 6.2257,
  MXN: 20.8063,
  SGD: 1.4335,
}

/** Divisas con tipo en la demo. Faltan las que el BCE no publica (TWD, por ejemplo), igual que en el servidor. */
export const DEMO_FX_CURRENCIES = Object.keys(DEMO_BASE)

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Días sin tipo del BCE: fines de semana y los festivos fijos de TARGET (la demo no calcula la Semana Santa). */
const isEcbDay = (iso: string) => {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  if (dow === 0 || dow === 6) return false
  const md = iso.slice(5)
  return md !== '01-01' && md !== '05-01' && md !== '12-25' && md !== '12-26'
}

/**
 * El tipo de la demo de un día: la base con dos ondas suaves (±5 % como mucho), redondeado a cuatro decimales. Es
 * determinista: los tests pueden calcularlo con esta misma función.
 */
export function demoFxRate(currency: string, date: string): FxRate | null {
  const base = DEMO_BASE[currency]
  if (base === undefined || date < FX_HISTORY_FROM || !isEcbDay(date)) return null
  const d = daysBetween(FX_HISTORY_FROM, date)
  const phase = DEMO_FX_CURRENCIES.indexOf(currency)
  const factor = 1 + 0.035 * Math.sin(d / 47 + phase) + 0.012 * Math.sin(d / 9 + 2 * phase)
  const rate = Math.round(base * factor * 10_000) * 100
  return { currency, date, rate, source: 'ecb' }
}

/** Tipos de la demo (store de memoria y de fichero): como los del BCE, hasta hoy y sin días festivos. */
export function createDemoFxRates(today: () => string): FxRateStore {
  return {
    async latest(currency, onOrBefore) {
      let date = onOrBefore < today() ? onOrBefore : today()
      for (let i = 0; i < 10 && date >= FX_HISTORY_FROM; i++, date = shiftDay(date, -1)) {
        const r = demoFxRate(currency, date)
        if (r) return r
      }
      return null
    },
    async list({ currency, from, to }) {
      const out: FxRate[] = []
      const end = to < today() ? to : today()
      for (let d = from < FX_HISTORY_FROM ? FX_HISTORY_FROM : from; d <= end; d = shiftDay(d, 1)) {
        const r = demoFxRate(currency, d)
        if (r) out.push(r)
      }
      return out
    },
  }
}

/** Unos tipos fijos (tests): exactamente estos, sin generar nada. */
export function createFixedFxRates(rows: FxRate[]): FxRateStore {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return {
    async latest(currency, onOrBefore) {
      const r = sorted.filter((x) => x.currency === currency && x.date <= onOrBefore).at(-1)
      return r ? { ...r } : null
    },
    async list({ currency, from, to }) {
      return sorted
        .filter((x) => x.currency === currency && x.date >= from && x.date <= to)
        .map((x) => ({ ...x }))
    },
  }
}

// ─── `m.fx` ─────────────────────────────────────────────────────────────────

export interface FxContext {
  store: Store
  today: () => string
  parse: <S extends z.ZodType>(schema: S, value: unknown) => z.output<S>
}

/** Un importe convertido y la fecha del tipo más antiguo que se usó (`null` si no hizo falta ninguno). */
export interface FxConversion {
  amount: number
  rateDate: string | null
}

/** `m.fx`: solo lectura. Los tipos los escribe la Edge Function `fx` (ADR-0085). */
export function createFx({ store, today, parse }: FxContext) {
  const euro = (date: string): FxRate => ({ currency: 'EUR', date, rate: FX_ONE, source: 'ecb' })

  /** El tipo de ese día o el último anterior (fines de semana y festivos), con su fecha; `null` si no hay. */
  async function rate(input: FxRateQuery): Promise<FxRate | null> {
    const q = parse(fxRateQuery, input)
    const date = q.date ?? today()
    if (q.currency === 'EUR') return euro(date)
    return store.fxRates.latest(q.currency, date)
  }

  /** Los tipos publicados entre dos fechas incluidas, de la más antigua a la más reciente (el euro no tiene serie). */
  async function series(input: FxSeriesQuery): Promise<FxRate[]> {
    const q = parse(fxSeriesQuery, input)
    if (q.currency === 'EUR') return []
    return store.fxRates.list(q)
  }

  /**
   * `amount` (centésimas de `from`) en centésimas de `to`, con los tipos de `date` (hoy por defecto) o los últimos
   * anteriores. `null` si falta el tipo de alguna de las dos (el BCE no la publica, o aún no hay ninguno).
   */
  async function convert(
    amount: number,
    from: string,
    to: string,
    date?: string,
  ): Promise<FxConversion | null> {
    const src = parse(parseableCurrency, from)
    const dst = parse(parseableCurrency, to)
    if (!Number.isSafeInteger(amount))
      throw new ValidationError('El importe tiene que ser un entero')
    if (src === dst) return { amount, rateDate: null }
    const [a, b] = await Promise.all([rate({ currency: src, date }), rate({ currency: dst, date })])
    if (!a || !b) return null
    const dates = [a, b].filter((r) => r.currency !== 'EUR').map((r) => r.date)
    return {
      amount: convertCents(amount, a.rate, b.rate),
      rateDate: dates.reduce((min, d) => (d < min ? d : min)),
    }
  }

  return { rate, series, convert }
}

export type Fx = ReturnType<typeof createFx>
