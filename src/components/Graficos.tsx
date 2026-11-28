import { useMemo, useState } from 'react'
import { Donut } from './Donut'
import { calculatePosition, expandTransactions } from '../lib/calc'
import { categoryColor, CHART_COLORS } from '../lib/constants'
import { daysInMonth, isoDate, MONTH_NAMES, MONTH_SHORT } from '../lib/dates'
import { formatBRL } from '../lib/money'
import type { AnnualFlow, AppState } from '../types'

interface GraficosProps {
  state: AppState
  flow: AnnualFlow
}

type Period = 'mes' | 'anual'

function defaultMonth(year: number, dates: string[]): number {
  const now = new Date()
  const fallback = year === now.getFullYear() ? now.getMonth() : year < now.getFullYear() ? 11 : 0
  const withData = new Set(dates.map((date) => Number(date.slice(5, 7)) - 1))
  for (let month = fallback; month >= 0; month -= 1) {
    if (withData.has(month)) return month
  }
  return fallback
}

export function Graficos({ state, flow }: GraficosProps) {
  const [period, setPeriod] = useState<Period>('mes')
  const expandedTransactions = useMemo(() => expandTransactions(state.transactions), [state.transactions])
  const categoryTransactions = useMemo(
    () =>
      expandedTransactions.filter(
        (transaction) =>
          (transaction.type === 'entrada' || transaction.type === 'saida') &&
          transaction.date.startsWith(`${state.year}-`),
      ),
    [expandedTransactions, state.year],
  )
  const [month, setMonth] = useState(() =>
    defaultMonth(
      state.year,
      expandedTransactions.map((transaction) => transaction.date),
    ),
  )

  const visibleTransactions =
    period === 'anual'
      ? categoryTransactions
      : categoryTransactions.filter((transaction) => Number(transaction.date.slice(5, 7)) - 1 === month)

  const byCategory = new Map<string, number>()
  for (const transaction of visibleTransactions) {
    byCategory.set(transaction.category, (byCategory.get(transaction.category) ?? 0) + transaction.amountCents)
  }

  const categorySegments = [...byCategory.entries()]
    .map(([label, value]) => ({ label, value, color: categoryColor(label) }))
    .sort((a, b) => b.value - a.value)

  const periodLabel = period === 'anual' ? `Ano de ${state.year}` : `${MONTH_NAMES[month]} de ${state.year}`
  const periodControl = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-2xl bg-slate-100 p-1" role="group" aria-label="Período do gráfico">
        {(['mes', 'anual'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={period === option}
            onClick={() => setPeriod(option)}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${
              period === option ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-slate-500 hover:text-[#1E3A5F]'
            }`}
          >
            {option === 'mes' ? 'Mês' : 'Anual'}
          </button>
        ))}
      </div>
      {period === 'mes' && (
        <select
          aria-label="Mês do gráfico"
          className="field money !w-auto !py-1.5 text-xs"
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index}>{name}</option>
          ))}
        </select>
      )}
    </div>
  )

  const wealthMonth = period === 'anual' ? 11 : month
  const wealthDate = isoDate(state.year, wealthMonth, daysInMonth(state.year, wealthMonth))
  const wealthPosition = useMemo(() => calculatePosition(state, wealthDate), [state, wealthDate])
  const wealthSegments = [
    { label: 'Saldo livre', value: wealthPosition.freeBalanceCents, color: CHART_COLORS.navy },
    { label: 'Caixinhas', value: wealthPosition.totalBoxCents, color: CHART_COLORS.moss },
  ]

  const maxMonthly = Math.max(
    1,
    ...flow.months.flatMap((month) => [month.incomeCents, month.expenseCents]),
  )

  return (
    <section>
      <header className="mb-4">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Gráficos</h2>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Donut
          segments={wealthSegments}
          title="Livre × caixinhas"
          subtitle={periodLabel}
          control={periodControl}
          fullTotal
        />
        <Donut
          segments={categorySegments}
          title="Entradas e saídas por categoria"
          subtitle={periodLabel}
          control={periodControl}
        />
      </div>

      <article className="card mt-3">
        <h3 className="text-[15px] font-bold text-slate-900">Entradas e saídas por mês</h3>
        <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#4A6B53]" /> entradas</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#C0604D]" /> saídas</span>
        </div>
        <div className="mt-5 space-y-4">
          {flow.months.map((month) => (
            <div key={month.month} className="grid grid-cols-[28px_1fr] items-center gap-3">
              <span className="text-[11px] font-bold uppercase text-slate-400">{MONTH_SHORT[month.month]}</span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50">
                    <div
                      className="h-full rounded-full bg-[#4A6B53] transition-all duration-500"
                      style={{ width: `${(month.incomeCents / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="money w-20 text-right text-[10px] font-bold text-[#3A5743]">
                    {formatBRL(month.incomeCents)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50">
                    <div
                      className="h-full rounded-full bg-[#C0604D] transition-all duration-500"
                      style={{ width: `${(month.expenseCents / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="money w-20 text-right text-[10px] font-bold text-[#A64B39]">
                    {formatBRL(month.expenseCents)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
