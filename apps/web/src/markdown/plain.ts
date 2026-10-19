/**
 * Un texto en Markdown como texto corrido, para las vistas previas de la lista de notas. No es un
 * intérprete: quita las marcas más comunes y junta los espacios.
 */
export function plainText(markdown: string, max = 160): string {
  const text = markdown
    .replace(/^\s{0,3}(`{3,}|~{3,}).*$/gm, ' ') // líneas de vallas de código
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // imágenes → texto alternativo
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // enlaces → su texto
    .replace(/^\s*>+\s?/gm, '') // citas
    .replace(/^\s*#{1,6}\s+/gm, '') // títulos
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/gm, '') // listas y tareas
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ') // separadores
    .replace(/[*_~`]+/g, '') // énfasis y código en línea
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}
