import type { AnyExtension } from '@tiptap/core'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { t } from '../../../i18n'
import { safeHref } from '../../../markdown/Markdown'
import { MdImage, RawBlock, RawInline } from './raw-nodes'
import { TaskFromBullet } from './task-input'

export interface NoteExtensionsOptions {
  placeholder?: string
  /**
   * Marcar una casilla con el editor en solo lectura (el teléfono, ADR-0078): leer una lista de tareas y tacharla no
   * debería pedir el lápiz. Devuelve si se acepta.
   */
  onReadOnlyChecked?: () => boolean
}

/**
 * El esquema del editor de notas (ADR-0078). Sin nodo de HTML (el HTML se ve como texto, `raw-nodes.ts`), sin subrayado
 * (Markdown no lo tiene) y con los enlaces limitados a `http(s)`, `mailto` y `tel`, como en la vista de siempre.
 */
export function noteExtensions(options: NoteExtensionsOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      underline: false,
      // Lo que hace falta está aquí: los atajos de Markdown (`## `, `- `, `> `…) vienen con cada nodo.
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: ['mailto', 'tel'],
        isAllowedUri: (url) => safeHref(url) !== null,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
      // El deshacer agrupa por pausas, como un campo de texto.
      undoRedo: { newGroupDelay: 600 },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      // La etiqueta de la casilla, en el idioma de la app (la de TipTap viene en inglés).
      a11y: {
        checkboxLabel: (node, checked) =>
          `${t(checked ? 'markdown.markPending' : 'markdown.markDone', { ns: 'notes' })}: ${node.textContent}`,
      },
      onReadOnlyChecked: options.onReadOnlyChecked
        ? () => !!options.onReadOnlyChecked?.()
        : undefined,
    }),
    TaskFromBullet,
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder: options.placeholder ?? '' }),
    MdImage,
    RawInline,
    RawBlock,
    Markdown.configure({ markedOptions: { gfm: true } }),
  ]
}
