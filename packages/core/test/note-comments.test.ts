import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryStore, createMuninn, threads, ValidationError, withActor } from '../src'

// Comentarios en las notas (ADR-0079).

let clock = new Date('2026-11-06T10:00:00Z')
const setup = () => {
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  return { store, app: createMuninn(store, { now: () => clock, timeZone: 'UTC' }) }
}
const tick = () => {
  clock = new Date(clock.getTime() + 1000)
}

beforeEach(() => {
  clock = new Date('2026-11-06T10:00:00Z')
})

const CONTENT = '# Plan\n\nEl **corte** de la 0.11 es el 27-11.\n\n- revisar el corte\n- publicar'

describe('comentarios', () => {
  it('abre un hilo sobre una cita del texto visible (sin marcas de Markdown)', async () => {
    const { app } = setup()
    const note = await app.notes.create({ title: 'Plan', content: CONTENT })
    const c = await app.comments.create({
      noteId: note.id,
      quote: 'corte de la 0.11',
      body: '¿Se mueve?',
      forAgent: true,
    })
    expect(c).toMatchObject({
      noteId: note.id,
      parentId: null,
      body: '¿Se mueve?',
      forAgent: true,
      orphaned: false,
      resolvedAt: null,
      actor: 'user',
    })
    expect(c.anchor).toMatchObject({ quote: 'corte de la 0.11', prefix: 'Plan\nEl ' })
    // El Markdown de la nota no cambia.
    expect((await app.notes.get(note.id)).content).toBe(CONTENT)
  })

  it('rechaza una cita que no está y desempata con occurrence o con el contexto', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    await expect(
      app.comments.create({ noteId: note.id, quote: 'no existe', body: 'x' }),
    ).rejects.toBeInstanceOf(ValidationError)
    const second = await app.comments.create({
      noteId: note.id,
      quote: 'corte',
      occurrence: 2,
      body: 'el de la lista',
    })
    expect(second.anchor?.prefix.endsWith('revisar el ')).toBe(true)
    const byContext = await app.comments.create({
      noteId: note.id,
      quote: 'corte',
      prefix: 'revisar el ',
      body: 'también',
    })
    expect(byContext.anchor?.start).toBe(second.anchor?.start)
  })

  it('responde, resuelve y reabre; list filtra por estado y por «Para Claude»', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    const a = await app.comments.create({
      noteId: note.id,
      quote: 'Plan',
      body: 'a',
      forAgent: true,
    })
    tick()
    const b = await app.comments.create({ noteId: note.id, quote: 'publicar', body: 'b' })
    tick()
    const claude = withActor(app, 'mcp')
    const r = await claude.comments.reply({ threadId: a.id, body: 'Hecho' })
    expect(r).toMatchObject({ parentId: a.id, actor: 'mcp', anchor: null })
    // Una respuesta como threadId cuelga del mismo hilo.
    tick()
    const r2 = await app.comments.reply({ threadId: r.id, body: 'Gracias' })
    expect(r2.parentId).toBe(a.id)

    const resolved = await claude.comments.resolve(a.id)
    expect(resolved).toMatchObject({ resolvedBy: 'mcp' })
    expect(resolved.resolvedAt).not.toBeNull()
    await expect(app.comments.resolve(r.id)).rejects.toBeInstanceOf(ValidationError)

    const open = await app.comments.list({ noteId: note.id })
    expect(open.map((c) => c.id)).toEqual([b.id])
    const all = await app.comments.list({ noteId: note.id, status: 'all' })
    expect(all.map((c) => c.id)).toEqual([a.id, b.id, r.id, r2.id])
    expect(threads(all).map((t) => [t.root.id, t.replies.map((x) => x.id)])).toEqual([
      [a.id, [r.id, r2.id]],
      [b.id, []],
    ])
    expect(
      (await app.comments.list({ status: 'resolved', forAgent: true })).map((c) => c.id),
    ).toEqual([a.id, r.id, r2.id])

    const reopened = await app.comments.reopen(a.id)
    expect(reopened).toMatchObject({ resolvedAt: null, resolvedBy: null })
    expect((await app.comments.list({ forAgent: true })).map((c) => c.id)).toEqual([
      a.id,
      r.id,
      r2.id,
    ])
  })

  it('archivar un hilo se lleva sus respuestas; restaurar las devuelve', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    const a = await app.comments.create({ noteId: note.id, quote: 'Plan', body: 'a' })
    tick()
    const loose = await app.comments.reply({ threadId: a.id, body: 'archivada antes' })
    await app.comments.archive(loose.id)
    tick()
    const r = await app.comments.reply({ threadId: a.id, body: 'r' })
    tick()
    await app.comments.archive(a.id)
    expect(await app.comments.list({ noteId: note.id, status: 'all' })).toEqual([])
    await expect(app.comments.reply({ threadId: a.id, body: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    )
    await app.comments.restore(a.id)
    // La que ya estaba archivada sigue archivada.
    expect((await app.comments.list({ noteId: note.id })).map((c) => c.id)).toEqual([a.id, r.id])
  })

  it('edita el texto de un comentario', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    const a = await app.comments.create({ noteId: note.id, quote: 'Plan', body: 'a' })
    expect((await app.comments.edit(a.id, { body: '  b  ' })).body).toBe('b')
  })

  it('no comenta notas archivadas', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    await app.notes.archive(note.id)
    await expect(
      app.comments.create({ noteId: note.id, quote: 'Plan', body: 'a' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('registra la actividad de la nota', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    const a = await app.comments.create({ noteId: note.id, quote: 'Plan', body: 'a' })
    await app.comments.reply({ threadId: a.id, body: 'r' })
    await app.comments.resolve(a.id)
    await app.comments.reopen(a.id)
    const actions = (await app.recentActivity({ limit: 10 }))
      .filter((x) => x.entityId === note.id)
      .map((x) => x.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'commented',
        'comment_replied',
        'comment_resolved',
        'comment_reopened',
      ]),
    )
  })
})

describe('reanclaje al cambiar la nota', () => {
  it('un cambio antes desplaza el ancla; uno que borra la cita la deja sin sitio; si vuelve, se reancla', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: CONTENT })
    const c = await app.comments.create({ noteId: note.id, quote: 'revisar el corte', body: 'a' })
    const start = c.anchor?.start as number

    // Cambio antes (lo hace Claude por el MCP: el core reancla igual).
    const claude = withActor(app, 'mcp')
    await claude.notes.update(note.id, { content: `Intro nueva.\n\n${CONTENT}` })
    let [now] = await app.comments.list({ noteId: note.id })
    expect(now?.orphaned).toBe(false)
    expect(now?.anchor?.start).toBe(start + 'Intro nueva.\n'.length)
    expect(now?.anchor?.quote).toBe('revisar el corte')

    // La cita desaparece.
    await app.notes.update(note.id, { content: '# Plan\n\nOtra cosa.' })
    ;[now] = await app.comments.list({ noteId: note.id })
    expect(now?.orphaned).toBe(true)
    // El ancla vieja se conserva.
    expect(now?.anchor?.quote).toBe('revisar el corte')

    // Vuelve (un «Deshacer»).
    await app.notes.update(note.id, { content: CONTENT })
    ;[now] = await app.comments.list({ noteId: note.id })
    expect(now?.orphaned).toBe(false)
    expect(now?.anchor?.start).toBe(start)
  })

  it('reancla también los resueltos, y no toca los comentarios si solo cambia el título', async () => {
    const { app, store } = setup()
    const note = await app.notes.create({ content: CONTENT })
    const c = await app.comments.create({ noteId: note.id, quote: 'publicar', body: 'a' })
    await app.comments.resolve(c.id)
    tick()
    await app.notes.update(note.id, { title: 'Otro título' })
    expect((await store.noteComments.get(c.id))?.updatedAt).toBe(
      (await store.noteComments.get(c.id))?.createdAt,
    )
    await app.notes.update(note.id, { content: `Arriba.\n\n${CONTENT}` })
    const after = await store.noteComments.get(c.id)
    expect(after?.anchor?.start).toBe((c.anchor?.start as number) + 'Arriba.\n'.length)
    expect(after?.resolvedAt).not.toBeNull()
  })

  it('una errata corregida dentro de la cita actualiza la cita', async () => {
    const { app } = setup()
    const note = await app.notes.create({ content: 'Hay que revisr el corte antes del viernes.' })
    const c = await app.comments.create({ noteId: note.id, quote: 'revisr el corte', body: 'a' })
    await app.notes.update(note.id, { content: 'Hay que revisar el corte antes del viernes.' })
    const [now] = await app.comments.list({ noteId: note.id })
    expect(now?.id).toBe(c.id)
    expect(now?.orphaned).toBe(false)
    expect(now?.anchor?.quote).toContain('revisar el corte')
  })
})
