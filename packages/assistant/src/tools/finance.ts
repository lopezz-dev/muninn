import {
  type AccountWithBalance,
  accountKind,
  type CategoryKind,
  categoryKind,
  centsFromEuros,
  type FinanceCategory,
  financeColor,
  formatEuros,
  type Muninn,
  monthlyCost,
  type Subscription,
  subscriptionFrequency,
  type Transaction,
  transactionKind,
  ValidationError,
} from '@muninn/core'
import { z } from 'zod'
import { type AnyTool, defineTool, pickByName } from './define'
import { isoDate, limit } from './shapes'

const euros = z
  .union([z.string().min(1), z.number()])
  .describe('Importe en euros, positivo: 24.9, "24,90" o "1.284,30"')
const signedEuros = z
  .union([z.string().min(1), z.number()])
  .describe('Euros; puede ser negativo (una cuenta que empieza en descubierto)')
const accountRef = z
  .string()
  .min(1)
  .describe('Id de la cuenta o su nombre (no distingue mayúsculas)')
const categoryRef = z.string().min(1).describe('Id de la categoría o su nombre')
const subscriptionRef = z.string().min(1).describe('Id o nombre de la suscripción')
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe('Mes AAAA-MM')

const finance = { kind: 'finance' as const }

/** Euros con signo → céntimos (`centsFromEuros` solo admite positivos). */
function signedCents(value: string | number) {
  const text = String(value).trim()
  const negative = text.startsWith('-') || text.startsWith('−')
  const abs = text.replace(/^[-−]/, '')
  if (/^0+([.,]0+)?$/.test(abs)) return 0
  const cents = centsFromEuros(typeof value === 'number' ? Math.abs(value) : abs)
  return negative ? -cents : cents
}

/**
 * Cuentas y categorías de una llamada, leídas como mucho una vez cada una: resolver la cuenta, la de destino y la
 * categoría y luego nombrarlas en la salida eran hasta cinco lecturas seguidas (cada una, un viaje de red con Supabase).
 * Se crea uno por llamada a una herramienta, justo antes de escribir: no guarda nada entre llamadas.
 */
function financeLookup(app: Muninn) {
  let accounts: Promise<AccountWithBalance[]> | undefined
  let categories: Promise<FinanceCategory[]> | undefined
  const allAccounts = () => {
    if (!accounts) accounts = app.finance.accounts.list({ includeArchived: true })
    return accounts
  }
  const allCategories = () => {
    if (!categories) categories = app.finance.categories.list({ includeArchived: true })
    return categories
  }

  async function account(ref: string) {
    const all = await allAccounts()
    return pickByName(
      all,
      ref,
      () =>
        `No hay ninguna cuenta "${ref}". Cuentas: ${all.map((a) => `${a.name} (${a.kind})`).join(', ') || '(ninguna: créala con create_finance_account)'}`,
    )
  }

  /** La cuenta indicada o, sin ella, la de por defecto de un gasto o ingreso: la primera corriente sin archivar. */
  async function accountOrDefault(ref: string | undefined) {
    if (ref) return account(ref)
    const open = (await allAccounts()).filter((a) => !a.archivedAt)
    const found = open.find((a) => a.kind === 'checking') ?? open[0]
    if (!found) throw new ValidationError('No hay cuentas: crea una con create_finance_account')
    return found
  }

  /** Con `kind`, gana una categoría de ese tipo si hay dos con el mismo nombre. */
  async function category(ref: string, kind?: CategoryKind) {
    const all = await allCategories()
    const ordered = kind
      ? [...all.filter((c) => c.kind === kind), ...all.filter((c) => c.kind !== kind)]
      : all
    return pickByName(ordered, ref, () => {
      const options = all.filter((c) => !c.archivedAt && (!kind || c.kind === kind))
      return `No hay ninguna categoría "${ref}". Categorías: ${options.map((c) => c.name).join(', ')}`
    })
  }

  /** Movimientos con los nombres de cuenta y categoría, para que el modelo no tenga que cruzarlos. */
  async function out(rows: Transaction[]) {
    const [accountRows, categoryRows] = await Promise.all([allAccounts(), allCategories()])
    const accountName = new Map(accountRows.map((a) => [a.id, a.name]))
    const categoryName = new Map(categoryRows.map((c) => [c.id, c.name]))
    return rows.map((t) => ({
      ...t,
      amountText: formatEuros(t.amount),
      account: accountName.get(t.accountId) ?? null,
      toAccount: t.toAccountId ? (accountName.get(t.toAccountId) ?? null) : null,
      category: t.categoryId ? (categoryName.get(t.categoryId) ?? null) : null,
    }))
  }

  return { account, accountOrDefault, category, out }
}

async function resolveSubscription(app: Muninn, ref: string) {
  const all = await app.finance.subscriptions.list({ includeArchived: true })
  return pickByName(
    all,
    ref,
    () =>
      `No hay ninguna suscripción "${ref}". Suscripciones: ${all.map((x) => x.name).join(', ') || '(ninguna)'}`,
  )
}

const accountOut = (a: AccountWithBalance) => ({
  ...a,
  balanceText: formatEuros(a.balance),
  initialBalanceText: formatEuros(a.initialBalance),
})

const subscriptionOut = (x: Subscription) => ({
  ...x,
  amountText: formatEuros(x.amount),
  monthlyCostText: formatEuros(monthlyCost(x)),
})

const kindName = { expense: 'Gasto', income: 'Ingreso', transfer: 'Traspaso' } as const

/**
 * Finanzas (ADR-0037, ADR-0038, ADR-0039). Los importes entran en euros y salen en céntimos (`amount`, `balance`) y con
 * texto (`amountText`, `balanceText`). No hay borrados: como mucho, archivar.
 */
export const financeTools: AnyTool[] = [
  // ─── Lectura ────────────────────────────────────────────────────────────────
  defineTool({
    name: 'list_finance_accounts',
    title: 'Cuentas y saldos',
    description:
      'Cuentas (corriente, ahorro, inversión, efectivo…) con su saldo actual, derivado de los movimientos. Úsalo para "¿cuánto tengo?".',
    input: { includeArchived: z.boolean().optional() },
    access: 'read',
    module: 'finance',
    run: async ({ app }, { includeArchived }) =>
      (await app.finance.accounts.list({ includeArchived })).map(accountOut),
  }),
  defineTool({
    name: 'list_finance_categories',
    title: 'Categorías de gastos e ingresos',
    description: 'Categorías disponibles para apuntar gastos (expense) e ingresos (income).',
    input: { kind: categoryKind.optional() },
    access: 'read',
    module: 'finance',
    run: ({ app }, { kind }) => app.finance.categories.list({ kind }),
  }),
  defineTool({
    name: 'list_transactions',
    title: 'Buscar movimientos',
    description:
      'Movimientos (gastos, ingresos y traspasos) del más reciente al más antiguo, con filtros. Los importes van en céntimos (amount) y como texto (amountText).',
    input: {
      account: accountRef
        .optional()
        .describe('Los de esta cuenta y los traspasos que llegan a ella'),
      category: categoryRef.optional(),
      kinds: z.array(transactionKind).optional(),
      month: month.optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      search: z.string().optional().describe('Palabras en el concepto, en cualquier orden'),
      limit: limit(500),
    },
    access: 'read',
    module: 'finance',
    detail: (a) => a.category ?? a.month ?? a.search,
    run: async ({ app }, { account, category, ...rest }) => {
      const lookup = financeLookup(app)
      const [from, cat] = await Promise.all([
        account ? lookup.account(account) : undefined,
        category ? lookup.category(category) : undefined,
      ])
      return lookup.out(
        await app.finance.transactions.list({
          ...rest,
          accountId: from?.id,
          categoryId: cat?.id,
          limit: rest.limit ?? 100,
        }),
      )
    },
  }),
  defineTool({
    name: 'finance_month_report',
    title: 'Panel mensual de finanzas',
    description:
      'Entradas, salidas, ahorro, inversión, lo que queda libre y tasa de ahorro ((ingresos − gastos) / ingresos) de un mes, con el mes anterior, el gasto por categoría y el histórico de los últimos meses. Úsalo para "¿cómo voy este mes?". Céntimos y texto.',
    input: {
      month: month.optional().describe('Mes AAAA-MM; por defecto, el actual'),
      months: z.number().int().min(2).max(24).optional().describe('Meses de histórico; 6'),
    },
    access: 'read',
    module: 'finance',
    detail: (a) => a.month,
    run: async ({ app }, { month: m, months }) => {
      const r = await app.finance.report.month(m ?? app.today().slice(0, 7), { months })
      const text = (n: number) => formatEuros(n)
      return {
        ...r,
        text: {
          income: text(r.income),
          expenses: text(r.expenses),
          savings: text(r.savings),
          investment: text(r.investment),
          free: text(r.free),
          savingsRate: r.savingsRate === null ? null : `${Math.round(r.savingsRate * 100)} %`,
        },
        byCategory: r.byCategory.map((c) => ({ ...c, amountText: text(c.amount) })),
      }
    },
  }),

  // ─── Escritura ──────────────────────────────────────────────────────────────
  defineTool({
    name: 'create_transaction',
    title: 'Apuntar movimiento',
    description:
      'Apunta un gasto, un ingreso o un traspaso entre cuentas. Ahorrar o invertir es un traspaso a la cuenta de ahorro o inversión. Sin cuenta, va a la primera cuenta corriente; sin fecha, hoy.',
    input: {
      kind: transactionKind.describe('expense (gasto), income (ingreso) o transfer (traspaso)'),
      amount: euros,
      account: accountRef
        .optional()
        .describe('Cuenta de la que sale (o a la que entra un ingreso)'),
      toAccount: accountRef.optional().describe('Solo en traspasos: cuenta de destino'),
      category: categoryRef.optional().describe('Solo en gastos e ingresos'),
      date: isoDate.optional(),
      concept: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
    },
    access: 'write',
    module: 'finance',
    detail: (a) => `${a.amount} €${a.concept ? ` · ${a.concept}` : ''}`,
    run: async ({ app, changed }, { kind, amount, account, toAccount, category, ...rest }) => {
      const lookup = financeLookup(app)
      const [from, to, cat] = await Promise.all([
        lookup.accountOrDefault(account),
        toAccount ? lookup.account(toAccount) : undefined,
        category && kind !== 'transfer' ? lookup.category(category, kind) : undefined,
      ])
      const tx = await app.finance.transactions.create({
        ...rest,
        kind,
        amount: centsFromEuros(amount),
        accountId: from.id,
        toAccountId: to?.id,
        categoryId: cat?.id,
      })
      const [out] = await lookup.out([tx])
      changed({
        summary: `${kindName[kind]} de ${formatEuros(tx.amount)} apuntado${tx.concept ? ` («${tx.concept}»)` : ''} en ${from.name}`,
        undo: (m) => m.finance.transactions.archive(tx.id),
        target: finance,
      })
      return out
    },
  }),
  defineTool({
    name: 'update_transaction',
    title: 'Editar movimiento',
    description:
      'Cambia tipo, importe, cuentas, categoría, fecha, concepto o nota de un movimiento. category: null la quita.',
    input: {
      transactionId: z.uuid(),
      kind: transactionKind.optional(),
      amount: euros.optional(),
      account: accountRef.optional(),
      toAccount: accountRef.optional(),
      category: categoryRef.nullable().optional(),
      date: isoDate.optional(),
      concept: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
    },
    access: 'write',
    module: 'finance',
    run: async (
      { app, changed },
      { transactionId, amount, account, toAccount, category, ...rest },
    ) => {
      const lookup = financeLookup(app)
      const before = await app.finance.transactions.get(transactionId)
      const kind = rest.kind ?? before.kind
      const [from, to, cat] = await Promise.all([
        account ? lookup.account(account) : undefined,
        toAccount ? lookup.account(toAccount) : undefined,
        category && kind !== 'transfer' ? lookup.category(category, kind) : undefined,
      ])
      const tx = await app.finance.transactions.update(transactionId, {
        ...rest,
        amount: amount === undefined ? undefined : centsFromEuros(amount),
        accountId: from?.id,
        toAccountId: to?.id,
        categoryId: category === null ? null : cat?.id,
      })
      changed({
        summary: `Movimiento de ${formatEuros(tx.amount)} editado`,
        undo: (m) =>
          m.finance.transactions.update(transactionId, {
            kind: before.kind,
            amount: before.amount,
            accountId: before.accountId,
            toAccountId: before.toAccountId,
            categoryId: before.categoryId,
            date: before.date,
            concept: before.concept,
            note: before.note,
          }),
        target: finance,
      })
      return (await lookup.out([tx]))[0]
    },
  }),
  defineTool({
    name: 'archive_transaction',
    title: 'Archivar movimiento',
    description: 'Archiva un movimiento: deja de contar en saldos e informes. No se borra.',
    input: { transactionId: z.uuid() },
    access: 'write',
    idempotent: true,
    module: 'finance',
    run: async ({ app, changed }, { transactionId }) => {
      const tx = await app.finance.transactions.archive(transactionId)
      changed({
        summary: `Movimiento de ${formatEuros(tx.amount)} archivado`,
        undo: (m) => m.finance.transactions.restore(transactionId),
        target: finance,
      })
      return tx
    },
  }),
  defineTool({
    name: 'create_finance_account',
    title: 'Crear cuenta',
    description:
      'Crea una cuenta: checking (corriente), savings (ahorro, hucha), investment (inversión), cash (efectivo) u other.',
    input: {
      name: z.string().min(1).max(80),
      kind: accountKind,
      initialBalance: signedEuros.optional().describe('Saldo con el que empieza, en euros'),
      goal: euros.optional().describe('Objetivo de una hucha, en euros'),
      color: financeColor.optional(),
    },
    access: 'write',
    module: 'finance',
    detail: (a) => a.name,
    run: async ({ app, changed }, { initialBalance, goal, ...rest }) => {
      const a = await app.finance.accounts.create({
        ...rest,
        initialBalance: initialBalance === undefined ? undefined : signedCents(initialBalance),
        goal: goal === undefined ? undefined : centsFromEuros(goal),
      })
      changed({
        summary: `Cuenta «${a.name}» creada`,
        undo: (m) => m.finance.accounts.archive(a.id),
        target: finance,
      })
      return accountOut(a)
    },
  }),
  defineTool({
    name: 'update_finance_account',
    title: 'Editar cuenta',
    description:
      'Cambia nombre, tipo, saldo inicial, objetivo o color de una cuenta. goal: null lo quita.',
    input: {
      account: accountRef,
      name: z.string().min(1).max(80).optional(),
      kind: accountKind.optional(),
      initialBalance: signedEuros.optional(),
      goal: euros.nullable().optional(),
      color: financeColor.optional(),
    },
    access: 'write',
    module: 'finance',
    detail: (a) => a.account,
    run: async ({ app, changed }, { account, initialBalance, goal, ...rest }) => {
      const before = await financeLookup(app).account(account)
      const a = await app.finance.accounts.update(before.id, {
        ...rest,
        initialBalance: initialBalance === undefined ? undefined : signedCents(initialBalance),
        goal: goal === undefined ? undefined : goal === null ? null : centsFromEuros(goal),
      })
      changed({
        summary: `Cuenta «${a.name}» editada`,
        undo: (m) =>
          m.finance.accounts.update(before.id, {
            name: before.name,
            kind: before.kind,
            initialBalance: before.initialBalance,
            goal: before.goal,
            color: financeColor.safeParse(before.color).data,
          }),
        target: finance,
      })
      return accountOut(a)
    },
  }),
  defineTool({
    name: 'archive_finance_account',
    title: 'Archivar cuenta',
    description:
      'Archiva una cuenta: deja de verse, pero sus movimientos se conservan. No se borra.',
    input: { account: accountRef },
    access: 'write',
    idempotent: true,
    module: 'finance',
    detail: (a) => a.account,
    run: async ({ app, changed }, { account }) => {
      const a = await app.finance.accounts.archive((await financeLookup(app).account(account)).id)
      changed({
        summary: `Cuenta «${a.name}» archivada`,
        undo: (m) => m.finance.accounts.restore(a.id),
        target: finance,
      })
      return accountOut(a)
    },
  }),
  defineTool({
    name: 'create_finance_category',
    title: 'Crear categoría',
    description: 'Crea una categoría propia de gastos (expense) o de ingresos (income).',
    input: {
      name: z.string().min(1).max(60),
      kind: categoryKind,
      color: financeColor.optional(),
    },
    access: 'write',
    module: 'finance',
    detail: (a) => a.name,
    run: async ({ app, changed }, input) => {
      const c = await app.finance.categories.create(input)
      changed({
        summary: `Categoría «${c.name}» creada`,
        undo: (m) => m.finance.categories.archive(c.id),
        target: finance,
      })
      return c
    },
  }),

  // ─── Suscripciones (ADR-0038) ───────────────────────────────────────────────
  defineTool({
    name: 'list_subscriptions',
    title: 'Suscripciones',
    description:
      'Suscripciones con su próximo cobro (nextDate) y lo que cuestan al mes. Con upcomingDays, solo las que vencen en esos días (y las ya vencidas). Muninn no cobra solo: avisa, y el cobro se apunta con record_subscription_charge.',
    input: {
      upcomingDays: z.number().int().min(0).max(366).optional(),
      includeArchived: z.boolean().optional(),
    },
    access: 'read',
    module: 'finance',
    detail: (a) => (a.upcomingDays === undefined ? undefined : `${a.upcomingDays} días`),
    run: async ({ app }, { upcomingDays, includeArchived }) =>
      (upcomingDays === undefined
        ? await app.finance.subscriptions.list({ includeArchived })
        : await app.finance.subscriptions.upcoming({ days: upcomingDays })
      ).map(subscriptionOut),
  }),
  defineTool({
    name: 'create_subscription',
    title: 'Crear suscripción',
    description:
      'Crea una suscripción recurrente (weekly, monthly, yearly) con su próximo cobro. Sin cuenta, la primera cuenta corriente; sin categoría, Suscripciones.',
    input: {
      name: z.string().min(1).max(80),
      amount: euros,
      frequency: subscriptionFrequency,
      nextDate: isoDate.describe('Próximo cobro AAAA-MM-DD'),
      account: accountRef.optional(),
      category: categoryRef.optional(),
      remindDays: z
        .number()
        .int()
        .min(0)
        .max(30)
        .optional()
        .describe('Días de aviso; 3 por defecto'),
    },
    access: 'write',
    module: 'finance',
    detail: (a) => a.name,
    run: async ({ app, changed }, { amount, account, category, ...rest }) => {
      const lookup = financeLookup(app)
      const [from, categoryId] = await Promise.all([
        lookup.accountOrDefault(account),
        category
          ? lookup.category(category, 'expense').then((c) => c.id)
          : app.finance.categories
              .list({ kind: 'expense' })
              .then((all) => all.find((c) => c.key === 'subscriptions')?.id),
      ])
      const sub = await app.finance.subscriptions.create({
        ...rest,
        amount: centsFromEuros(amount),
        accountId: from.id,
        categoryId,
      })
      changed({
        summary: `Suscripción «${sub.name}» creada`,
        undo: (m) => m.finance.subscriptions.archive(sub.id),
        target: finance,
      })
      return subscriptionOut(sub)
    },
  }),
  defineTool({
    name: 'record_subscription_charge',
    title: 'Apuntar cobro de suscripción',
    description:
      'Apunta el próximo cobro de una suscripción como gasto (con su importe o el que digas) y adelanta la fecha un periodo. No apunta dos veces el mismo cobro.',
    input: {
      subscription: subscriptionRef,
      amount: euros.optional().describe('Si esta vez cobraron otra cantidad'),
    },
    access: 'write',
    module: 'finance',
    detail: (a) => a.subscription,
    run: async ({ app, changed }, { subscription, amount }) => {
      const sub = await resolveSubscription(app, subscription)
      const res = await app.finance.subscriptions.charge(sub.id, {
        expected: sub.nextDate,
        amount: amount === undefined ? undefined : centsFromEuros(amount),
      })
      changed({
        summary: `Cobro de «${sub.name}» apuntado (${formatEuros(res.transaction.amount)})`,
        undo: (m) =>
          m.finance.subscriptions.revert(sub.id, {
            previousDate: sub.nextDate,
            transactionId: res.transaction.id,
          }),
        target: finance,
      })
      return {
        transaction: (await financeLookup(app).out([res.transaction]))[0],
        subscription: subscriptionOut(res.subscription),
      }
    },
  }),
  defineTool({
    name: 'skip_subscription_charge',
    title: 'Saltar cobro de suscripción',
    description: 'Ese periodo no se cobró: adelanta el próximo cobro sin apuntar gasto.',
    input: { subscription: subscriptionRef },
    access: 'write',
    module: 'finance',
    detail: (a) => a.subscription,
    run: async ({ app, changed }, { subscription }) => {
      const sub = await resolveSubscription(app, subscription)
      const res = await app.finance.subscriptions.skip(sub.id, { expected: sub.nextDate })
      changed({
        summary: `Cobro de «${sub.name}» saltado`,
        undo: (m) => m.finance.subscriptions.revert(sub.id, { previousDate: sub.nextDate }),
        target: finance,
      })
      return subscriptionOut(res.subscription)
    },
  }),
  defineTool({
    name: 'archive_subscription',
    title: 'Archivar suscripción',
    description:
      'Archiva una suscripción (la cancelaste): deja de avisar. Sus cobros apuntados se conservan. No se borra.',
    input: { subscription: subscriptionRef },
    access: 'write',
    idempotent: true,
    module: 'finance',
    detail: (a) => a.subscription,
    run: async ({ app, changed }, { subscription }) => {
      const sub = await app.finance.subscriptions.archive(
        (await resolveSubscription(app, subscription)).id,
      )
      changed({
        summary: `Suscripción «${sub.name}» archivada`,
        undo: (m) => m.finance.subscriptions.restore(sub.id),
        target: finance,
      })
      return subscriptionOut(sub)
    },
  }),
]
