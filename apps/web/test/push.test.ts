import { describe, expect, it } from 'vitest'
import { deviceLabel, isIos, pushSupport, vapidKeyBytes } from '../src/lib/push'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const EDGE_WIN = `${CHROME_WIN} Edg/130.0.0.0`
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

const base = {
  userAgent: CHROME_WIN,
  maxTouchPoints: 0,
  standalone: false,
  hasPush: true,
  permission: 'default' as NotificationPermission,
  vapidKey: 'BNc',
  tauri: false,
}

describe('qué admite este navegador (ADR-0040)', () => {
  it('iPhone en Safari sin instalar: hay que añadirlo a la pantalla de inicio', () => {
    expect(pushSupport({ ...base, userAgent: IPHONE, hasPush: false })).toBe('ios-install')
    expect(pushSupport({ ...base, userAgent: IPHONE, standalone: true })).toBe('available')
  })

  it('el iPad se presenta como Mac, pero táctil', () => {
    expect(isIos(IPAD, 5)).toBe(true)
    expect(isIos(IPAD, 0)).toBe(false)
  })

  it('sin Push API, en escritorio (Tauri), sin clave o con permiso denegado', () => {
    expect(pushSupport({ ...base, hasPush: false })).toBe('unsupported')
    expect(pushSupport({ ...base, tauri: true })).toBe('unsupported')
    expect(pushSupport({ ...base, vapidKey: '' })).toBe('unconfigured')
    expect(pushSupport({ ...base, permission: 'denied' })).toBe('denied')
    expect(pushSupport(base)).toBe('available')
  })
})

describe('nombre del dispositivo', () => {
  it('sistema y navegador, o «App» si está instalada', () => {
    expect(deviceLabel(IPHONE)).toBe('iPhone · Safari')
    expect(deviceLabel(IPHONE, 5, true)).toBe('iPhone · App')
    expect(deviceLabel(IPAD, 5)).toBe('iPad · Safari')
    expect(deviceLabel(IPAD)).toBe('Mac · Safari')
    expect(deviceLabel(CHROME_WIN)).toBe('Windows · Chrome')
    expect(deviceLabel(EDGE_WIN)).toBe('Windows · Edge')
    expect(deviceLabel(ANDROID)).toBe('Android · Chrome')
    expect(deviceLabel('')).toBe('Dispositivo · Navegador')
  })
})

describe('clave VAPID', () => {
  it('base64url sin relleno a bytes', () => {
    expect([...vapidKeyBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })
})
