/**
 * Imágenes para el asistente (ADR-0051): se reducen en el navegador antes de guardarlas en el historial del dispositivo
 * y de mandarlas al modelo local. Así una foto del móvil (4–8 MB) se queda en unos cientos de KB y el modelo no tarda.
 */

/** Como mucho, imágenes por mensaje. */
export const MAX_IMAGES = 4
/** Lado mayor tras reducir: lo que aprovechan los modelos de visión habituales. */
const MAX_SIDE = 1568

/** Archivo de imagen → `data:image/jpeg;base64,…` reducido. Lanza si no es una imagen que el navegador sepa leer. */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`«${file.name}» no es una imagen`)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`No puedo abrir «${file.name}»`)
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no deja procesar imágenes')
  // Fondo blanco: un PNG con transparencia pasado a JPEG quedaría negro.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** `data:…;base64,XXXX` → `XXXX`, que es lo que pide Ollama. */
export const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)
