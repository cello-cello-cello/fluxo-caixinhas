import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { daysInMonth, isoDate, isValidIsoDate } from '../lib/dates'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { createId } from '../lib/storage'
import type { CreditCard } from '../types'

function defaultDate(day: number, offsetMonths = 0): string {
  const now = new Date()
  const monthIndex = now.getMonth() + offsetMonths
  const year = now.getFullYear() + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  return isoDate(year, month, Math.min(day, daysInMonth(year, month)))
}

interface CartaoModalProps {
  card?: CreditCard
  onClose: () => void
  onSave: (card: CreditCard) => void
  onDelete: (id: string) => void
}

export function CartaoModal({ card, onClose, onSave, onDelete }: CartaoModalProps) {
  const [name, setName] = useState(card?.name ?? '')
  const [limit, setLimit] = useState(card ? centsToInput(card.limitCents) : '0,00')
  const [closingDate, setClosingDate] = useState(card?.closingDate ?? defaultDate(card?.closingDay ?? 10))
  const [dueDate, setDueDate] = useState(card?.dueDate ?? defaultDate(card?.dueDay ?? 15, 1))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstField.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const limitCents = parseAmountToCents(limit)

    if (!name.trim()) return setError('Dê um nome ou apelido para o cartão.')
    if (!limitCents) return setError('Informe um limite total em R$ maior que zero.')
    if (!isValidIsoDate(closingDate)) return setError('Informe uma data de fechamento válida.')
    if (!isValidIsoDate(dueDate)) return setError('Informe uma data de vencimento válida.')

    onSave({
      id: card?.id ?? createId(),
      name: name.trim(),
      limitCents,
      closingDay: Number(closingDate.slice(8)),
      dueDay: Number(dueDate.slice(8)),
      closingDate,
      dueDate,
    })
  }

  return (
    <div
      className="modal-backdrop sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="cartao-title" className="modal-card max-w-lg sm:rounded-[20px]">
        <header className="modal-header sm:px-6">
          <div>
            <p className="modal-kicker">Cartão de crédito</p>
            <h2 id="cartao-title" className="mt-1 text-xl font-extrabold text-slate-900">
              {card ? 'Editar cartão' : 'Novo cartão'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form id="cartao-form" onSubmit={handleSubmit} className="modal-body space-y-4 sm:px-6">
          <div>
            <label className="label" htmlFor="cartao-nome">Nome ou apelido</label>
            <input
              id="cartao-nome"
              ref={firstField}
              className="field"
              placeholder="Ex.: Nubank"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="cartao-limite">Limite total (R$)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
              <input id="cartao-limite" className="field money !pl-11" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cartao-fechamento">Data de fechamento</label>
              <input id="cartao-fechamento" type="date" className="field money" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cartao-vencimento">Data de vencimento</label>
              <input id="cartao-vencimento" type="date" className="field money" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          </div>

          <p className="text-xs text-slate-400">Vencimento pode ser no mês ou ano seguinte; fins de semana antecipam.</p>

          {error && (
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">{error}</p>
          )}
        </form>

        <footer className="modal-footer sm:px-6">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-soft min-h-11 flex-1">Cancelar</button>
            <button type="submit" form="cartao-form" className="btn-primary min-h-11 flex-[2]">Salvar cartão</button>
          </div>
          {card && (
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                onDelete(card.id)
              }}
              className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-extrabold transition ${
                confirmDelete ? 'border-navy bg-navy text-white shadow-lift' : 'border-[#E6EAF0] text-slate-500 hover:border-navy hover:text-navy'
              }`}
            >
              <Trash2 size={16} /> {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
