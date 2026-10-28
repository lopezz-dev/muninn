import type { Edit } from './format'

/**
 * Aplica un cambio a un `<textarea>` como si lo hubiera escrito la persona: así el campo conserva su
 * historial de deshacer (Ctrl/⌘ Z) y React recibe el `input` de siempre. `execCommand` está en desuso,
 * pero sigue siendo la única forma de editar un campo sin perder el deshacer nativo; si no existe,
 * se escribe directamente y se avisa a mano.
 */
export function applyEdit(el: HTMLTextAreaElement, edit: Edit) {
  el.focus({ preventScroll: true })
  el.setSelectionRange(edit.from, edit.to)
  let done = false
  if (typeof document.execCommand === 'function') {
    try {
      done = edit.insert
        ? document.execCommand('insertText', false, edit.insert)
        : document.execCommand('delete')
    } catch {
      done = false
    }
  }
  if (!done) {
    el.setRangeText(edit.insert, edit.from, edit.to, 'end')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  el.setSelectionRange(edit.selStart, edit.selEnd)
}
