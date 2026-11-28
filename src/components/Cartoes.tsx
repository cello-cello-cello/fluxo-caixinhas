import { useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CreditCard as CreditCardIcon,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react'
import { cardCommitment, cardDueDate } from '../lib/invoices'
import { formatDate, todayIso } from '../lib/dates'
import { usePrivacy } from '../lib/privacy'
import type { AppState, CreditCard } from '../types'

interface CartoesProps {
  state: AppState
  onAdd: () => void
  onEdit: (card: CreditCard) => void
  onDelete: (id: string) => void
  onImportPdf: (card: CreditCard, file: File, invoiceMonth: string) => void
  onManual: (card: CreditCard) => void
}

export function Cartoes({ state, onAdd, onEdit, onDelete, onImportPdf, onManual }: CartoesProps) {
  const { formatBRL: formatMoney } = usePrivacy()
  const defaultMonth = todayIso().slice(0, 7)
  const [months, setMonths] = useState<Record<string, string>>({})
  const currentDate = new Date()

  const totals = state.cards.reduce(
    (sum, card) => {
      const commitment = cardCommitment(state, card.id, currentDate)
      return {
        limit: sum.limit + card.limitCents,
        committed: sum.committed + commitment.committedCents,
        available: sum.available + commitment.availableCents,
      }
    },
    { limit: 0, committed: 0, available: 0 },
  )

  function monthFor(card: CreditCard): string {
    return months[card.id] ?? defaultMonth
  }

  return (
    <section>
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Cartões</h2>
        </div>
        <button type="button" className="btn-primary w-fit" onClick={onAdd}>
          <Plus size={17} /> Novo cartão
        </button>
      </header>

      <div className="card mb-5 grid grid-cols-1 gap-5 p-5 sm:grid-cols-3 sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Limite total</p>
          <p className="money mt-1 text-xl font-extrabold text-slate-900">{formatMoney(totals.limit)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Comprometido</p>
          <p className="money mt-1 text-xl font-extrabold text-[#1E3A5F]">{formatMoney(totals.committed)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Limite disponível</p>
          <p className="money mt-1 text-xl font-extrabold text-moss-dark">{formatMoney(totals.available)}</p>
        </div>
      </div>

      {state.cards.length === 0 ? (
        <div className="card flex flex-col items-center p-8 py-12 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-navy-soft text-navy">
            <CreditCardIcon size={26} />
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-slate-900">Seu primeiro cartão</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Cadastre seus cartões para acompanhar limite e faturas.</p>
          <button type="button" className="btn-primary mt-5" onClick={onAdd}>
            Criar cartão
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {state.cards.map((card) => {
            const commitment = cardCommitment(state, card.id, currentDate)
            const used = card.limitCents > 0 ? Math.min(100, Math.round(commitment.committedCents / card.limitCents * 100)) : 100
            const nextDue = cardDueDate(card, todayIso().slice(0, 7))

            return (
              <article key={card.id} className="card relative overflow-hidden p-5 pt-6 sm:p-6 sm:pt-7">
                <span className="absolute inset-x-0 top-0 h-1 bg-navy" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-soft text-navy">
                      <CreditCardIcon size={19} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold text-slate-900">{card.name}</h3>
                      <p className="money text-xs text-slate-400">limite de {formatMoney(card.limitCents)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(card)}
                    aria-label={`Editar ${card.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    <Pencil size={15} />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disponível</p>
                      <p className={`money mt-0.5 text-xl font-extrabold ${commitment.exceeded ? 'text-rose-700' : 'text-moss-dark'}`}>
                        {formatMoney(commitment.availableCents)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Comprometido</p>
                      <p className="money mt-0.5 text-sm font-bold text-slate-700">{formatMoney(commitment.committedCents)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Uso do limite</span>
                    <span className="money text-[11px] text-navy">{used}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF2F6]">
                    <div
                      className={`h-full rounded-full ${commitment.exceeded ? 'bg-rose-600' : 'bg-navy'}`}
                      style={{ width: `${used}%` }}
                    />
                  </div>
                  {commitment.exceeded && (
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-rose-700">
                      <AlertCircle size={13} /> Limite ultrapassado: revise as parcelas em aberto.
                    </p>
                  )}
                </div>

                <div className="mt-5 space-y-2 border-t border-[#E6EAF0] pt-4 text-[11px] text-slate-500">
                  <p className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-slate-400" />
                    Fecha {card.closingDate ? formatDate(card.closingDate) : `dia ${card.closingDay}`} · vence {formatDate(nextDue)}
                  </p>
                  <p>
                    {commitment.openInstallments} parcela(s) em aberto desde este mês
                    {' · '}{commitment.futureInstallments} futura(s) após a atual.
                  </p>
                  <p>Fatura atual + parcelas futuras em aberto.</p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`fatura-mes-${card.id}`}>Mês da fatura</label>
                    <input
                      id={`fatura-mes-${card.id}`}
                      type="month"
                      className="field !py-2 text-xs"
                      value={monthFor(card)}
                      onChange={(event) => setMonths((previous) => ({ ...previous, [card.id]: event.target.value }))}
                    />
                  </div>
                  <label className="btn-soft cursor-pointer justify-center !px-2 text-[11px]">
                    <Upload size={14} /> Importar PDF
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      aria-label={`Importar fatura PDF de ${card.name}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) onImportPdf(card, file, monthFor(card))
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-soft !px-2 text-[11px]" onClick={() => onManual(card)}>
                    <Plus size={14} /> Manual
                  </button>
                  <button
                    type="button"
                    className="btn-soft !px-2 text-[11px] text-slate-400"
                    onClick={() => onDelete(card.id)}
                    aria-label={`Excluir ${card.name}`}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
