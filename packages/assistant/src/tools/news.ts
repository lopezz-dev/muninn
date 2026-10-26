import { relatedProjects } from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool } from './define'

/** Noticias (ADR-0042): solo lectura. Las fuentes se eligen en la app; el modelo no descarga ni borra nada. */
export const newsTools: AnyTool[] = [
  defineTool({
    name: 'list_news',
    title: 'Noticias',
    description:
      'Artículos de las fuentes RSS del usuario, del más reciente al más antiguo, con su fuente y los proyectos con los que tienen que ver. Úsalo para "¿qué hay de nuevo sobre X?".',
    input: {
      topic: z.string().optional().describe('Tema de la fuente («Rust», «IA local»…)'),
      search: z.string().optional().describe('Texto en el título o el resumen'),
      sinceHours: z
        .number()
        .int()
        .min(1)
        .max(720)
        .optional()
        .describe('Solo las de las últimas N horas'),
      saved: z.boolean().optional().describe('Solo las guardadas'),
      limit: z.number().int().min(1).max(50).optional(),
    },
    access: 'read',
    module: 'news',
    detail: (a) => a.search ?? a.topic,
    run: async ({ app }, { sinceHours, limit, ...rest }) => {
      const [items, sources, projects] = await Promise.all([
        app.news.items.list({
          ...rest,
          since: sinceHours
            ? new Date(Date.now() - sinceHours * 3_600_000).toISOString()
            : undefined,
          limit: limit ?? 20,
        }),
        app.news.sources.list(),
        app.projects.list(),
      ])
      const sourceName = new Map(sources.map((s) => [s.id, s.title]))
      return items.map((i) => ({
        id: i.id,
        title: i.title,
        summary: i.summary,
        url: i.url,
        source: sourceName.get(i.sourceId) ?? null,
        publishedAt: i.publishedAt,
        saved: Boolean(i.savedAt),
        relatedProjects: relatedProjects(i, projects).map((p) => p.name),
      }))
    },
  }),
  defineTool({
    name: 'news_digest',
    title: 'Resumen de noticias del día',
    description:
      'El resumen de noticias de hoy (o de la fecha AAAA-MM-DD que digas), generado en el ordenador del usuario. null si aún no hay.',
    input: { date: z.iso.date().optional() },
    access: 'read',
    module: 'news',
    run: ({ app }, { date }) => app.news.digests.get(date),
  }),
]
