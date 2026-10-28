import { type NewsItem, type NewsSource, type Project, relatedProjects } from '@muninn/core'
import { spokenDate } from './prompt'
import type { ChatProvider } from './provider'

/** Artículos que entran en el resumen como mucho: con más, un modelo de 8B se dispersa y tarda. */
export const DIGEST_MAX_ITEMS = 25

export interface DigestInput {
  provider: ChatProvider
  items: NewsItem[]
  sources: Pick<NewsSource, 'id' | 'title'>[]
  projects: Pick<Project, 'id' | 'name'>[]
  today: string
  signal?: AbortSignal
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Lo que ve el modelo: un artículo por línea, con su fuente y sus proyectos relacionados. */
export function digestPrompt({ items, sources, projects, today }: Omit<DigestInput, 'provider'>) {
  const source = new Map(sources.map((s) => [s.id, s.title]))
  const lines = items.slice(0, DIGEST_MAX_ITEMS).map((i, n) => {
    const related = relatedProjects(i, projects).map((p) => p.name)
    return `${n + 1}. [${source.get(i.sourceId) ?? 'Fuente'}] ${clip(i.title, 160)}${i.summary ? ` — ${clip(i.summary, 220)}` : ''}${related.length ? ` (relacionada con ${related.join(', ')})` : ''}`
  })
  return [
    {
      role: 'system' as const,
      content: [
        'Eres Muninn, el asistente personal del usuario. Resume sus noticias del día en español, de tú.',
        `Hoy es ${spokenDate(today)}. Sus proyectos: ${projects.map((p) => p.name).join(', ') || '(ninguno)'}.`,
        'Escribe entre 3 y 5 viñetas en Markdown («- …»), de una o dos frases cada una, con lo más importante primero.',
        'Destaca en **negrita** el tema de cada viñeta. Menciona cuándo algo tiene que ver con uno de sus proyectos.',
        'Agrupa lo parecido. Si algo no tiene relación con sus proyectos, júntalo en una última viñeta corta.',
        'No inventes nada que no esté en la lista. Sin títulos ni introducción: solo las viñetas.',
      ].join('\n'),
    },
    { role: 'user' as const, content: `Noticias de hoy:\n${lines.join('\n')}` },
  ]
}

/** Quita el razonamiento que algunos modelos devuelven en el texto (`<think>…</think>`) y los espacios de más. */
export function cleanDigest(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Resumen diario de noticias (ADR-0042), con el modelo local y sin herramientas. Devuelve `null` si no hay artículos:
 * no se llama al modelo para nada.
 */
export async function generateDigest(
  input: DigestInput,
): Promise<{ content: string; itemIds: string[] } | null> {
  const items = input.items.slice(0, DIGEST_MAX_ITEMS)
  if (!items.length) return null
  let text = ''
  for await (const chunk of input.provider.chat({
    messages: digestPrompt({ ...input, items }),
    signal: input.signal,
  })) {
    if (chunk.type === 'text') text += chunk.text
  }
  const content = cleanDigest(text)
  if (!content) return null
  return { content: content.slice(0, 8000), itemIds: items.map((i) => i.id) }
}
