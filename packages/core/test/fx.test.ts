import { describe, expect, it } from 'vitest'
import {
  convertCents,
  createMemoryStore,
  createMuninn,
  DEMO_FX_CURRENCIES,
  demoFxRate,
  divRound,
  FX_ONE,
  type FxRate,
  millionthsFromDecimal,
  parseEcbRates,
  planEcbFetch,
  toEuroCents,
  ValidationError,
} from '../src'

// Recortes reales de los ficheros del BCE (10-11-2026): el diario con comillas simples y saltos de línea; los
// históricos con comillas dobles y todo en una línea.
const DAILY = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
	<gesmes:subject>Reference rates</gesmes:subject>
	<gesmes:Sender>
		<gesmes:name>European Central Bank</gesmes:name>
	</gesmes:Sender>
	<Cube>
		<Cube time='2026-11-10'>
			<Cube currency='USD' rate='1.1214'/>
			<Cube currency='JPY' rate='177.38'/>
			<Cube currency='GBP' rate='0.83545'/>
			<Cube currency='IDR' rate='20255.34'/>
		</Cube>
	</Cube>
</gesmes:Envelope>`

const HIST = `<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time="2026-11-10"><Cube currency="USD" rate="1.1214"/><Cube currency="PLN" rate="4.387"/></Cube><Cube time="2026-11-09"><Cube currency="USD" rate="1.1187"/><Cube currency="XXX" rate="N/A"/></Cube><Cube time="2014-12-31"><Cube currency="USD" rate="1.2141"/></Cube></Cube></gesmes:Envelope>`

describe('enteros', () => {
  it('divRound redondea al más cercano, con el medio lejos de cero', () => {
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(4n, 3n)).toBe(1n)
    expect(divRound(5n, 3n)).toBe(2n)
    expect(divRound(7n, -2n)).toBe(-4n)
    expect(() => divRound(1n, 0n)).toThrow(RangeError)
  })

  it('millionthsFromDecimal no pasa por coma flotante', () => {
    expect(millionthsFromDecimal('1.0876')).toBe(1_087_600)
    expect(millionthsFromDecimal('177.38')).toBe(177_380_000)
    expect(millionthsFromDecimal('0.83545')).toBe(835_450)
    expect(millionthsFromDecimal('20255.34')).toBe(20_255_340_000)
    expect(millionthsFromDecimal('1')).toBe(FX_ONE)
    // 0.1 + 0.2 en coma flotante no da 0.3; aquí no hay coma flotante.
    expect(millionthsFromDecimal('0.3')).toBe(300_000)
    // Más de seis decimales: redondea en el séptimo.
    expect(millionthsFromDecimal('1.2345675')).toBe(1_234_568)
    expect(millionthsFromDecimal('1.2345674')).toBe(1_234_567)
    expect(() => millionthsFromDecimal('N/A')).toThrow(ValidationError)
    expect(() => millionthsFromDecimal('-1.2')).toThrow(ValidationError)
  })

  it('convertCents divide por el tipo para pasar a euros, con un solo redondeo', () => {
    // 100 USD a 1,1214 USD/EUR = 89,17 €.
    expect(toEuroCents(10_000, 1_121_400)).toBe(8917)
    // 1.000.000 JPY (×100) a 177,38 JPY/EUR = 5.637,61 €.
    expect(toEuroCents(100_000_000, 177_380_000)).toBe(563_761)
    // De euros a dólares se multiplica.
    expect(convertCents(10_000, FX_ONE, 1_121_400)).toBe(11_214)
    // Entre dos divisas que no son el euro: pasa por el euro sin redondear a medias.
    expect(convertCents(10_000, 1_121_400, 835_450)).toBe(7450)
    // Un importe grande no se sale de 2^53 en el producto.
    expect(toEuroCents(9_000_000_000_000, 1_121_400)).toBe(8_025_682_182_986)
    expect(() => convertCents(1.5, FX_ONE, FX_ONE)).toThrow(ValidationError)
    expect(() => convertCents(1, 0, FX_ONE)).toThrow(ValidationError)
  })
})

describe('ficheros del BCE', () => {
  it('lee el diario (comillas simples)', () => {
    expect(parseEcbRates(DAILY)).toEqual([
      { currency: 'USD', date: '2026-11-10', rate: 1_121_400, source: 'ecb' },
      { currency: 'JPY', date: '2026-11-10', rate: 177_380_000, source: 'ecb' },
      { currency: 'GBP', date: '2026-11-10', rate: 835_450, source: 'ecb' },
      { currency: 'IDR', date: '2026-11-10', rate: 20_255_340_000, source: 'ecb' },
    ])
  })

  it('lee el histórico (comillas dobles, una línea), salta lo ilegible y lo anterior a `since`', () => {
    const rates = parseEcbRates(HIST, { since: '2015-01-01' })
    expect(rates.map((r) => `${r.date} ${r.currency} ${r.rate}`)).toEqual([
      '2026-11-10 USD 1121400',
      '2026-11-10 PLN 4387000',
      '2026-11-09 USD 1118700',
    ])
  })

  it('no lee nada de una página que no es del BCE', () => {
    expect(parseEcbRates('<html><body>Mantenimiento</body></html>')).toEqual([])
  })

  it('planEcbFetch: histórico la primera vez, 90 días tras un hueco, y si no el diario', () => {
    expect(planEcbFetch(null, '2026-11-17')).toBe('history')
    expect(planEcbFetch('2026-11-16', '2026-11-17')).toBe('daily')
    // Viernes → martes (fin de semana y un festivo): sigue siendo el diario.
    expect(planEcbFetch('2026-11-13', '2026-11-17')).toBe('daily')
    expect(planEcbFetch('2026-11-02', '2026-11-17')).toBe('last90')
    expect(planEcbFetch('2026-06-01', '2026-11-17')).toBe('history')
  })
})

/** Tipos fijos para los tests del core: USD sube, GBP sale un solo día. */
const RATES: FxRate[] = [
  { currency: 'USD', date: '2026-11-05', rate: 1_150_000, source: 'ecb' },
  { currency: 'USD', date: '2026-11-06', rate: 1_140_000, source: 'ecb' },
  { currency: 'USD', date: '2026-11-09', rate: 1_118_700, source: 'ecb' },
  { currency: 'USD', date: '2026-11-10', rate: 1_121_400, source: 'ecb' },
  { currency: 'GBP', date: '2026-11-10', rate: 835_450, source: 'ecb' },
]

/** `rates: null` = los de la demo. */
const core = (rates: FxRate[] | null = RATES, now = '2026-11-10T18:00:00Z') =>
  createMuninn(createMemoryStore(undefined, { fxRates: rates ?? undefined, now: () => now }), {
    now: () => new Date(now),
    timeZone: 'UTC',
  })

describe('m.fx', () => {
  it('rate: el del día o el último anterior, con su fecha', async () => {
    const m = core()
    expect(await m.fx.rate({ currency: 'USD' })).toEqual(RATES[3])
    // Domingo → el viernes.
    expect(await m.fx.rate({ currency: 'usd', date: '2026-11-08' })).toEqual(RATES[1])
    expect(await m.fx.rate({ currency: 'USD', date: '2026-11-04' })).toBeNull()
    // El BCE no publica el dólar de Taiwán.
    expect(await m.fx.rate({ currency: 'TWD' })).toBeNull()
    expect(await m.fx.rate({ currency: 'EUR', date: '2026-11-08' })).toEqual({
      currency: 'EUR',
      date: '2026-11-08',
      rate: FX_ONE,
      source: 'ecb',
    })
    await expect(m.fx.rate({ currency: 'dólar' })).rejects.toThrow(ValidationError)
  })

  it('series: de la más antigua a la más reciente, solo entre las fechas', async () => {
    const m = core()
    const s = await m.fx.series({ currency: 'USD', from: '2026-11-06', to: '2026-11-09' })
    expect(s.map((r) => r.date)).toEqual(['2026-11-06', '2026-11-09'])
    expect(await m.fx.series({ currency: 'EUR', from: '2026-11-01', to: '2026-11-10' })).toEqual([])
    await expect(
      m.fx.series({ currency: 'USD', from: '2026-11-10', to: '2026-11-01' }),
    ).rejects.toThrow(ValidationError)
  })

  it('convert: con los tipos del día (o los últimos) y la fecha del más antiguo', async () => {
    const m = core()
    expect(await m.fx.convert(10_000, 'USD', 'EUR')).toEqual({
      amount: 8917,
      rateDate: '2026-11-10',
    })
    // Sábado: el tipo del viernes.
    expect(await m.fx.convert(10_000, 'USD', 'EUR', '2026-11-07')).toEqual({
      amount: 8772,
      rateDate: '2026-11-06',
    })
    expect(await m.fx.convert(10_000, 'EUR', 'USD', '2026-11-10')).toEqual({
      amount: 11_214,
      rateDate: '2026-11-10',
    })
    expect(await m.fx.convert(10_000, 'USD', 'GBP')).toEqual({
      amount: 7450,
      rateDate: '2026-11-10',
    })
    expect(await m.fx.convert(123, 'eur', 'EUR')).toEqual({ amount: 123, rateDate: null })
    // Sin tipo de GBP ese día, no se inventa: null.
    expect(await m.fx.convert(10_000, 'GBP', 'EUR', '2026-11-09')).toBeNull()
    expect(await m.fx.convert(10_000, 'TWD', 'EUR')).toBeNull()
    await expect(m.fx.convert(1.5, 'USD', 'EUR')).rejects.toThrow(ValidationError)
  })

  it('la demo trae tipos de días laborables hasta hoy, y nunca del futuro', async () => {
    const m = core(null, '2026-11-10T12:00:00Z')
    const today = await m.fx.rate({ currency: 'USD' })
    expect(today).toEqual(demoFxRate('USD', '2026-11-10'))
    // Un día que aún no ha llegado da el de hoy.
    expect((await m.fx.rate({ currency: 'USD', date: '2026-12-31' }))?.date).toBe('2026-11-10')
    // Domingo → viernes; Navidad (viernes) → el jueves.
    expect((await m.fx.rate({ currency: 'USD', date: '2026-11-08' }))?.date).toBe('2026-11-06')
    expect((await m.fx.rate({ currency: 'USD', date: '2025-12-26' }))?.date).toBe('2025-12-24')
    expect(await m.fx.rate({ currency: 'TWD' })).toBeNull()
    const week = await m.fx.series({ currency: 'USD', from: '2026-11-02', to: '2026-11-15' })
    expect(week.map((r) => r.date)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
    ])
  })

  it('los tipos de la demo se parecen a los del BCE (±5 %) y van en millonésimas de cuatro decimales', () => {
    for (const currency of DEMO_FX_CURRENCIES) {
      const r = demoFxRate(currency, '2026-11-10')
      expect(r).not.toBeNull()
      expect((r?.rate ?? 0) % 100).toBe(0)
    }
    const usd = demoFxRate('USD', '2026-11-10')?.rate ?? 0
    expect(usd).toBeGreaterThan(1_121_400 * 0.95)
    expect(usd).toBeLessThan(1_121_400 * 1.05)
    expect(demoFxRate('USD', '2014-12-31')).toBeNull()
  })
})
