import { describe, expect, it } from 'vitest'
import {
  buildDocs,
  docLink,
  neighbours,
  searchDocs,
  slugOf,
  splitFrontMatter,
} from '../src/lib/docs'
import { makeSlugger, outline, slugify } from '../src/markdown/outline'

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
    expect(docLink('05-notas.md#archivar')).toEqual({ slug: 'notas', hash: 'archivar' })
    expect(docLink('./02-instalacion.md')).toEqual({ slug: 'instalacion', hash: '' })
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
})
