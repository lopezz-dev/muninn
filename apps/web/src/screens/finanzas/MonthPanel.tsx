import type { MonthReport } from '@muninn/core'
import { Card, CardHeader, cn, Icon, projectColor } from '@muninn/ui'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  amountText,
  deltaText,
  monthLabel,
  monthShort,
  percentText,
  rateText,
} from '../../lib/finance'

/*
 * Panel mensual (Finanzas.dc.html; bloque D de la F3). Todo lo calcula el core (`m.finance.report.month`): aquí solo
 * se pinta. Sin librería de gráficos (barras en CSS), según la skill `dataviz`: marcas finas con extremo redondeado,
 * 2 px de separación, leyenda con dos series, texto en tokens de texto, tooltip al pasar o enfocar y tabla para
 * lectores de pantalla. Los colores de ingresos y gastos (`chart-*`) están validados para daltonismo.
 */

const euros = (cents: number) => amountText(cents, 'none')

function Kpi({
  label,
  value,
  note,
  icon,
}: {
  label: string
  value: string
  note?: ReactNode
  icon?: 'income' | 'expense'
}) {
  return (
    // @container: la cifra se ajusta al ancho de la tarjeta (cqi) y nunca se parte en dos líneas.
    <Card className="@container flex min-w-0 flex-col gap-2 p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
        {icon ? (
          <Icon
            name={icon}
            size={14}
            className={icon === 'income' ? 'text-chart-income' : 'text-chart-expense'}
          />
        ) : null}
        {label}
      </span>
      <span className="font-mono text-[clamp(15px,13cqi,24px)] leading-none font-medium whitespace-nowrap tabular">
        {value}
      </span>
      {note ? <span className="text-xs text-fg-subtle">{note}</span> : null}
    </Card>
  )
}

/** Ingresos, gastos, ahorro e inversión del mes, comparados con el anterior. */
export function MonthKpis({ report }: { report: MonthReport }) {
  const { t } = useTranslation('finance')
  const prev = report.previous
  return (
    <section aria-label={t('panel.monthSummary')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        label={t('panel.income')}
        icon="income"
        value={euros(report.income)}
        note={deltaText(report.income, prev.income, prev.month) ?? t('panel.noPrevious')}
      />
      <Kpi
        label={t('panel.expenses')}
        icon="expense"
        value={euros(report.expenses)}
        note={deltaText(report.expenses, prev.expenses, prev.month) ?? t('panel.noPrevious')}
      />
      <Kpi
        label={t('panel.savings')}
        value={report.savings < 0 ? amountText(report.savings) : euros(report.savings)}
        note={
          <>
            {t('panel.savingsRate')}{' '}
            <strong
              className={cn(
                'font-semibold',
                report.savingsRate !== null && report.savingsRate < 0 ? 'text-danger' : 'text-fg',
              )}
            >
              {rateText(report.savingsRate)}
            </strong>
          </>
        }
      />
      <Kpi
        label={t('panel.investment')}
        value={report.investment < 0 ? amountText(report.investment) : euros(report.investment)}
        note={t('panel.free', {
          amount: report.free < 0 ? amountText(report.free) : euros(report.free),
        })}
      />
    </section>
  )
}

/** «En qué se va el dinero»: gasto por categoría, barras horizontales a escala de la mayor. */
export function CategoryBars({ report }: { report: MonthReport }) {
  const { t } = useTranslation('finance')
  const rows = report.byCategory.filter((c) => c.amount > 0)
  const max = Math.max(1, ...rows.map((c) => c.amount))
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('panel.whereMoneyGoes')}
        description={`${monthLabel(report.month)} · ${euros(report.expenses)}`}
      />
      {rows.length === 0 ? (
        <p className="border-t border-border-subtle px-4 py-6 text-sm text-fg-subtle">
          {t('panel.noExpenses')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 px-4 pt-1 pb-4">
          {rows.map((c) => {
            const delta = deltaText(c.amount, c.previous, report.previous.month)
            return (
              <li
                key={c.categoryId ?? 'none'}
                className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_auto] items-center gap-3 text-sm md:grid-cols-[150px_minmax(0,1fr)_100px]"
                title={delta ?? undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-xs"
                    style={{ background: projectColor(c.color) }}
                  />
                  <span className="truncate">
                    {c.categoryId === null ? t('noCategory') : c.name}
                  </span>
                </span>
                <span aria-hidden="true" className="h-2 rounded-xs bg-border">
                  <span
                    className="block h-full rounded-xs"
                    style={{
                      width: `${Math.max(2, (c.amount / max) * 100)}%`,
                      background: projectColor(c.color),
                    }}
                  />
                </span>
                <span className="text-right font-mono tabular">
                  {euros(c.amount)}
                  <span className="sr-only">
                    {`${t('panel.share', { pct: percentText(c.share) })}${delta ? `, ${delta}` : ''}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Ingresos frente a gastos de los últimos meses (el pedido, a la derecha y resaltado). */
export function HistoryChart({ report }: { report: MonthReport }) {
  const { t } = useTranslation('finance')
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...report.history.flatMap((h) => [h.income, h.expenses]))
  const shown = report.history.find((h) => h.month === hover)
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('panel.lastMonths', { count: report.history.length })}
        action={
          <span className="flex items-center gap-3 text-xs text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-xs bg-chart-income" />
              {t('panel.income')}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-xs bg-chart-expense" />
              {t('panel.expenses')}
            </span>
          </span>
        }
      />
      <div className="relative px-4 pb-4">
        <p
          aria-hidden="true"
          className={cn(
            'mb-2 h-4 text-xs text-fg-muted tabular transition-opacity',
            shown ? 'opacity-100' : 'opacity-0',
          )}
        >
          {shown
            ? t('panel.hover', {
                month: monthLabel(shown.month),
                income: euros(shown.income),
                expenses: euros(shown.expenses),
              })
            : ' '}
        </p>
        <div
          aria-hidden="true"
          className="grid h-36 grid-cols-6 items-end gap-3 border-b border-border"
        >
          {report.history.map((h) => {
            const current = h.month === report.month
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: solo resalta; los datos están en la tabla.
              <div
                key={h.month}
                onMouseEnter={() => setHover(h.month)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  'flex h-full items-end justify-center gap-0.5 rounded-sm transition-colors',
                  hover === h.month && 'bg-fg/[0.05]',
                )}
              >
                {(['income', 'expenses'] as const).map((k) => (
                  <span
                    key={k}
                    className={cn(
                      'w-3.5 rounded-t-xs md:w-4',
                      k === 'income' ? 'bg-chart-income' : 'bg-chart-expense',
                      !current && 'opacity-70',
                    )}
                    style={{ height: `${h[k] ? Math.max(2, (h[k] / max) * 100) : 0}%` }}
                  />
                ))}
              </div>
            )
          })}
        </div>
        <div aria-hidden="true" className="mt-1.5 grid grid-cols-6 gap-3 text-center text-[11.5px]">
          {report.history.map((h) => (
            <span
              key={h.month}
              className={h.month === report.month ? 'font-semibold text-fg' : 'text-fg-subtle'}
            >
              {monthShort(h.month)}
            </span>
          ))}
        </div>
        <table className="sr-only">
          <caption>{t('panel.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('panel.monthCol')}</th>
              <th scope="col">{t('panel.income')}</th>
              <th scope="col">{t('panel.expenses')}</th>
            </tr>
          </thead>
          <tbody>
            {report.history.map((h) => (
              <tr key={h.month}>
                <th scope="row">{monthLabel(h.month)}</th>
                <td>{euros(h.income)}</td>
                <td>{euros(h.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
