import { describe, expect, it } from 'vitest'
import { DOC_LANGS, DOC_SLUGS, docSlug } from '../src/lib/doc-slugs'
import type { Doc } from '../src/lib/docs'
import {
  buildDocs,
  docLink,
  groupDocs,
  neighbours,
  searchDocs,
  sections,
  slugOf,
  splitFrontMatter,
} from '../src/lib/docs'
import { makeSlugger, nestOutline, outline, slugify } from '../src/markdown/outline'
import { SETTINGS_SECTIONS } from '../src/screens/ajustes/sections'
import { DOCS } from '../src/screens/docs/content'
import { isDocIcon } from '../src/screens/docs/look'

const file = (title: string, order: number, status: string, body: string) =>
  `---\ntitle: ${title}\ndescription: "Sobre ${title}"\norder: ${order}\nstatus: ${status}\n---\n\n# ${title}\n\n${body}\n`

const FILES = {
  '/x/docs/user/02-instalacion.md': file(
    'Instalación',
    2,
    'parcial',
    'Descarga la app para Windows.',
  ),
  '/x/docs/user/01-bienvenida.md': file(
    'Bienvenida',
    1,
    'disponible',
    'Muninn recuerda **por ti**.',
  ),
  '/x/docs/user/03-notas.md': file(
    'Notas',
    3,
    'proximamente',
    '## Fijar\n\nLas fijadas van arriba.',
  ),
  '/x/docs/user/README.md': '# Índice\n',
}

describe('metadatos', () => {
  it('lee el bloque de arriba y deja el resto', () => {
    const { meta, body } = splitFrontMatter("---\ntitle: Hola: mundo\norder: 3\nx: 'a'\n---\nTexto")
    expect(meta).toEqual({ title: 'Hola: mundo', order: '3', x: 'a' })
    expect(body).toBe('Texto')
  })

  it('sin bloque, todo es texto', () => {
    expect(splitFrontMatter('# Solo texto')).toEqual({ meta: {}, body: '# Solo texto' })
  })

  it('funciona con saltos de línea de Windows', () => {
    expect(splitFrontMatter('---\r\ntitle: A\r\n---\r\ncuerpo').meta.title).toBe('A')
  })
})

describe('guías', () => {
  const docs = buildDocs(FILES)

  it('ordena por `order`, ignora el README y saca el slug del nombre', () => {
    expect(docs.map((d) => d.slug)).toEqual(['bienvenida', 'instalacion', 'notas'])
    expect(docs.map((d) => d.order)).toEqual([1, 2, 3])
    expect(slugOf(String.raw`C:\a\docs\user\05-notas.md`)).toBe('notas')
    expect(slugOf('/x/README.md')).toBeNull()
  })

  it('el estado desconocido cuenta como disponible', () => {
    const [d] = buildDocs({ '/a/01-x.md': file('X', 1, 'raro', 'a') })
    expect(d?.status).toBe('disponible')
    expect(buildDocs(FILES).map((x) => x.status)).toEqual(['disponible', 'parcial', 'proximamente'])
  })

  it('sin título no es una guía', () => {
    expect(buildDocs({ '/a/01-x.md': '---\norder: 1\n---\ntexto' })).toEqual([])
  })

  it('vecinos y enlaces entre guías', () => {
    expect(neighbours(docs, 'instalacion').prev?.slug).toBe('bienvenida')
    expect(neighbours(docs, 'instalacion').next?.slug).toBe('notas')
    expect(neighbours(docs, 'bienvenida').prev).toBeUndefined()
    expect(neighbours(docs, 'nada')).toEqual({})
    expect(docLink('05-notas.md#archivar')).toEqual({ n: '05', hash: 'archivar' })
    expect(docLink('./02-instalacion.md')).toEqual({ n: '02', hash: '' })
    expect(docLink('https://muninn.app/05-notas.md')).toBeNull()
    expect(docLink('ROADMAP.md')).toBeNull()
  })
})

describe('buscador de la ayuda', () => {
  const docs = buildDocs(FILES)

  it('sin texto, todas', () => {
    expect(searchDocs(docs, '  ')).toHaveLength(3)
  })

  it('busca en título, descripción y texto, sin tildes ni mayúsculas', () => {
    expect(searchDocs(docs, 'INSTALACION').map((h) => h.doc.slug)).toEqual(['instalacion'])
    expect(searchDocs(docs, 'windows').map((h) => h.doc.slug)).toEqual(['instalacion'])
    expect(searchDocs(docs, 'por ti').map((h) => h.doc.slug)).toEqual(['bienvenida'])
    expect(searchDocs(docs, 'zzz')).toEqual([])
  })

  it('el trozo enseñado contiene la búsqueda y no lleva marcas de Markdown', () => {
    const [hit] = searchDocs(docs, 'fijadas')
    expect(hit?.snippet).toContain('fijadas van arriba')
    expect(searchDocs(docs, 'recuerda')[0]?.snippet).toContain('recuerda por ti')
  })

  it('primero las que coinciden en el título', () => {
    const more = buildDocs({
      ...FILES,
      '/x/04-otra.md': file('Otra', 4, 'disponible', 'Habla de notas en general.'),
    })
    expect(searchDocs(more, 'notas').map((h) => h.doc.slug)).toEqual(['notas', 'otra'])
  })
})

describe('índice de una guía', () => {
  it('slugify quita tildes y signos', () => {
    expect(slugify('Iniciar sesión')).toBe('iniciar-sesion')
    expect(slugify('¿Qué es «esto»?')).toBe('que-es-esto')
  })

  it('los ids no se repiten', () => {
    const slug = makeSlugger()
    expect([slug('Notas'), slug('Notas'), slug('Notas')]).toEqual(['notas', 'notas-2', 'notas-3'])
  })

  it('lista los títulos de nivel 2 y 3 con el mismo id que pinta el renderizador', () => {
    const md = '# Guía\n\n## Uno\n\ntexto\n\n### Uno.uno **negrita**\n\n#### cuarto\n\n## Uno'
    expect(outline(md)).toEqual([
      { depth: 2, text: 'Uno', id: 'uno' },
      { depth: 3, text: 'Uno.uno negrita', id: 'uno-uno-negrita' },
      { depth: 2, text: 'Uno', id: 'uno-2' },
    ])
  })

  it('cuelga los subapartados de su apartado; uno sin apartado delante va suelto', () => {
    const md = '### Suelto\n\n## Uno\n\n### A\n\n### B\n\n## Dos'
    expect(nestOutline(outline(md))).toEqual([
      { item: { depth: 3, text: 'Suelto', id: 'suelto' }, children: [] },
      {
        item: { depth: 2, text: 'Uno', id: 'uno' },
        children: [
          { depth: 3, text: 'A', id: 'a' },
          { depth: 3, text: 'B', id: 'b' },
        ],
      },
      { item: { depth: 2, text: 'Dos', id: 'dos' }, children: [] },
    ])
  })
})

describe('grupos, iconos y apartados (ADR-0052)', () => {
  const g = (title: string, order: number, group: string, body = 'texto') =>
    `---\ntitle: ${title}\norder: ${order}\ngroup: ${group}\nicon: notes\n---\n\n# ${title}\n\n${body}\n`

  it('ordena por grupo y luego por `order`; un grupo desconocido va al final', () => {
    const docs = buildDocs({
      '/a/01-a.md': g('A', 1, 'modulos'),
      '/a/02-b.md': g('B', 2, 'primeros-pasos'),
      '/a/03-c.md': g('C', 3, 'raro'),
      '/a/04-d.md': g('D', 4, 'primeros-pasos'),
    })
    expect(docs.map((d) => d.slug)).toEqual(['b', 'd', 'a', 'c'])
    expect(docs.map((d) => d.group)).toEqual([
      'primeros-pasos',
      'primeros-pasos',
      'modulos',
      'otras',
    ])
    expect(groupDocs(docs).map((x) => [x.label.es, x.docs.length])).toEqual([
      ['Primeros pasos', 2],
      ['Módulos', 1],
      ['Más guías', 1],
    ])
    expect(neighbours(docs, 'd')).toMatchObject({ prev: { slug: 'b' }, next: { slug: 'a' } })
  })

  it('el texto llega sin el `# Título`, con su icono y los minutos de lectura', () => {
    const [d] = buildDocs({ '/a/01-a.md': g('A', 1, 'cuenta', 'palabra '.repeat(450)) })
    expect(d?.body.startsWith('# A')).toBe(false)
    expect(d?.icon).toBe('notes')
    expect(d?.minutes).toBe(3)
    expect(buildDocs(FILES)[0]?.icon).toBe('docs')
  })

  it('parte el texto por apartados con los mismos ids que el renderizador', () => {
    expect(sections('Intro\n\n## Uno\n\nhola\n\n## Uno\n\nadiós')).toEqual([
      { id: '', title: '', text: 'Intro' },
      { id: 'uno', title: 'Uno', text: 'hola' },
      { id: 'uno-2', title: 'Uno', text: 'adiós' },
    ])
  })

  it('el resultado dice en qué apartado está', () => {
    const docs = buildDocs({
      '/a/01-a.md': g(
        'A',
        1,
        'cuenta',
        '## Cuentas\n\nEl saldo se calcula.\n\n## Archivar\n\nArchivar una cuenta guarda su saldo.',
      ),
    })
    expect(searchDocs(docs, 'archivar saldo')[0]?.section).toEqual({
      id: 'archivar',
      title: 'Archivar',
    })
    expect(searchDocs(docs, 'calcula')[0]?.section?.id).toBe('cuentas')
    expect(searchDocs(docs, 'calcula')[0]?.snippet).toContain('saldo se calcula')
  })
})

describe('las guías de docs/user', () => {
  it('tienen un icono que existe y un grupo conocido', () => {
    for (const lang of DOC_LANGS) {
      expect(DOCS[lang].length).toBeGreaterThan(5)
      for (const d of DOCS[lang]) {
        expect(isDocIcon(d.icon), `${lang}/${d.slug}: icono «${d.icon}»`).toBe(true)
        expect(d.group, `${lang}/${d.slug}: falta \`group\``).not.toBe('otras')
      }
    }
  })

  it('están en los dos idiomas, con los mismos metadatos y los slugs de lib/doc-slugs', () => {
    const keys = Object.keys(DOC_SLUGS).sort()
    for (const lang of DOC_LANGS) {
      expect(DOCS[lang].map((d) => d.key).sort(), lang).toEqual(keys)
      for (const d of DOCS[lang])
        expect(d.key && docSlug(d.key, lang), `${lang}/${d.n}`).toBe(d.slug)
    }
    const pick = (d?: Doc) =>
      d && { order: d.order, status: d.status, group: d.group, icon: d.icon }
    for (const es of DOCS.es) {
      const en = DOCS.en.find((d) => d.n === es.n)
      expect(pick(en), `guía ${es.n}`).toEqual(pick(es))
      expect(
        sections(en?.body ?? '').filter((p) => p.id).length,
        `apartados de la guía ${es.n}`,
      ).toBe(sections(es.body).filter((p) => p.id).length)
    }
  })

  it('enlazan a guías y apartados que existen en su idioma', () => {
    for (const lang of DOC_LANGS) {
      const ids = new Map(DOCS[lang].map((d) => [d.n, new Set(sections(d.body).map((p) => p.id))]))
      for (const d of DOCS[lang]) {
        for (const [, href = ''] of d.body.matchAll(/\]\(([^)\s]+)\)/g)) {
          const where = `${lang}/${d.slug} → ${href}`
          const link = href.startsWith('#') ? { n: d.n, hash: href.slice(1) } : docLink(href)
          if (!link) continue
          expect(ids.has(link.n), where).toBe(true)
          if (link.hash) {
            expect(ids.get(link.n)?.has(slugify(decodeURIComponent(link.hash))), where).toBe(true)
          }
        }
      }
    }
  })
})

describe('enlaces de la app a la ayuda', () => {
  it('las secciones de Ajustes llevan a guías y apartados que existen en cada idioma', () => {
    for (const s of SETTINGS_SECTIONS) {
      if (!s.doc) continue
      for (const lang of DOC_LANGS) {
        const doc = DOCS[lang].find((d) => d.key === s.doc?.key)
        expect(doc, `${s.id} (${lang})`).toBeDefined()
        const hash = typeof s.doc.hash === 'string' ? s.doc.hash : s.doc.hash?.[lang]
        if (hash) {
          expect(
            sections(doc?.body ?? '').map((p) => p.id),
            `${s.id} (${lang})`,
          ).toContain(hash)
        }
      }
    }
  })
})
