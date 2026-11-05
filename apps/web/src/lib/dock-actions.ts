import type { Muninn, UserSettings } from '@muninn/core'
import type { QueryClient } from '@tanstack/react-query'
import { t } from '../i18n'
import type { DockTab } from '../shell/nav'
import { fail, notifyUndo } from './feedback'
import { serial } from './mutations'
import { keys } from './queries'

/** Cambios de la barra de abajo (ADR-0072). La lectura, en `dock.ts`. */

const putDock = (qc: QueryClient, dock: DockTab[]) =>
  qc.setQueryData<UserSettings>(keys.settings, (s) =>
    s ? { ...s, preferences: { ...s.preferences, dock } } : s,
  )

/**
 * Guarda la barra (optimista: se ve al momento). La clave `dock` es una lista entera, así que no hace falta releer lo
 * guardado dentro de la cola (gotcha «Ajustes en `preferences`»): cada cambio la escribe completa.
 */
export async function saveDock(m: Muninn, qc: QueryClient, dock: DockTab[]): Promise<void> {
  putDock(qc, dock)
  const saved = await serial('settings', () => m.settings.update({ preferences: { dock } }))
  qc.setQueryData<UserSettings>(keys.settings, (s) =>
    s ? { ...s, preferences: saved.preferences } : saved,
  )
}

/** Cambia la barra con aviso y «Deshacer» (ADR-0019). `title` dice qué cambió («Añadido a la barra: Notas»). */
export async function changeDock(
  m: Muninn,
  qc: QueryClient,
  prev: DockTab[],
  next: DockTab[],
  title: string,
  /** Con sesión se guarda en tu cuenta; en la demo, solo mientras dure. */
  inAccount: boolean,
): Promise<void> {
  try {
    await saveDock(m, qc, next)
  } catch (err) {
    putDock(qc, prev)
    fail(t('dock.saveFailed'), err)
    return
  }
  notifyUndo(title, {
    icon: 'home',
    description: inAccount ? t('dock.savedToAccount') : t('dock.savedInDemo'),
    undo: () => saveDock(m, qc, prev),
    undone: t('dock.restored'),
  })
}
