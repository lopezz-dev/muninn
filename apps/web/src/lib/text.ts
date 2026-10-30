/** Minúsculas y sin tildes: «documentacion» encuentra «Documentación». Conserva la longitud. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Mismo `owner/repo`: GitHub no distingue mayúsculas en los nombres. */
export const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
