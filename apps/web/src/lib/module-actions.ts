import type { ModuleName, Muninn, UserSettings } from '@muninn/core'
import { type IconName, notify } from '@muninn/ui'
import type { QueryClient } from '@tanstack/react-query'
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
    fail('No se pudo guardar el cambio', err)
    return false
  }
  if (opts.undoing) return true
  notify.success(`${toast.label} ${on ? 'activado' : 'desactivado'}`, {
    icon: toast.icon,
    id: `module-${id}`,
    description: on
      ? 'Vuelve a estar en el menú y en el buscador'
      : 'Sale del menú y del buscador; tus datos siguen guardados',
    action: {
      label: 'Deshacer',
      onClick: async () => {
        if (await setModuleEnabled(m, qc, id, !on, toast, { undoing: true })) {
          notify.info('Cambio deshecho')
        }
      },
    },
  })
  return true
}
