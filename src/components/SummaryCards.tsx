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
      tone: flow.closingBalanceCents < 0 ? 'text-[#C0604D]' : 'text-slate-900',
      background: 'bg-slate-50',
    },
    {
      label: 'Entradas no ano',
      value: flow.totalIncomeCents,
      detail: '',
      icon: ArrowDownLeft,
      tone: 'text-moss-dark',
      background: 'bg-moss-soft',
    },
    {
      label: 'Saídas no ano',
      value: flow.totalExpenseCents,
      detail: '',
      icon: ArrowUpRight,
      tone: 'text-navy',
      background: 'bg-navy-soft',
    },
    {
      label: 'Patrimônio atual',
      value: position.netWorthCents,
      detail: `${formatBRL(position.freeBalanceCents)} livres`,
      icon: Layers3,
      tone: position.netWorthCents < 0 ? 'text-[#C0604D]' : 'text-slate-900',
      background: 'bg-slate-50',
    },
  ]

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do ano">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <article key={item.label} className="card flex min-h-[138px] flex-col justify-between p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.background} ${item.tone}`}>
                <Icon size={18} strokeWidth={2.2} />
              </span>
            </div>
            <div>
              <p className={`money mt-4 text-2xl font-extrabold tracking-tight sm:text-[26px] ${item.tone}`}>
                {formatBRL(item.value)}
              </p>
              {item.detail && <p className="money mt-1 truncate text-[11px] text-slate-400">{item.detail}</p>}
            </div>
          </article>
        )
      })}
    </section>
  )
}
