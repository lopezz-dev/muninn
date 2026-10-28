import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

export interface Positioned {
  id: string
  position: string
}

/**
 * Clave de orden para insertar en `index` dentro de `siblings` (ya ordenados y sin el elemento que se mueve).
 * Si dos dispositivos generaron la misma clave a la vez, devuelve `rebalance` con claves nuevas
 * para todos los hermanos; quien llame debe persistirlas.
 */
export function positionAt(
  siblings: Positioned[],
  index?: number,
): { position: string; rebalance?: { id: string; position: string }[] } {
  const i = Math.max(0, Math.min(index ?? siblings.length, siblings.length))
  const before = siblings[i - 1]?.position ?? null
  const after = siblings[i]?.position ?? null

  if (before === null || after === null || before < after) {
    return { position: generateKeyBetween(before, after) }
  }

  // Colisión: reasignamos claves a todos los hermanos dejando hueco en `i`.
  const keys = generateNKeysBetween(null, null, siblings.length + 1)
  const rebalance = siblings.map((s, n) => ({
    id: s.id,
    position: keys[n < i ? n : n + 1] as string,
  }))
  return { position: keys[i] as string, rebalance }
}

/** `n` claves consecutivas detrás del último de `siblings` (ya ordenados): añadir al final nunca rebalancea. */
export const positionsAfter = (siblings: Positioned[], n: number) =>
  generateNKeysBetween(siblings.at(-1)?.position ?? null, null, n)

/** `n` claves consecutivas para una lista nueva. */
export const positionsFor = (n: number) => generateNKeysBetween(null, null, n)
