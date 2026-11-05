import type { Muninn } from '@muninn/core'

/**
 * El nombre que le pusiste a este dispositivo en «Sesiones y dispositivos» (ADR-0082). En el servidor va atado a la
 * sesión y se borra con ella; aquí se recuerda por navegador para ponérselo otra vez a la sesión nueva al volver a entrar.
 */
const KEY = 'muninn.deviceName'

export function rememberedDeviceName(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberDeviceName(name: string | null) {
  try {
    if (name) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    // Sin almacenamiento (modo privado): el nombre vale hasta que cierres esta sesión.
  }
}

/**
 * Al arrancar con cuenta: si este navegador recuerda un nombre y la sesión de ahora no tiene, se lo pone. Silencioso:
 * si falla (sin red, falta el segundo factor), se reintenta en el siguiente arranque.
 */
export async function restoreDeviceName(m: Muninn) {
  const name = rememberedDeviceName()
  if (!name || !m.account.available()) return
  try {
    const here = (await m.account.sessions.list()).find((s) => s.current)
    if (here && !here.deviceName) await m.account.sessions.rename(here.id, name)
  } catch {
    // Nada que avisar: no es algo que hayas pedido ahora.
  }
}
