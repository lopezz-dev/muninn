import { z } from 'zod'

/** Formas zod que repiten varias herramientas: una sola definición, la misma descripción para el modelo. */

export const projectRef = z
  .string()
  .min(1)
  .describe('Id del proyecto o su nombre (no distingue mayúsculas)')

export const isoDate = z.iso.date().describe('Fecha AAAA-MM-DD')

/** Límite opcional de resultados, de 1 a `max`. */
export const limit = (max: number) => z.number().int().min(1).max(max).optional()
