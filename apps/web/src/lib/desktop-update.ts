import { notify } from '@muninn/ui'

/** Lo que usamos de `Update` (@tauri-apps/plugin-updater). */
export interface PendingUpdate {
  version: string
  download(): Promise<void>
  install(): Promise<void>
}

export interface UpdaterDeps {
  check(): Promise<PendingUpdate | null>
  relaunch(): Promise<void>
}

const UPDATE_ID = 'desktop-update'

// Los plugins solo existen dentro de Tauri: se cargan aquí y no viajan con el arranque.
const loadDeps = async (): Promise<UpdaterDeps> => {
  const [{ check }, { relaunch }] = await Promise.all([
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/plugin-process'),
  ])
  return { check, relaunch }
}

/**
 * Busca una versión nueva de escritorio en GitHub Releases (ADR-0047). Si la hay, la descarga en segundo plano
 * y avisa con «Reiniciar». La firma la comprueba el plugin. Sin red, o con la release aún sin instaladores, calla:
 * se vuelve a mirar al abrir Muninn.
 */
export async function checkForUpdate(deps?: UpdaterDeps): Promise<void> {
  try {
    const { check, relaunch } = deps ?? (await loadDeps())
    const update = await check()
    if (!update) return
    await update.download()
    notify.info('Hay una versión nueva', {
      id: UPDATE_ID,
      icon: 'download',
      description: `Muninn ${update.version}`,
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Reiniciar', onClick: () => void install(update, relaunch) },
    })
  } catch (err) {
    console.warn('[actualizaciones]', err)
  }
}

async function install(update: PendingUpdate, relaunch: () => Promise<void>) {
  // Otro id: la píldora de «Reiniciar» se cierra justo después del clic.
  const id = `${UPDATE_ID}-install`
  notify.loading('Instalando la versión nueva…', { id })
  try {
    // En Windows el instalador cierra Muninn y lo vuelve a abrir: `relaunch` solo llega en macOS y Linux.
    await update.install()
    await relaunch()
  } catch (err) {
    console.warn('[actualizaciones]', err)
    notify.error('No se ha podido instalar la versión nueva', {
      id,
      description: 'Lo volverá a intentar la próxima vez que abras Muninn.',
    })
  }
}
