import {
  cn,
  IconButton,
  icons,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  screenIcons,
} from '@muninn/ui'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { openExternal } from '../../../lib/external-link'
import { askLink } from '../../../lib/link-menu'
import { safeHref } from '../../../markdown/Markdown'
import { noteExtensions } from './extensions'
import { tidyMarkdown } from './tidy'

export interface RichNoteOptions {
  /** El Markdown de la nota (el borrador): manda sobre el editor si cambia desde fuera. */
  content: string
  /** En el teléfono, lectura por defecto y el lápiz para editar (ADR-0078). */
  editable: boolean
  placeholder: string
  /** Solo se llama cuando la persona cambia algo: abrir una nota nunca la reescribe. */
  onChange(markdown: string): void
  onBlur(): void
  /** ⌘⌥M o el botón «Comentar» de la selección; sin esto no se ofrece. */
  onComment?: () => void
  label: string
}

/** ¿Pantalla táctil? Decide dónde sale la barra de la selección (el menú del sistema va encima). */
const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** Abre un enlace de la nota como el resto de la app: menú «Abrir · Copiar» en táctil, el navegador del sistema en Tauri. */
function openLink(href: string, el: HTMLElement) {
  const url = safeHref(href)
  if (!url) return
  if (coarse()) {
    const r = el.getBoundingClientRect()
    if (askLink({ url, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }))
      return
  }
  void openExternal(url)
}

/**
 * El editor TipTap de una nota (ADR-0078). Guarda Markdown: entra con `@tiptap/markdown` (el lexer de marked) y sale con
 * su serializador, pero **solo si la persona cambia algo**. Si el borrador cambia desde fuera (otro dispositivo, el MCP,
 * «Editar como Markdown»), se adopta manteniendo el cursor donde se pueda.
 */
export function useRichNote({
  content,
  editable,
  placeholder,
  onChange,
  onBlur,
  onComment,
  label,
}: RichNoteOptions) {
  // El último Markdown que salió del editor o que se le dio: si el borrador vuelve con él, no hay nada que hacer.
  const known = useRef(content)
  const handlers = useRef({ onChange, onBlur, onComment })
  handlers.current = { onChange, onBlur, onComment }
  const linkRequest = useRef<() => void>(() => {})

  const editor = useEditor({
    extensions: noteExtensions({ placeholder, onReadOnlyChecked: () => true }),
    content,
    contentType: 'markdown',
    editable,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: 'note-prose',
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
      handleKeyDown: (view, event) => {
        const mod = (event.metaKey || event.ctrlKey) && !event.shiftKey
        // ⌘K con texto seleccionado o dentro de un enlace: el enlace, no el buscador.
        if (mod && !event.altKey && event.key.toLowerCase() === 'k' && view.editable) {
          const { empty, $from } = view.state.selection
          const inLink = $from.marks().some((m) => m.type.name === 'link')
          if (empty && !inLink) return false
          event.preventDefault()
          event.stopPropagation()
          linkRequest.current()
          return true
        }
        // ⌘⌥M: comentar la selección (como en Google Docs).
        if (mod && event.altKey && event.code === 'KeyM' && handlers.current.onComment) {
          event.preventDefault()
          event.stopPropagation()
          handlers.current.onComment()
          return true
        }
        if (event.key === 'Escape') {
          ;(view.dom as HTMLElement).blur()
          return true
        }
        return false
      },
      handleClick: (view, _pos, event) => {
        const a = (event.target as HTMLElement).closest('a')
        if (!a || !view.dom.contains(a)) return false
        // Editando, un clic pone el cursor; ⌘/Ctrl-clic (o leyendo, un toque) abre el enlace.
        if (view.editable && !(event.metaKey || event.ctrlKey)) return false
        event.preventDefault()
        openLink(a.getAttribute('href') ?? '', a)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const md = tidyMarkdown(editor.getMarkdown())
      known.current = md
      handlers.current.onChange(md)
    },
    onBlur: () => handlers.current.onBlur(),
  })

  // Un cambio de fuera: se adopta sin avisar a `onChange` (no es de la persona) y con el cursor en su sitio.
  useEffect(() => {
    if (!editor || content === known.current) return
    known.current = content
    const { from, to } = editor.state.selection
    const hadFocus = editor.isFocused
    // Fuera del historial: deshacer no debe devolver la versión de antes de otro dispositivo.
    editor
      .chain()
      .setMeta('addToHistory', false)
      .setContent(content, { contentType: 'markdown', emitUpdate: false })
      .run()
    const max = editor.state.doc.content.size
    if (hadFocus) {
      editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) })
    }
  }, [editor, content])

  useEffect(() => {
    editor?.setEditable(editable, false)
  }, [editor, editable])

  return { editor, linkRequest }
}

export { EditorContent }

/** Estado de la barra: qué está activo donde está el cursor. */
function useFormatState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level })) ?? 0,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
}

interface ToolProps {
  label: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
  touch: boolean
  onRun(): void
  children: ReactNode
}

function Tool({ label, shortcut, active, disabled, touch, onRun, children }: ToolProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      // No quitar el foco ni la selección del texto (en iOS, tampoco cerrar el teclado).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={cn(
        'grid shrink-0 cursor-pointer place-items-center rounded-sm text-sm text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent',
        touch ? 'size-10' : 'size-7',
        active && 'bg-fg/[0.07] text-fg',
      )}
    >
      {children}
    </button>
  )
}

const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

/** Barra fija de arriba: bloques (títulos, listas, tareas, tablas) y deshacer. Lo de en línea va también en la flotante. */
export function FormatBar({
  editor,
  touch,
  onLink,
}: {
  editor: Editor
  touch: boolean
  onLink(): void
}) {
  const { t } = useTranslation('notes')
  const s = useFormatState(editor)
  const run = (fn: (e: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () =>
    fn(editor.chain().focus()).run()
  const icon = touch ? 17 : 15
  const sep = <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-border" />

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={t('tools.heading')}
            title={t('tools.heading')}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              'flex shrink-0 cursor-pointer items-center gap-1 rounded-sm px-1.5 text-sm text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
              touch ? 'h-10' : 'h-7',
              s.heading && 'text-fg',
            )}
          >
            <span className="min-w-[4.5rem] text-left">
              {s.heading ? t('tools.headingLevel', { level: s.heading }) : t('tools.paragraph')}
            </span>
            <icons.chevronDown size={12} aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItem onSelect={run((c) => c.setParagraph())}>{t('tools.paragraph')}</MenuItem>
          {([1, 2, 3] as const).map((level) => (
            <MenuItem key={level} onSelect={run((c) => c.setHeading({ level }))}>
              <span
                className={cn(
                  'font-semibold',
                  level === 1 ? 'text-lg' : level === 2 ? 'text-md' : 'text-base',
                )}
              >
                {t('tools.headingLevel', { level })}
              </span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {sep}
      <Tool
        label={t('tools.bold')}
        shortcut={`${MOD} B`}
        active={s.bold}
        touch={touch}
        onRun={run((c) => c.toggleBold())}
      >
        <span className="font-bold">B</span>
      </Tool>
      <Tool
        label={t('tools.italic')}
        shortcut={`${MOD} I`}
        active={s.italic}
        touch={touch}
        onRun={run((c) => c.toggleItalic())}
      >
        <span className="font-serif italic">I</span>
      </Tool>
      <Tool
        label={t('tools.strike')}
        shortcut={`${MOD} ⇧ S`}
        active={s.strike}
        touch={touch}
        onRun={run((c) => c.toggleStrike())}
      >
        <span className="line-through">S</span>
      </Tool>
      <Tool
        label={t('tools.code')}
        shortcut={`${MOD} E`}
        active={s.code}
        touch={touch}
        onRun={run((c) => c.toggleCode())}
      >
        <span className="font-mono text-xs">{'</>'}</span>
      </Tool>
      <Tool
        label={t('tools.link')}
        shortcut={`${MOD} K`}
        active={s.link}
        touch={touch}
        onRun={onLink}
      >
        <icons.link size={icon} />
      </Tool>
      {sep}
      <Tool
        label={t('tools.bullet')}
        active={s.bullet}
        touch={touch}
        onRun={run((c) => c.toggleBulletList())}
      >
        <screenIcons.list size={icon} />
      </Tool>
      <Tool
        label={t('tools.ordered')}
        active={s.ordered}
        touch={touch}
        onRun={run((c) => c.toggleOrderedList())}
      >
        <screenIcons.listNumbers size={icon} />
      </Tool>
      <Tool
        label={t('tools.task')}
        active={s.task}
        touch={touch}
        onRun={run((c) => c.toggleTaskList())}
      >
        <screenIcons.checklist size={icon} />
      </Tool>
      <Tool
        label={t('tools.quote')}
        active={s.quote}
        touch={touch}
        onRun={run((c) => c.toggleBlockquote())}
      >
        <screenIcons.quote size={icon} />
      </Tool>
      <Tool
        label={t('tools.codeBlock')}
        active={s.codeBlock}
        touch={touch}
        onRun={run((c) => c.toggleCodeBlock())}
      >
        <screenIcons.codeBlock size={icon} />
      </Tool>
      <TableTool editor={editor} active={s.table} touch={touch} />
      {sep}
      <Tool
        label={t('tools.undo')}
        shortcut={`${MOD} Z`}
        disabled={!s.canUndo}
        touch={touch}
        onRun={run((c) => c.undo())}
      >
        <screenIcons.undo size={icon} />
      </Tool>
      <Tool
        label={t('tools.redo')}
        shortcut={`${MOD} ⇧ Z`}
        disabled={!s.canRedo}
        touch={touch}
        onRun={run((c) => c.redo())}
      >
        <screenIcons.redo size={icon} />
      </Tool>
    </>
  )
}

/** Tabla: insertar una nueva o, con el cursor dentro, añadir y quitar filas y columnas. */
function TableTool({ editor, active, touch }: { editor: Editor; active: boolean; touch: boolean }) {
  const { t } = useTranslation('notes')
  const run = (fn: (e: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () =>
    fn(editor.chain().focus()).run()
  if (!active) {
    return (
      <Tool
        label={t('tools.table')}
        touch={touch}
        onRun={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
      >
        <screenIcons.table size={touch ? 17 : 15} />
      </Tool>
    )
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('tools.tableMenu')}
          title={t('tools.tableMenu')}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            'grid shrink-0 cursor-pointer place-items-center rounded-sm bg-fg/[0.07] text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent',
            touch ? 'size-10' : 'size-7',
          )}
        >
          <screenIcons.table size={touch ? 17 : 15} />
        </button>
      </MenuTrigger>
      <MenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        <MenuItem onSelect={run((c) => c.addRowAfter())}>{t('table.rowAfter')}</MenuItem>
        <MenuItem onSelect={run((c) => c.addRowBefore())}>{t('table.rowBefore')}</MenuItem>
        <MenuItem onSelect={run((c) => c.addColumnAfter())}>{t('table.colAfter')}</MenuItem>
        <MenuItem onSelect={run((c) => c.addColumnBefore())}>{t('table.colBefore')}</MenuItem>
        <MenuItem onSelect={run((c) => c.deleteRow())}>{t('table.deleteRow')}</MenuItem>
        <MenuItem onSelect={run((c) => c.deleteColumn())}>{t('table.deleteCol')}</MenuItem>
        <MenuItem danger onSelect={run((c) => c.deleteTable())}>
          {t('table.delete')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/** La selección de texto dentro del editor (también leyendo, cuando ProseMirror no la sigue) y dónde pintarla. */
interface SelectionInfo {
  from: number
  to: number
  rect: DOMRect
}

function readSelection(editor: Editor): SelectionInfo | null {
  const view = editor.view
  const sel = view.dom.ownerDocument.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!view.dom.contains(range.commonAncestorContainer)) return null
  try {
    const a = view.posAtDOM(range.startContainer, range.startOffset)
    const b = view.posAtDOM(range.endContainer, range.endOffset)
    const from = Math.min(a, b)
    const to = Math.max(a, b)
    if (to <= from) return null
    if (!view.state.doc.textBetween(from, to, ' ').trim()) return null
    return { from, to, rect: range.getBoundingClientRect() }
  } catch {
    return null
  }
}

/** La selección: la de ProseMirror si se está editando; la del documento si se lee (ahí ProseMirror no la sigue). */
function currentSelection(editor: Editor): SelectionInfo | null {
  if (!editor.isEditable || !editor.isFocused) return readSelection(editor)
  const { from, to, empty } = editor.state.selection
  if (empty || !editor.state.doc.textBetween(from, to, ' ').trim()) return null
  const a = editor.view.coordsAtPos(from)
  const b = editor.view.coordsAtPos(to, -1)
  const left = Math.min(a.left, b.left)
  const right = a.top === b.top ? Math.max(a.right, b.right) : Math.max(a.left, b.right)
  return { from, to, rect: new DOMRect(left, a.top, Math.max(1, right - left), b.bottom - a.top) }
}

/** Enlace donde está el cursor (editando, sin selección): para la tarjeta «Abrir · Editar · Quitar». */
function linkAtCursor(editor: Editor): { href: string; rect: DOMRect } | null {
  if (!editor.isEditable || !editor.isFocused) return null
  const { empty, from } = editor.state.selection
  if (!empty || !editor.isActive('link')) return null
  const href = String(editor.getAttributes('link').href ?? '')
  const c = editor.view.coordsAtPos(from)
  return { href, rect: new DOMRect(c.left, c.top, 1, c.bottom - c.top) }
}

/**
 * Barra flotante sobre la selección (ADR-0078): negrita, cursiva, tachado, código, enlace y **Comentar**. Leyendo (el
 * teléfono), solo «Comentar»; en táctil va debajo de la selección, porque encima sale el menú del sistema (Copiar…).
 */
export function SelectionBar({
  editor,
  linkRequest,
  onComment,
}: {
  editor: Editor
  linkRequest: { current: () => void }
  onComment?: (range: { from: number; to: number }) => void
}) {
  const { t } = useTranslation('notes')
  const [sel, setSel] = useState<SelectionInfo | null>(null)
  const [link, setLink] = useState<{ href: string; rect: DOMRect } | null>(null)
  const [editingLink, setEditingLink] = useState<string | null>(null)
  // Mientras se escribe la dirección, el foco está en el campo: la selección se congela donde estaba.
  const [frozen, setFrozen] = useState<DOMRect | null>(null)
  const editingRef = useRef(false)
  editingRef.current = editingLink !== null
  const barRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const touch = coarse()
  const s = useFormatState(editor)

  const refresh = useCallback(() => {
    if (editingRef.current) return
    setSel(currentSelection(editor))
    setLink(linkAtCursor(editor))
  }, [editor])

  useEffect(() => {
    const doc = editor.view.dom.ownerDocument
    const onSelection = () => requestAnimationFrame(refresh)
    doc.addEventListener('selectionchange', onSelection)
    editor.on('selectionUpdate', refresh)
    editor.on('focus', refresh)
    editor.on('transaction', refresh)
    const onBlur = ({ event }: { event: FocusEvent }) => {
      // Al pulsar la barra (o su campo de enlace), el editor pierde el foco: no se esconde.
      if (barRef.current?.contains(event.relatedTarget as Node)) return
      setLink(null)
    }
    editor.on('blur', onBlur)
    // Desplazar el contenedor (en escritorio hace scroll `<main>`) mueve la selección.
    const onScroll = () => refresh()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      doc.removeEventListener('selectionchange', onSelection)
      editor.off('selectionUpdate', refresh)
      editor.off('focus', refresh)
      editor.off('transaction', refresh)
      editor.off('blur', onBlur)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [editor, refresh])

  // ⌘K desde el teclado: abre el campo del enlace con lo que haya.
  useEffect(() => {
    linkRequest.current = () => {
      editor.chain().focus().extendMarkRange('link').run()
      const { from, to } = editor.state.selection
      const a = editor.view.coordsAtPos(from)
      const b = editor.view.coordsAtPos(to, -1)
      setFrozen(new DOMRect(a.left, a.top, Math.max(1, b.right - a.left), a.bottom - a.top))
      setEditingLink(String(editor.getAttributes('link').href ?? ''))
    }
  }, [editor, linkRequest])

  const anchor = editingLink !== null ? frozen : (sel?.rect ?? link?.rect ?? null)
  const showFormat = Boolean(sel) && editor.isEditable
  const showComment = Boolean(sel) && Boolean(onComment)
  const visible =
    Boolean(anchor) && (showFormat || showComment || Boolean(link) || editingLink !== null)

  // Posición: centrada sobre la selección (debajo en táctil), sin salirse de la ventana.
  useLayoutEffect(() => {
    if (!visible || !anchor || !barRef.current) {
      setPos(null)
      return
    }
    const bar = barRef.current.getBoundingClientRect()
    const margin = 8
    let left = anchor.left + anchor.width / 2 - bar.width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - bar.width - margin))
    const below = touch || anchor.top - bar.height - margin < 56
    const top = below ? anchor.bottom + margin + (touch ? 28 : 0) : anchor.top - bar.height - margin
    setPos({ left: Math.round(left), top: Math.round(top) })
  }, [visible, anchor, touch])

  if (!visible) return null

  const closeLink = (refocus: boolean) => {
    setEditingLink(null)
    setFrozen(null)
    if (refocus) editor.commands.focus()
    requestAnimationFrame(refresh)
  }
  const applyLink = (e: FormEvent) => {
    e.preventDefault()
    const href = (editingLink ?? '').trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!href) chain.unsetLink().run()
    else {
      const url = /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`
      if (!safeHref(url)) return
      // Sin texto seleccionado, la propia dirección es el texto del enlace.
      if (editor.state.selection.empty && !editor.isActive('link')) {
        chain
          .insertContent({
            type: 'text',
            text: href,
            marks: [{ type: 'link', attrs: { href: url } }],
          })
          .run()
      } else chain.setLink({ href: url }).run()
    }
    closeLink(false)
  }

  const btn = cn(
    'grid cursor-pointer place-items-center rounded-sm text-sm text-fg-muted outline-none transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
    touch ? 'size-10' : 'size-8',
  )
  const keep = (e: { preventDefault(): void }) => e.preventDefault()

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={t('tools.selection')}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className="glass-floating fixed z-40 flex items-center gap-0.5 rounded-lg border border-border p-1 shadow-lg"
    >
      {editingLink !== null ? (
        <form onSubmit={applyLink} className="flex items-center gap-1">
          <input
            // biome-ignore lint/a11y/noAutofocus: el campo aparece porque se ha pedido el enlace
            autoFocus
            aria-label={t('link.url')}
            placeholder="https://"
            value={editingLink}
            onChange={(e) => setEditingLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                closeLink(true)
              }
            }}
            onBlur={(e) => {
              if (!barRef.current?.contains(e.relatedTarget as Node)) closeLink(false)
            }}
            className="h-8 w-60 rounded-sm bg-transparent px-2 text-sm text-fg outline-none placeholder:text-fg-faint"
          />
          <button
            type="submit"
            className={cn(btn, 'px-2 text-accent')}
            aria-label={t('link.apply')}
          >
            <icons.check size={15} />
          </button>
        </form>
      ) : sel ? (
        <>
          {showFormat ? (
            <>
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => editor.chain().focus().toggleBold().run()}
                aria-label={t('tools.bold')}
                aria-pressed={s.bold}
                className={cn(btn, s.bold && 'text-accent')}
              >
                <span className="font-bold">B</span>
              </button>
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                aria-label={t('tools.italic')}
                aria-pressed={s.italic}
                className={cn(btn, s.italic && 'text-accent')}
              >
                <span className="font-serif italic">I</span>
              </button>
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                aria-label={t('tools.strike')}
                aria-pressed={s.strike}
                className={cn(btn, s.strike && 'text-accent')}
              >
                <span className="line-through">S</span>
              </button>
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => editor.chain().focus().toggleCode().run()}
                aria-label={t('tools.code')}
                aria-pressed={s.code}
                className={cn(btn, s.code && 'text-accent')}
              >
                <span className="font-mono text-xs">{'</>'}</span>
              </button>
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => linkRequest.current()}
                aria-label={t('tools.link')}
                aria-pressed={s.link}
                className={cn(btn, s.link && 'text-accent')}
              >
                <icons.link size={15} />
              </button>
            </>
          ) : null}
          {showComment && sel ? (
            <>
              {showFormat ? (
                <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
              ) : null}
              <button
                type="button"
                onMouseDown={keep}
                onClick={() => onComment?.({ from: sel.from, to: sel.to })}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-sm px-2 text-sm font-medium text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent',
                  touch ? 'h-10' : 'h-8',
                )}
                title={`${t('comments.comment')} (${MOD} ⌥ M)`}
              >
                <screenIcons.comment size={15} aria-hidden="true" />
                {t('comments.comment')}
              </button>
            </>
          ) : null}
        </>
      ) : link ? (
        <>
          <span className="max-w-60 truncate px-2 text-sm text-fg-subtle">{link.href}</span>
          <IconButton
            aria-label={t('link.open')}
            icon={<icons.external />}
            onMouseDown={keep}
            onClick={(e) => openLink(link.href, e.currentTarget)}
          />
          <IconButton
            aria-label={t('link.edit')}
            icon={<icons.edit />}
            onMouseDown={keep}
            onClick={() => linkRequest.current()}
          />
          <IconButton
            aria-label={t('link.remove')}
            icon={<icons.close />}
            onMouseDown={keep}
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          />
        </>
      ) : null}
    </div>
  )
}
