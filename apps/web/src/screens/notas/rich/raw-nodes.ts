import { mergeAttributes, Node } from '@tiptap/core'
import { safeHref } from '../../../markdown/Markdown'

/**
 * Lo que el editor no sabe editar se guarda tal cual (ADR-0078): una imagen o un trozo de HTML viajan en un nodo
 * atómico con su Markdown original y, al guardar, se escriben igual que llegaron. En pantalla se ven como en la vista
 * de siempre (`Markdown.tsx`): la imagen, por su texto alternativo y sin cargarla; el HTML, como texto.
 */

/** Texto que «se lee» en un nodo atómico; lo usa también la proyección de texto de los comentarios (ADR-0079). */
export function leafText(node: { type: { name: string }; attrs: Record<string, unknown> }): string {
  switch (node.type.name) {
    case 'hardBreak':
      return '\n'
    case 'mdImage':
      return String(node.attrs.alt ?? '')
    case 'rawInline':
    case 'rawBlock':
      return String(node.attrs.raw ?? '')
    default:
      return ''
  }
}

/** El Markdown original, fuera del DOM salvo en `data-raw` (para copiar y pegar entre notas). */
const rawAttr = {
  default: '',
  rendered: false,
  parseHTML: (el: HTMLElement) => el.getAttribute('data-raw') ?? '',
}

/** Imagen de Markdown: sin cargarla (sería pedir algo a un servidor ajeno solo por abrir la nota). */
export const MdImage = Node.create({
  name: 'mdImage',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      alt: { default: '', rendered: false, parseHTML: (el) => el.getAttribute('data-alt') ?? '' },
      src: { default: '', rendered: false, parseHTML: (el) => el.getAttribute('data-src') ?? '' },
      raw: rawAttr,
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-md-image]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const href = safeHref(String(node.attrs.src ?? ''))
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-md-image': '',
        'data-alt': node.attrs.alt,
        'data-src': node.attrs.src,
        'data-raw': node.attrs.raw,
        class: 'md-image',
        title: href ?? undefined,
      }),
      String(node.attrs.alt || node.attrs.src || '🖼'),
    ]
  },
  markdownTokenName: 'image',
  parseMarkdown: (token, h) =>
    h.createNode('mdImage', {
      alt: String(token.text ?? ''),
      src: String(token.href ?? ''),
      raw: String(token.raw ?? ''),
    }),
  renderMarkdown: (node) => String(node.attrs?.raw ?? ''),
})

/** HTML en línea (`<b>`, `<kbd>`…): como texto, intacto. */
export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { raw: rawAttr }
  },
  parseHTML() {
    return [{ tag: 'span[data-md-raw]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-md-raw': '',
        'data-raw': node.attrs.raw,
        class: 'md-raw',
      }),
      String(node.attrs.raw ?? ''),
    ]
  },
  // El token lo reparte `RawBlock`; aquí solo se escribe.
  renderMarkdown: (node) => String(node.attrs?.raw ?? ''),
})

/** HTML en bloque y cualquier bloque que el esquema no entienda: como texto, intacto. */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { raw: rawAttr }
  },
  parseHTML() {
    return [{ tag: 'div[data-md-raw]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-md-raw': '',
        'data-raw': node.attrs.raw,
        class: 'md-raw-block',
      }),
      String(node.attrs.raw ?? ''),
    ]
  },
  // Un token `html` de marked: en bloque, este nodo; en línea, `rawInline`.
  markdownTokenName: 'html',
  parseMarkdown: (token, h) => {
    const raw = String(token.raw ?? '')
    if (token.block) return h.createNode('rawBlock', { raw: raw.replace(/\n+$/, '') })
    return h.createNode('rawInline', { raw })
  },
  renderMarkdown: (node) => String(node.attrs?.raw ?? ''),
})
