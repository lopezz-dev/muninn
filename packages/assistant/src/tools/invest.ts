import { centsFromEuros, FX_ONE, formatEuros } from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool } from './define'
import { isoDate } from './shapes'

/** «1.1214» a partir de millonésimas, sin ceros de sobra (los tipos se leen como los publica el BCE). */
const decimal = (millionths: number) => String(millionths / FX_ONE)

/**
 * Inversiones y divisas (ADR-0085, ADR-0086). De momento, solo el tipo de cambio; las herramientas de la cartera
 * llegan con el core de Inversiones. Importes en la unidad natural en el borde, como en Finanzas.
 */
export const investTools: AnyTool[] = [
  defineTool({
    name: 'fx_rate',
    title: 'Tipo de cambio',
    description:
      'Tipo de cambio de referencia del BCE de una divisa frente al euro: el del día que digas (hoy por defecto) o, si ese día no hay (fin de semana o festivo), el último anterior, con su fecha. Con `amount`, pasa ese importe de la divisa a euros. El BCE no publica todas las divisas (no está, por ejemplo, el dólar de Taiwán).',
    input: {
      currency: z.string().min(3).max(3).describe('Código ISO 4217: USD, GBP, JPY, CHF…'),
      date: isoDate.optional(),
      amount: z
        .union([z.string().min(1), z.number()])
        .optional()
        .describe('Importe en esa divisa, positivo (100, "1.250,50"), para pasarlo a euros'),
    },
    access: 'read',
    module: 'finance',
    detail: (a) => a.currency.toUpperCase(),
    run: async ({ app }, { currency, date, amount }) => {
      const requested = date ?? app.today()
      const rate = await app.fx.rate({ currency, date: requested })
      if (!rate) {
        return {
          currency: currency.toUpperCase(),
          requestedDate: requested,
          available: false,
          note: 'No hay tipo del BCE de esa divisa en esa fecha o antes: o el BCE no la publica, o aún no se ha descargado ninguno.',
        }
      }
      const cents = amount === undefined ? undefined : centsFromEuros(amount)
      const inEuros =
        cents === undefined
          ? undefined
          : await app.fx.convert(cents, rate.currency, 'EUR', rate.date)
      return {
        currency: rate.currency,
        requestedDate: requested,
        date: rate.date,
        unitsPerEuro: decimal(rate.rate),
        eurosPerUnit: (FX_ONE / rate.rate).toFixed(6),
        source: 'BCE (tipo de referencia, hacia las 16:00 de Fráncfort)',
        ...(inEuros ? { amount: (cents ?? 0) / 100, inEuros: formatEuros(inEuros.amount) } : {}),
      }
    },
  }),
]
