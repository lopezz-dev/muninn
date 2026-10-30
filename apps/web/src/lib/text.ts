/** Minúsculas y sin tildes: «documentacion» encuentra «Documentación». Conserva la longitud. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Las palabras de una búsqueda, ya normalizadas: «  Café   Madrid » → `['cafe', 'madrid']`. */
export const words = (query: string) => normalize(query).split(/\s+/).filter(Boolean)

/**
 * ¿Aparecen todas las palabras en el texto, en cualquier orden? Sin palabras, sí. `terms` viene de `words()`
 * (ya normalizadas); el texto se normaliza aquí.
 */
export const matchesAll = (text: string, terms: string[]) => {
  if (terms.length === 0) return true
  const hay = normalize(text)
  return terms.every((w) => hay.includes(w))
}

/** Mismo `owner/repo`: GitHub no distingue mayúsculas en los nombres. */
export const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
