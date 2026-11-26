import { Donut } from './Donut'
import { categoryColor } from '../lib/constants'
import { MONTH_SHORT } from '../lib/dates'
import { formatBRL } from '../lib/money'
import type { AnnualFlow, AppState, Position } from '../types'

interface GraficosProps {
  state: AppState
  flow: AnnualFlow
  position: Position
}

export function Graficos({ state, flow, position }: GraficosProps) {
  const byCategory = new Map<string, number>()
  for (const transaction of state.transactions) {
    if (transaction.type !== 'saida' || !transaction.date.startsWith(`${state.year}-`)) continue
    byCategory.set(transaction.category, (byCategory.get(transaction.category) ?? 0) + transaction.amountCents)
  }

  const categorySegments = [...byCategory.entries()]
    .map(([label, value]) => ({ label, value, color: categoryColor(label) }))
    .sort((a, b) => b.value - a.value)

  const wealthSegments = [
    { label: 'Saldo livre', value: position.freeBalanceCents, color: '#1E3A5F' },
    { label: 'Caixinhas', value: position.totalBoxCents, color: '#6366F1' },
  ]

  const maxMonthly = Math.max(
    1,
    ...flow.months.flatMap((month) => [month.incomeCents, month.expenseCents]),
  )

  return (
    <section>
      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">Leitura visual</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Gráficos</h2>
        <p className="mt-1 text-sm text-slate-500">Posição atual e composição dos gastos de {state.year}.</p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Donut
          segments={wealthSegments}
          title="Livre × caixinhas"
          subtitle="Patrimônio disponível neste momento"
        />
        <Donut
          segments={categorySegments}
          title="Saídas por categoria"
          subtitle="Apenas gasto de consumo; reservas ficam de fora"
        />
      </div>

      <article className="card mt-3">
        <h3 className="text-[15px] font-bold text-slate-900">Entradas e saídas por mês</h3>
        <p className="mt-1 text-xs text-slate-400">As barras usam o mesmo intervalo para comparação.</p>
        <div className="mt-5 space-y-4">
          {flow.months.map((month) => (
            <div key={month.month} className="grid grid-cols-[28px_1fr] items-center gap-3">
              <span className="text-[11px] font-bold uppercase text-slate-400">{MONTH_SHORT[month.month]}</span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50">
                    <div
                      className="h-full rounded-full bg-moss transition-all duration-500"
                      style={{ width: `${(month.incomeCents / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="money w-20 text-right text-[10px] font-bold text-moss-dark">
                    {formatBRL(month.incomeCents)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-50">
                    <div
                      className="h-full rounded-full bg-navy transition-all duration-500"
                      style={{ width: `${(month.expenseCents / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="money w-20 text-right text-[10px] font-bold text-navy">
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
