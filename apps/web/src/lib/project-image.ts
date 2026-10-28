/**
 * Imagen de proyecto (ADR-0055): se reduce en el navegador antes de subirla, como las del asistente (ADR-0051). Una
 * foto del móvil (4–8 MB) se queda en una portada de 1200 px de unos 150 KB.
 */

/** Lado mayor tras reducir: la portada de la tarjeta más ancha, con margen para pantallas retina. */
const MAX_SIDE = 1200

/** Archivo de imagen → JPEG reducido. Lanza si no es una imagen que el navegador sepa leer. */
export async function reduceProjectImage(file: File): Promise<Blob> {
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
  // JPEG no tiene transparencia: un logo PNG transparente queda sobre el fondo de las tarjetas, no sobre negro.
  ctx.fillStyle = '#15181C'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
  if (!blob) throw new Error('No se pudo preparar la imagen')
  return blob
}
