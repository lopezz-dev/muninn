import { buildDocs } from '../../lib/docs'

/**
 * Las guías de `docs/user/*.md`, incluidas en el chunk de esta pantalla al compilar (no se piden por red:
 * funcionan sin conexión y siempre coinciden con la versión de la app). `README.md` no entra: solo los
 * ficheros `NN-nombre.md`.
 */
const files = import.meta.glob('../../../../../docs/user/[0-9][0-9]-*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const DOCS = buildDocs(files)
