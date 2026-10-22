import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  type AccountWithBalance,
  accountKind,
  categoryKind,
  centsFromEuros,
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

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }
type Annotations = Record<string, boolean>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe('Mes AAAA-MM')
const isoDate = z.iso.date().describe('Fecha AAAA-MM-DD')

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
 * Herramientas de Finanzas (ADR-0037). Los importes entran en euros y salen en céntimos (`amount`, `balance`) y con
 * texto (`amountText`, `balanceText`). No hay borrados: como mucho, archivar.
 */
export function registerFinanceTools(
  server: McpServer,
  app: Muninn,
  {
    run,
    read,
    write,
  }: {
    run: (fn: () => Promise<unknown>) => Promise<ToolResult>
    read: Annotations
    write: Annotations
  },
) {
  const f = app.finance

  const byName = <T extends { id: string; name: string }>(rows: T[], ref: string) => {
    if (UUID.test(ref)) return rows.find((r) => r.id === ref)
    const needle = ref.trim().toLowerCase()
    return (
      rows.find((r) => r.name.toLowerCase() === needle) ??
      rows.find((r) => r.name.toLowerCase().includes(needle))
    )
  }

  async function resolveAccount(ref: string) {
    const all = await f.accounts.list({ includeArchived: true })
    const match = byName(all, ref)
    if (!match) {
      throw new ValidationError(
        `No hay ninguna cuenta "${ref}". Cuentas: ${all.map((a) => `${a.name} (${a.kind})`).join(', ') || '(ninguna: créala con create_finance_account)'}`,
      )
    }
    return match
  }

  /** La cuenta por defecto de un gasto o ingreso: la primera corriente, o la primera sin archivar. */
  async function defaultAccount() {
    const all = await f.accounts.list()
    const account = all.find((a) => a.kind === 'checking') ?? all[0]
    if (!account) {
      throw new ValidationError('No hay cuentas: crea una con create_finance_account')
    }
    return account
  }

  async function resolveCategory(ref: string, kind?: 'expense' | 'income') {
    const all = await f.categories.list({ includeArchived: true })
    const match = byName(
      kind ? [...all.filter((c) => c.kind === kind), ...all.filter((c) => c.kind !== kind)] : all,
      ref,
    )
    if (!match) {
      const options = all.filter((c) => !c.archivedAt && (!kind || c.kind === kind))
      throw new ValidationError(
        `No hay ninguna categoría "${ref}". Categorías: ${options.map((c) => c.name).join(', ')}`,
      )
    }
    return match
  }

  const accountOut = (a: AccountWithBalance) => ({
    ...a,
    balanceText: formatEuros(a.balance),
    initialBalanceText: formatEuros(a.initialBalance),
  })

  /** Movimientos con los nombres de cuenta y categoría, para que el modelo no tenga que cruzarlos. */
  async function transactionsOut(rows: Transaction[]) {
    const [accounts, categories] = await Promise.all([
      f.accounts.list({ includeArchived: true }),
      f.categories.list({ includeArchived: true }),
    ])
    const account = new Map(accounts.map((a) => [a.id, a.name]))
    const category = new Map(categories.map((c) => [c.id, c.name]))
    return rows.map((t) => ({
      ...t,
      amountText: formatEuros(t.amount),
      account: account.get(t.accountId) ?? null,
      toAccount: t.toAccountId ? (account.get(t.toAccountId) ?? null) : null,
      category: t.categoryId ? (category.get(t.categoryId) ?? null) : null,
    }))
  }

  // ─── Lectura ────────────────────────────────────────────────────────────────

  server.registerTool(
    'list_finance_accounts',
    {
      title: 'Cuentas y saldos',
      description:
        'Cuentas (corriente, ahorro, inversión, efectivo…) con su saldo actual, derivado de los movimientos. Úsalo para "¿cuánto tengo?".',
      inputSchema: { includeArchived: z.boolean().optional() },
      annotations: read,
    },
    ({ includeArchived }) =>
      run(async () => (await f.accounts.list({ includeArchived })).map(accountOut)),
  )

  server.registerTool(
    'list_finance_categories',
    {
      title: 'Categorías de gastos e ingresos',
      description: 'Categorías disponibles para apuntar gastos (expense) e ingresos (income).',
      inputSchema: { kind: categoryKind.optional() },
      annotations: read,
    },
    ({ kind }) => run(() => f.categories.list({ kind })),
  )

  server.registerTool(
    'list_transactions',
    {
      title: 'Buscar movimientos',
      description:
        'Movimientos (gastos, ingresos y traspasos) del más reciente al más antiguo, con filtros. Los importes van en céntimos (amount) y como texto (amountText).',
      inputSchema: {
        account: accountRef
          .optional()
          .describe('Los de esta cuenta y los traspasos que llegan a ella'),
        category: categoryRef.optional(),
        kinds: z.array(transactionKind).optional(),
        month: month.optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        search: z.string().optional().describe('Texto en el concepto'),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: read,
    },
    ({ account, category, ...rest }) =>
      run(async () =>
        transactionsOut(
          await f.transactions.list({
            ...rest,
            accountId: account ? (await resolveAccount(account)).id : undefined,
            categoryId: category ? (await resolveCategory(category)).id : undefined,
            limit: rest.limit ?? 100,
          }),
        ),
      ),
  )

  // ─── Escritura ──────────────────────────────────────────────────────────────

  server.registerTool(
    'create_transaction',
    {
      title: 'Apuntar movimiento',
      description:
        'Apunta un gasto, un ingreso o un traspaso entre cuentas. Ahorrar o invertir es un traspaso a la cuenta de ahorro o inversión. Sin cuenta, va a la primera cuenta corriente; sin fecha, hoy.',
      inputSchema: {
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
      annotations: write,
    },
    ({ kind, amount, account, toAccount, category, ...rest }) =>
      run(async () => {
        const from = account ? await resolveAccount(account) : await defaultAccount()
        const tx = await f.transactions.create({
          ...rest,
          kind,
          amount: centsFromEuros(amount),
          accountId: from.id,
          toAccountId: toAccount ? (await resolveAccount(toAccount)).id : undefined,
          categoryId:
            category && kind !== 'transfer'
              ? (await resolveCategory(category, kind)).id
              : undefined,
        })
        return (await transactionsOut([tx]))[0]
      }),
  )

  server.registerTool(
    'update_transaction',
    {
      title: 'Editar movimiento',
      description:
        'Cambia tipo, importe, cuentas, categoría, fecha, concepto o nota de un movimiento. category: null la quita.',
      inputSchema: {
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
      annotations: write,
    },
    ({ transactionId, amount, account, toAccount, category, ...rest }) =>
      run(async () => {
        const kind = rest.kind ?? (await f.transactions.get(transactionId)).kind
        const tx = await f.transactions.update(transactionId, {
          ...rest,
          amount: amount === undefined ? undefined : centsFromEuros(amount),
          accountId: account ? (await resolveAccount(account)).id : undefined,
          toAccountId: toAccount ? (await resolveAccount(toAccount)).id : undefined,
          categoryId:
            category === null
              ? null
              : category && kind !== 'transfer'
                ? (await resolveCategory(category, kind)).id
                : undefined,
        })
        return (await transactionsOut([tx]))[0]
      }),
  )

  server.registerTool(
    'archive_transaction',
    {
      title: 'Archivar movimiento',
      description: 'Archiva un movimiento: deja de contar en saldos e informes. No se borra.',
      inputSchema: { transactionId: z.uuid() },
      annotations: { ...write, idempotentHint: true },
    },
    ({ transactionId }) => run(() => f.transactions.archive(transactionId)),
  )

  server.registerTool(
    'create_finance_account',
    {
      title: 'Crear cuenta',
      description:
        'Crea una cuenta: checking (corriente), savings (ahorro, hucha), investment (inversión), cash (efectivo) u other.',
      inputSchema: {
        name: z.string().min(1).max(80),
        kind: accountKind,
        initialBalance: signedEuros.optional().describe('Saldo con el que empieza, en euros'),
        goal: euros.optional().describe('Objetivo de una hucha, en euros'),
        color: financeColor.optional(),
      },
      annotations: write,
    },
    ({ initialBalance, goal, ...rest }) =>
      run(async () =>
        accountOut(
          await f.accounts.create({
            ...rest,
            initialBalance: initialBalance === undefined ? undefined : signedCents(initialBalance),
            goal: goal === undefined ? undefined : centsFromEuros(goal),
          }),
        ),
      ),
  )

  server.registerTool(
    'update_finance_account',
    {
      title: 'Editar cuenta',
      description:
        'Cambia nombre, tipo, saldo inicial, objetivo o color de una cuenta. goal: null lo quita.',
      inputSchema: {
        account: accountRef,
        name: z.string().min(1).max(80).optional(),
        kind: accountKind.optional(),
        initialBalance: signedEuros.optional(),
        goal: euros.nullable().optional(),
        color: financeColor.optional(),
      },
      annotations: write,
    },
    ({ account, initialBalance, goal, ...rest }) =>
      run(async () =>
        accountOut(
          await f.accounts.update((await resolveAccount(account)).id, {
            ...rest,
            initialBalance: initialBalance === undefined ? undefined : signedCents(initialBalance),
            goal: goal === undefined ? undefined : goal === null ? null : centsFromEuros(goal),
          }),
        ),
      ),
  )

  server.registerTool(
    'archive_finance_account',
    {
      title: 'Archivar cuenta',
      description:
        'Archiva una cuenta: deja de verse, pero sus movimientos se conservan. No se borra.',
      inputSchema: { account: accountRef },
      annotations: { ...write, idempotentHint: true },
    },
    ({ account }) =>
      run(async () => accountOut(await f.accounts.archive((await resolveAccount(account)).id))),
  )

  server.registerTool(
    'create_finance_category',
    {
      title: 'Crear categoría',
      description: 'Crea una categoría propia de gastos (expense) o de ingresos (income).',
      inputSchema: {
        name: z.string().min(1).max(60),
        kind: categoryKind,
        color: financeColor.optional(),
      },
      annotations: write,
    },
    (input) => run(() => f.categories.create(input)),
  )

  // ─── Suscripciones (ADR-0038) ───────────────────────────────────────────────

  async function resolveSubscription(ref: string) {
    const all = await f.subscriptions.list({ includeArchived: true })
    const match = byName(all, ref)
    if (!match) {
      throw new ValidationError(
        `No hay ninguna suscripción "${ref}". Suscripciones: ${all.map((x) => x.name).join(', ') || '(ninguna)'}`,
      )
    }
    return match
  }

  const subscriptionOut = (x: Subscription) => ({
    ...x,
    amountText: formatEuros(x.amount),
    monthlyCostText: formatEuros(monthlyCost(x)),
  })

  const subscriptionRef = z.string().min(1).describe('Id o nombre de la suscripción')

  server.registerTool(
    'list_subscriptions',
    {
      title: 'Suscripciones',
      description:
        'Suscripciones con su próximo cobro (nextDate) y lo que cuestan al mes. Con upcomingDays, solo las que vencen en esos días (y las ya vencidas). Muninn no cobra solo: avisa, y el cobro se apunta con record_subscription_charge.',
      inputSchema: {
        upcomingDays: z.number().int().min(0).max(366).optional(),
        includeArchived: z.boolean().optional(),
      },
      annotations: read,
    },
    ({ upcomingDays, includeArchived }) =>
      run(async () =>
        (upcomingDays === undefined
          ? await f.subscriptions.list({ includeArchived })
          : await f.subscriptions.upcoming({ days: upcomingDays })
        ).map(subscriptionOut),
      ),
  )

  server.registerTool(
    'create_subscription',
    {
      title: 'Crear suscripción',
      description:
        'Crea una suscripción recurrente (weekly, monthly, yearly) con su próximo cobro. Sin cuenta, la primera cuenta corriente; sin categoría, Suscripciones.',
      inputSchema: {
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
      annotations: write,
    },
    ({ amount, account, category, ...rest }) =>
      run(async () => {
        const from = account ? await resolveAccount(account) : await defaultAccount()
        const categoryId = category
          ? (await resolveCategory(category, 'expense')).id
          : (await f.categories.list({ kind: 'expense' })).find((c) => c.key === 'subscriptions')
              ?.id
        return subscriptionOut(
          await f.subscriptions.create({
            ...rest,
            amount: centsFromEuros(amount),
            accountId: from.id,
            categoryId,
          }),
        )
      }),
  )

  server.registerTool(
    'record_subscription_charge',
    {
      title: 'Apuntar cobro de suscripción',
      description:
        'Apunta el próximo cobro de una suscripción como gasto (con su importe o el que digas) y adelanta la fecha un periodo. No apunta dos veces el mismo cobro.',
      inputSchema: {
        subscription: subscriptionRef,
        amount: euros.optional().describe('Si esta vez cobraron otra cantidad'),
      },
      annotations: write,
    },
    ({ subscription, amount }) =>
      run(async () => {
        const sub = await resolveSubscription(subscription)
        const res = await f.subscriptions.charge(sub.id, {
          expected: sub.nextDate,
          amount: amount === undefined ? undefined : centsFromEuros(amount),
        })
        return {
          transaction: (await transactionsOut([res.transaction]))[0],
          subscription: subscriptionOut(res.subscription),
        }
      }),
  )

  server.registerTool(
    'skip_subscription_charge',
    {
      title: 'Saltar cobro de suscripción',
      description: 'Ese periodo no se cobró: adelanta el próximo cobro sin apuntar gasto.',
      inputSchema: { subscription: subscriptionRef },
      annotations: write,
    },
    ({ subscription }) =>
      run(async () => {
        const sub = await resolveSubscription(subscription)
        const res = await f.subscriptions.skip(sub.id, { expected: sub.nextDate })
        return subscriptionOut(res.subscription)
      }),
  )

  server.registerTool(
    'archive_subscription',
    {
      title: 'Archivar suscripción',
      description:
        'Archiva una suscripción (la cancelaste): deja de avisar. Sus cobros apuntados se conservan. No se borra.',
      inputSchema: { subscription: subscriptionRef },
      annotations: { ...write, idempotentHint: true },
    },
    ({ subscription }) =>
      run(async () =>
        subscriptionOut(
          await f.subscriptions.archive((await resolveSubscription(subscription)).id),
        ),
      ),
  )
}
