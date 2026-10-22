import { createMemoryStore, createMuninn, type Muninn } from '@muninn/core'

/** El banco de pruebas corre siempre el jueves 22 de octubre de 2026 a las 9:00 en Madrid. */
export const BENCH_NOW = new Date('2026-10-22T07:00:00Z')
export const BENCH_TODAY = '2026-10-22'

/**
 * Datos de ejemplo («Prueba F4»), en memoria: dos proyectos con tareas vencidas, para hoy y en curso; una cuenta
 * corriente y una hucha; tres suscripciones, dos de ellas esta semana.
 */
export async function benchFixture(): Promise<Muninn> {
  let clock = BENCH_NOW
  const store = createMemoryStore(undefined, { now: () => clock.toISOString() })
  const app = createMuninn(store, { now: () => clock, timeZone: 'Europe/Madrid' })

  const muninn = await app.projects.create({ name: 'Muninn' })
  const huginn = await app.projects.create({ name: 'HuginnDB' })
  const col = async (projectId: string, kind: string) =>
    (await app.columns.list(projectId)).find((c) => c.kind === kind)?.id

  await app.tasks.create({
    projectId: muninn.id,
    title: 'Montar el asistente',
    columnId: await col(muninn.id, 'in_progress'),
    dueDate: BENCH_TODAY,
    priority: 'high',
  })
  await app.tasks.create({
    projectId: muninn.id,
    title: 'Escribir el ADR de voz',
    dueDate: '2026-10-21',
  })
  await app.tasks.create({
    projectId: huginn.id,
    title: 'Firma y notarización en macOS',
    dueDate: '2026-10-17',
    priority: 'urgent',
  })
  await app.tasks.create({
    projectId: huginn.id,
    title: 'Exportar resultados a Parquet',
    columnId: await col(huginn.id, 'in_progress'),
    dueDate: '2026-10-24',
  })

  const imagin = await app.finance.accounts.create({
    name: 'Imagin',
    kind: 'checking',
    initialBalance: 120_000,
  })
  await app.finance.accounts.create({ name: 'Hucha', kind: 'savings', goal: 300_000 })
  const ocio = (await app.finance.categories.list({ kind: 'expense' })).find(
    (c) => c.key === 'leisure',
  )
  await app.finance.transactions.create({
    kind: 'expense',
    amount: 1850,
    accountId: imagin.id,
    categoryId: ocio?.id,
    concept: 'Concierto',
    date: '2026-10-05',
  })
  for (const [name, amount, nextDate] of [
    ['Vercel Pro', 2000, '2026-10-23'],
    ['Netflix', 1299, '2026-10-25'],
    ['Spotify', 1099, '2026-11-10'],
  ] as const) {
    await app.finance.subscriptions.create({
      name,
      amount,
      frequency: 'monthly',
      nextDate,
      accountId: imagin.id,
    })
  }
  clock = new Date(BENCH_NOW)
  return app
}
