// biome-ignore-all lint/suspicious/noArrayIndexKey: el árbol sale del texto, sin ids, y se rehace entero en cada cambio
import { cn } from '@muninn/ui'
import { Lexer, type Token, type Tokens } from 'marked'
import { Fragment, type ReactNode, useMemo } from 'react'
import { makeSlugger } from './outline'
import { plainText } from './plain'
import { countTasks } from './tasks'

/**
 * Markdown → elementos de React, sin pasar por HTML (ADR-0026): el saneado es por construcción. React
 * escapa todo el texto; el HTML que escriba la persona se muestra como texto; los enlaces solo
 * llevan a `http(s)`, `mailto` y `tel` (lista cerrada); las imágenes no se cargan (sería hacer una
 * petición a un servidor ajeno solo por abrir una nota).
 */

const SAFE_HREF = /^(?:https?:|mailto:|tel:)/i

/** Destino de un enlace si es seguro, o `null`. Lista cerrada: `javascript:`, `data:` y demás, fuera. */
export function safeHref(href: string): string | null {
  const h = href.trim()
  return SAFE_HREF.test(h) ? h : null
}

export interface MarkdownProps {
  source: string
  /**
   * Se llama al marcar o desmarcar una casilla de tarea, con su número (por orden de aparición).
   * Sin esto, las casillas son de solo lectura.
   */
  onToggleTask?: (index: number) => void
  /** Pone un `id` a cada título (`#iniciar-sesion`), para enlazar a un apartado. */
  headingIds?: boolean
  /**
   * Una cita que empieza en negrita (`> **Estado:** …`) se pinta como aviso destacado. Con una función,
   * ella decide el icono y el tono según esa etiqueta en negrita («Estado», «Próximamente»…).
   */
  callouts?: boolean | ((label: string) => CalloutLook)
  /**
   * Enlaces propios (entre guías): devuelve el elemento para ese destino, o `undefined` para el
   * tratamiento normal (que solo admite `http(s)`, `mailto` y `tel`).
   */
  renderLink?: (href: string, children: ReactNode) => ReactNode | undefined
  className?: string
}

/** Cómo se ve un aviso: un icono delante y el tono (acento, o neutro para lo que aún no existe). */
export interface CalloutLook {
  icon?: ReactNode
  tone?: 'accent' | 'neutral'
}

interface Ctx {
  /** Contador de casillas de tarea, en el orden en que se pintan. */
  tasks: number
  onToggleTask?: (index: number) => void
  /** Reparte los `id` de los títulos (solo con `headingIds`). */
  slug?: (text: string) => string
  callouts?: MarkdownProps['callouts']
  renderLink?: MarkdownProps['renderLink']
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

/**
 * marked deja las entidades HTML (`&amp;`, `&#233;`) tal cual en el texto, porque espera pasarlas a HTML.
 * Aquí no hay HTML: se decodifican a mano, solo las más comunes.
 */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(\w+));/g, (m, dec, hex, name) => {
    if (name) return NAMED[name] ?? m
    const code = hex ? Number.parseInt(hex, 16) : Number(dec)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�'
  })
}

const text = (t: Token) => ('text' in t && typeof t.text === 'string' ? t.text : '')

function inline(tokens: Token[] | undefined, ctx: Ctx): ReactNode {
  return tokens?.map((t, i) => <Fragment key={i}>{inlineToken(t, ctx)}</Fragment>)
}

function inlineToken(t: Token, ctx: Ctx): ReactNode {
  switch (t.type) {
    case 'text':
    case 'escape': {
      const tk = t as Tokens.Text
      return tk.tokens ? inline(tk.tokens, ctx) : decodeEntities(tk.text)
    }
    case 'strong':
      return (
        <strong className="font-semibold text-fg">
          {inline((t as Tokens.Strong).tokens, ctx)}
        </strong>
      )
    case 'em':
      return <em>{inline((t as Tokens.Em).tokens, ctx)}</em>
    case 'del':
      return <del className="text-fg-subtle">{inline((t as Tokens.Del).tokens, ctx)}</del>
    case 'codespan':
      return (
        <code className="rounded-sm bg-surface-raised px-1.5 py-px font-mono text-[0.9em] text-fg">
          {(t as Tokens.Codespan).text}
        </code>
      )
    case 'br':
      return <br />
    case 'link': {
      const tk = t as Tokens.Link
      const href = safeHref(decodeEntities(tk.href))
      const label = inline(tk.tokens, ctx)
      const custom = ctx.renderLink?.(decodeEntities(tk.href), label)
      if (custom !== undefined) return custom
      return href ? (
        <a
          href={href}
          title={tk.title ? decodeEntities(tk.title) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          {label}
        </a>
      ) : (
        label
      )
    }
    case 'image': {
      // Sin cargar la imagen: su texto alternativo, como enlace si el destino es seguro.
      const tk = t as Tokens.Image
      const href = safeHref(decodeEntities(tk.href))
      const label = decodeEntities(tk.text) || 'imagen'
      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          {label}
        </a>
      ) : (
        label
      )
    }
    default:
      // HTML en línea (`<b>`, `<br>`…) y cualquier otra cosa: como texto.
      return text(t) || ('raw' in t ? t.raw : '')
  }
}

const HEADINGS = {
  1: 'mt-2 text-2xl font-semibold tracking-tight text-fg',
  2: 'mt-2 text-xl font-semibold tracking-tight text-fg',
  3: 'mt-2 text-lg font-semibold text-fg',
  4: 'mt-1 text-md font-semibold text-fg',
  5: 'mt-1 text-base font-semibold text-fg',
  6: 'mt-1 text-base font-semibold text-fg-muted',
} as const

function blocks(tokens: Token[], ctx: Ctx): ReactNode {
  return tokens.map((t, i) => {
    const node = block(t, ctx)
    return node == null ? null : <Fragment key={i}>{node}</Fragment>
  })
}

function listItem(item: Tokens.ListItem, ctx: Ctx): ReactNode {
  const body = item.tokens.filter((t) => t.type !== 'checkbox')
  let check: ReactNode = null
  if (item.task) {
    const index = ctx.tasks++
    const toggle = ctx.onToggleTask
    check = (
      <input
        type="checkbox"
        checked={Boolean(item.checked)}
        disabled={!toggle}
        onChange={toggle ? () => toggle(index) : undefined}
        aria-label={item.checked ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className={cn(
          'mt-[0.45em] mr-2 size-3.5 shrink-0 accent-accent',
          toggle ? 'cursor-pointer' : 'cursor-default',
        )}
      />
    )
  }
  return (
    <li
      className={cn(
        'pl-1 marker:text-fg-subtle',
        item.task && 'flex list-none items-start pl-0',
        item.task && item.checked && 'text-fg-subtle line-through',
      )}
    >
      {check}
      {item.task ? <div className="min-w-0 flex-1">{blocks(body, ctx)}</div> : blocks(body, ctx)}
    </li>
  )
}

function block(t: Token, ctx: Ctx): ReactNode {
  switch (t.type) {
    case 'space':
      return null
    case 'heading': {
      const tk = t as Tokens.Heading
      const Tag = `h${tk.depth}` as 'h1'
      const id = ctx.slug?.(plainText(tk.text, 200))
      return (
        <Tag
          id={id}
          className={cn(HEADINGS[tk.depth as 1 | 2 | 3 | 4 | 5 | 6], id && 'scroll-mt-6')}
        >
          {inline(tk.tokens, ctx)}
        </Tag>
      )
    }
    case 'paragraph':
      return <p>{inline((t as Tokens.Paragraph).tokens, ctx)}</p>
    case 'text': {
      // Texto suelto dentro de un elemento de lista (lista apretada).
      const tk = t as Tokens.Text
      return <p>{tk.tokens ? inline(tk.tokens, ctx) : decodeEntities(tk.text)}</p>
    }
    case 'blockquote': {
      const tk = t as Tokens.Blockquote
      const first = tk.tokens[0]
      const label = first?.type === 'paragraph' ? first.tokens?.[0] : undefined
      if (!ctx.callouts || label?.type !== 'strong') {
        return (
          <blockquote className="flex flex-col gap-3 border-l-2 border-border-strong pl-4 text-fg-subtle">
            {blocks(tk.tokens, ctx)}
          </blockquote>
        )
      }
      const look: CalloutLook =
        typeof ctx.callouts === 'function'
          ? ctx.callouts(plainText((label as Tokens.Strong).text, 80).replace(/:\s*$/, ''))
          : {}
      return (
        <div
          role="note"
          className={cn(
            'flex gap-3 rounded-md border px-3.5 py-3 text-base leading-relaxed text-fg-muted',
            look.tone === 'neutral'
              ? 'border-dashed border-border-strong bg-surface'
              : 'border-accent/30 bg-accent-soft',
          )}
        >
          {look.icon ? (
            <span
              aria-hidden="true"
              className={cn(
                'mt-[3px] shrink-0',
                look.tone === 'neutral' ? 'text-fg-subtle' : 'text-accent',
              )}
            >
              {look.icon}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-2">{blocks(tk.tokens, ctx)}</div>
        </div>
      )
    }
    case 'list': {
      const tk = t as Tokens.List
      const Tag = tk.ordered ? 'ol' : 'ul'
      return (
        <Tag
          start={tk.ordered && tk.start !== 1 ? Number(tk.start) : undefined}
          className={cn('flex flex-col gap-1.5 pl-5', tk.ordered ? 'list-decimal' : 'list-disc')}
        >
          {tk.items.map((item, i) => (
            <Fragment key={i}>{listItem(item, ctx)}</Fragment>
          ))}
        </Tag>
      )
    }
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-sunken p-3 font-mono text-sm leading-relaxed text-fg">
          <code>{(t as Tokens.Code).text}</code>
        </pre>
      )
    case 'hr':
      return <hr className="border-border-subtle" />
    case 'table': {
      const tk = t as Tokens.Table
      const align = (a: string | null) =>
        a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left'
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface text-xs font-semibold text-fg-subtle">
              <tr>
                {tk.header.map((c, i) => (
                  <th key={i} className={cn('px-3 py-2', align(c.align))}>
                    {inline(c.tokens, ctx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tk.rows.map((row, r) => (
                <tr key={r} className="border-t border-border-subtle">
                  {row.map((c, i) => (
                    <td key={i} className={cn('px-3 py-2 align-top', align(c.align))}>
                      {inline(c.tokens, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    default:
      // HTML en bloque y cualquier otra cosa: se muestra tal cual, como texto.
      return <p className="whitespace-pre-wrap">{text(t) || ('raw' in t ? t.raw : '')}</p>
  }
}

/** Vista de un texto en Markdown (GFM: tablas, tachado, listas de tareas). */
export function Markdown({
  source,
  onToggleTask,
  headingIds,
  callouts,
  renderLink,
  className,
}: MarkdownProps) {
  const tokens = useMemo(() => Lexer.lex(source, { gfm: true }), [source])
  const start = (toggle?: MarkdownProps['onToggleTask']): Ctx => ({
    tasks: 0,
    onToggleTask: toggle,
    slug: headingIds ? makeSlugger() : undefined,
    callouts,
    renderLink,
  })
  let ctx = start(onToggleTask)
  let body = blocks(tokens, ctx)
  // Marcar una casilla reescribe el texto por su número: si la vista y el texto no cuentan las
  // mismas casillas, mejor que sean de solo lectura que tocar otra.
  if (onToggleTask && ctx.tasks !== countTasks(source)) {
    ctx = start()
    body = blocks(tokens, ctx)
  }
  return (
    <div
      className={cn(
        'flex flex-col gap-3.5 text-md leading-[1.7] text-fg-muted [overflow-wrap:break-word]',
        className,
      )}
    >
      {body}
    </div>
  )
}
