/**
 * Rutas antiguas en español → las de ahora, en inglés (ADR-0077, fase 3). Siguen llegando por enlaces compartidos, notas
 * con enlaces dentro, la PWA instalada, avisos push ya enviados y el correo del aviso de dispositivo nuevo. El router las
 * redirige antes de resolver nada; Vercel hace lo mismo con las guías prerenderizadas (`vercel.json`).
 */

const SECTIONS: Record<string, string> = {
  proyectos: 'projects',
  notas: 'notes',
  finanzas: 'finance',
  asistente: 'assistant',
  noticias: 'news',
  // Las guías de antes estaban en español: van a su versión en español (ADR-0077, fase 4).
  documentacion: 'es/docs',
  ajustes: 'settings',
}

/** Secciones de Ajustes: el slug de la ruta se tradujo con ellas. */
export const LEGACY_SETTINGS_SECTIONS: Record<string, string> = {
  cuenta: 'account',
  apariencia: 'appearance',
  barra: 'dock',
  atajos: 'shortcuts',
  modulos: 'modules',
  notificaciones: 'notifications',
  asistente: 'assistant',
  informe: 'report',
  integraciones: 'integrations',
  datos: 'data',
  acerca: 'about',
}

/** `?vista=` de Finanzas → `?view=`. */
const FINANCE_VIEWS: Record<string, string> = {
  resumen: 'overview',
  movimientos: 'transactions',
  suscripciones: 'subscriptions',
  cuentas: 'accounts',
}

/**
 * La ruta nueva de una antigua (con su búsqueda y su ancla), o `null` si no es antigua. `pathname` sin decodificar,
 * `search` con su `?` (o vacío) y `hash` con su `#` (o vacío), como en `location`.
 */
export function legacyHref(pathname: string, search = '', hash = ''): string | null {
  const parts = pathname.split('/')
  // parts[0] es '' (la ruta empieza por '/').
  if (parts[1] === 'dev' && parts[2] === 'fundamentos') {
    parts[2] = 'foundations'
    return parts.join('/') + search + hash
  }
  const section = parts[1] ? SECTIONS[parts[1]] : undefined
  if (!section) return null
  parts[1] = section
  if (section === 'projects' && parts[3] === 'tareas') parts[3] = 'tasks'
  if (section === 'settings' && parts[2]) parts[2] = LEGACY_SETTINGS_SECTIONS[parts[2]] ?? parts[2]
  let query = search
  if (section === 'finance' && search) {
    const params = new URLSearchParams(search)
    const vista = params.get('vista')
    if (vista !== null) {
      params.delete('vista')
      const view = FINANCE_VIEWS[vista]
      if (view) params.set('view', view)
    }
    const rest = params.toString()
    query = rest ? `?${rest}` : ''
  }
  return parts.join('/') + query + hash
}
