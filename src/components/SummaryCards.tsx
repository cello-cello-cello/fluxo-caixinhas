import { ArrowDownLeft, ArrowUpRight, Layers3, Wallet } from 'lucide-react'
import { formatBRL } from '../lib/money'
import type { AnnualFlow, Position } from '../types'

interface SummaryCardsProps {
  flow: AnnualFlow
  position: Position
}

export function SummaryCards({ flow, position }: SummaryCardsProps) {
  const items = [
    {
      label: `Saldo livre em 31/dez`,
      value: flow.closingBalanceCents,
      detail: `Aberto com ${formatBRL(flow.openingBalanceCents)}`,
      icon: Wallet,
      tone: 'text-slate-900',
      background: 'bg-slate-50',
    },
    {
      label: 'Entradas no ano',
      value: flow.totalIncomeCents,
      detail: 'Somas de todas as entradas',
      icon: ArrowDownLeft,
      tone: 'text-moss-dark',
      background: 'bg-moss-soft',
    },
    {
      label: 'Saídas no ano',
      value: flow.totalExpenseCents,
      detail: 'Gasto de consumo',
      icon: ArrowUpRight,
      tone: 'text-navy',
      background: 'bg-navy-soft',
    },
    {
      label: 'Patrimônio atual',
      value: position.netWorthCents,
      detail: `${formatBRL(position.freeBalanceCents)} livres`,
      icon: Layers3,
      tone: 'text-slate-900',
      background: 'bg-slate-50',
    },
  ]

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do ano">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <article key={item.label} className="card p-4 sm:p-5">
            <div className={`mb-4 grid h-9 w-9 place-items-center rounded-xl ${item.background} ${item.tone}`}>
              <Icon size={18} strokeWidth={2.2} />
            </div>
            <p className="text-xs font-semibold text-slate-400">{item.label}</p>
            <p className={`money mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl ${item.tone}`}>
              {formatBRL(item.value)}
            </p>
            <p className="money mt-2 truncate text-[11px] text-slate-400">{item.detail}</p>
          </article>
        )
      })}
    </section>
  )
}
