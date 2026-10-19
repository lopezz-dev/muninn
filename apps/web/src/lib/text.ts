/** Minúsculas y sin tildes: «documentacion» encuentra «Documentación». Conserva la longitud. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
