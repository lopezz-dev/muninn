import type { ModuleName, Muninn, UserSettings } from '@muninn/core'
import type { IconName } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
import { i18n, t } from '../i18n'
import { notifyUndo } from './feedback'
import { withModule } from './modules'
import { fail, serial } from './mutations'
import { keys } from './queries'

/**
 * Activa o desactiva un módulo (`user_settings.enabled_modules`), con feedback y «Deshacer». El menú,
 * la barra de pestañas y el buscador se actualizan al instante (la caché manda); si falla, vuelve a como estaba.
 */
export async function setModuleEnabled(
  m: Muninn,
  qc: QueryClient,
  id: ModuleName,
  on: boolean,
  toast: { label: string; icon: IconName },
  opts: { undoing?: boolean } = {},
): Promise<boolean> {
  // Se llama también desde fuera de Ajustes (`ModuleOff`): sus textos tienen que estar cargados.
  await i18n.loadNamespaces('settings')
  const prev: UserSettings =
    qc.getQueryData<UserSettings>(keys.settings) ?? (await m.settings.get())
  const next = withModule(prev.enabledModules, id, on)
  qc.setQueryData<UserSettings>(keys.settings, { ...prev, enabledModules: next })
  try {
    const saved = await serial('settings', () => m.settings.update({ enabledModules: next }))
    qc.setQueryData<UserSettings>(keys.settings, (cur) =>
      cur ? { ...cur, enabledModules: saved.enabledModules, updatedAt: saved.updatedAt } : saved,
    )
  } catch (err) {
    qc.setQueryData<UserSettings>(keys.settings, prev)
    fail(t('modules.saveFailed', { ns: 'settings' }), err)
    return false
  }
  if (opts.undoing) return true
  notifyUndo(t(on ? 'modules.on' : 'modules.off', { ns: 'settings', name: toast.label }), {
    icon: toast.icon,
    id: `module-${id}`,
    description: t(on ? 'modules.onHint' : 'modules.offHint', { ns: 'settings' }),
    undo: () => setModuleEnabled(m, qc, id, !on, toast, { undoing: true }),
  })
  return true
}
