import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { createId } from '../lib/storage'
import type { CreditCard } from '../types'

interface CartaoModalProps {
  card?: CreditCard
  onClose: () => void
  onSave: (card: CreditCard) => void
  onDelete: (id: string) => void
}

export function CartaoModal({ card, onClose, onSave, onDelete }: CartaoModalProps) {
  const [name, setName] = useState(card?.name ?? '')
  const [limit, setLimit] = useState(card ? centsToInput(card.limitCents) : '0,00')
  const [closingDay, setClosingDay] = useState(String(card?.closingDay ?? 10))
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? 15))
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
    const closing = Number(closingDay)
    const due = Number(dueDay)

    if (!name.trim()) return setError('Dê um nome ou apelido para o cartão.')
    if (!limitCents) return setError('Informe um limite total em R$ maior que zero.')
    if (!Number.isInteger(closing) || closing < 1 || closing > 31) return setError('O fechamento deve ser entre 1 e 31.')
    if (!Number.isInteger(due) || due < 1 || due > 31) return setError('O vencimento deve ser entre 1 e 31.')

    onSave({
      id: card?.id ?? createId(),
      name: name.trim(),
      limitCents,
      closingDay: closing,
      dueDay: due,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="cartao-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-4xl bg-white p-5 shadow-2xl sm:rounded-4xl sm:p-7">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">Cartão de crédito</p>
            <h2 id="cartao-title" className="mt-1 text-xl font-extrabold text-slate-900">
              {card ? 'Editar cartão' : 'Novo cartão'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="cartao-fechamento">Dia de fechamento</label>
              <input id="cartao-fechamento" className="field money" inputMode="numeric" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cartao-vencimento">Dia de vencimento</label>
              <input id="cartao-vencimento" className="field money" inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            As parcelas importadas caem no dia de vencimento; se ele cair em fim de semana, o lançamento é antecipado para o dia útil anterior.
          </p>

          {error && (
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">{error}</p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <button type="submit" className="btn-primary w-full sm:w-auto">Salvar cartão</button>
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
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition sm:w-auto ${
                  confirmDelete ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-500 hover:text-navy'
                }`}
              >
                <Trash2 size={16} /> {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-soft w-full sm:w-auto">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
