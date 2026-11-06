import { type CommentAnchor, locateQuote } from '@muninn/core'
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { textMap, toDocRange } from './text-map'

/** Un hilo que se subraya en el texto. */
export interface Highlight {
  id: string
  anchor: CommentAnchor
  forAgent: boolean
}

interface HighlightState {
  highlights: Highlight[]
  /** El hilo abierto: su subrayado se ilumina. */
  active: string | null
  /** Recién creado: el subrayado se dibuja de izquierda a derecha. */
  fresh: string | null
  /** La selección que se está comentando, antes de enviar. */
  draft: { from: number; to: number } | null
  decorations: DecorationSet
}

type Meta = Partial<Pick<HighlightState, 'highlights' | 'active' | 'fresh' | 'draft'>>

export const commentHighlightsKey = new PluginKey<HighlightState>('commentHighlights')

/** Busca cada cita en el texto visible (el mismo que usa el core) y la subraya. */
function build(doc: PMNode, s: Omit<HighlightState, 'decorations'>): DecorationSet {
  const decos: Decoration[] = []
  if (s.highlights.length) {
    const map = textMap(doc)
    for (const h of s.highlights) {
      const found = locateQuote(map.text, {
        quote: h.anchor.quote,
        prefix: h.anchor.prefix,
        suffix: h.anchor.suffix,
        start: h.anchor.start,
      })
      const r = found && toDocRange(map, found.start, found.end)
      if (!r) continue
      const cls = ['mn-comment']
      if (h.id === s.active) cls.push('is-active')
      if (h.id === s.fresh) cls.push('is-fresh')
      if (h.forAgent) cls.push('is-agent')
      decos.push(Decoration.inline(r.from, r.to, { class: cls.join(' '), 'data-thread': h.id }))
    }
  }
  if (s.draft && s.draft.to > s.draft.from) {
    decos.push(Decoration.inline(s.draft.from, s.draft.to, { class: 'mn-comment is-draft' }))
  }
  return DecorationSet.create(doc, decos)
}

/** Un cambio de fuera (otro dispositivo, «Editar como Markdown»): no se puede seguir el texto, se vuelve a buscar. */
const isExternal = (tr: Transaction) => tr.getMeta('addToHistory') === false

export interface CommentHighlightsOptions {
  /** Al pulsar un subrayado. */
  onActivate: (id: string) => void
}

/**
 * Subrayados de los comentarios (ADR-0079). Mientras se escribe, son decoraciones que ProseMirror mueve con cada cambio;
 * la verdad la escribe el core al guardar (vuelve a anclar) y, cuando llega, se vuelve a buscar cada cita.
 */
export const CommentHighlights = Extension.create<CommentHighlightsOptions>({
  name: 'commentHighlights',
  addOptions() {
    return { onActivate: () => {} }
  },
  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin<HighlightState>({
        key: commentHighlightsKey,
        state: {
          init: (_, state) => {
            const s = { highlights: [], active: null, fresh: null, draft: null }
            return { ...s, decorations: build(state.doc, s) }
          },
          apply: (tr, prev, _old, state) => {
            const meta = tr.getMeta(commentHighlightsKey) as Meta | undefined
            let draft = prev.draft
            if (draft && tr.docChanged) {
              const from = tr.mapping.map(draft.from, 1)
              const to = tr.mapping.map(draft.to, -1)
              draft = to > from ? { from, to } : null
            }
            const next = { ...prev, draft, ...meta }
            if (meta || (tr.docChanged && isExternal(tr))) {
              return { ...next, decorations: build(state.doc, next) }
            }
            if (tr.docChanged) {
              const mapped = prev.decorations.map(tr.mapping, tr.doc)
              return { ...next, decorations: mapped }
            }
            return { ...next, decorations: prev.decorations }
          },
        },
        props: {
          decorations: (state) => commentHighlightsKey.getState(state)?.decorations,
          handleClick: (view, _pos, event) => {
            const el = (event.target as HTMLElement).closest<HTMLElement>('[data-thread]')
            if (!el || !view.dom.contains(el)) return false
            // Con texto seleccionado no: se está seleccionando, no abriendo el hilo.
            if (!view.state.selection.empty && view.editable) return false
            options.onActivate(el.dataset.thread as string)
            return false
          },
        },
      }),
    ]
  },
})

/** Cambia lo que se subraya (sin tocar el texto ni el historial). */
export function setHighlights(
  view: { state: { tr: Transaction }; dispatch(tr: Transaction): void },
  meta: Meta,
) {
  view.dispatch(view.state.tr.setMeta(commentHighlightsKey, meta).setMeta('addToHistory', false))
}
