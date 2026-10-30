import { notify } from '@muninn/ui'
import { expect, vi } from 'vitest'

/**
 * Ayudas para probar las acciones con «Deshacer». Cada fichero de test mockea `@muninn/ui` (`vi.mock` no se comparte):
 * `notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() }`.
 */

/** Deja correr lo pendiente: la cola `serial`, el almacén en memoria y los `void accion()` de los avisos. */
export async function flush() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

/** Las opciones del último aviso de éxito. */
export const lastSuccess = () => vi.mocked(notify.success).mock.lastCall?.[1]

/** Pulsa «Deshacer» en el último aviso de éxito y espera a que acabe. */
export async function clickUndo() {
  const opts = lastSuccess()
  expect(opts?.action?.label).toBe('Deshacer')
  await opts?.action?.onClick()
  await flush()
}

/** Los títulos de los avisos informativos (el de «deshecho»), sin mirar sus opciones. */
export const infos = () => vi.mocked(notify.info).mock.calls.map((c) => c[0])
