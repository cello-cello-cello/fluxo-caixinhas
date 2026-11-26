import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Trash2, Undo2, X } from 'lucide-react'
import { availableFor } from '../lib/calc'
import { TRANSACTION_TYPES } from '../lib/constants'
import { isoDate } from '../lib/dates'
import { centsToInput, formatBRL, formatBRLCompact, parseAmountToCents } from '../lib/money'
import { createId } from '../lib/storage'
import type { AppState, Transaction, TransactionType } from '../types'

interface LancamentoModalProps {
  state: AppState
  initialDate: string
  transaction?: Transaction
  presetType?: TransactionType
  presetBoxId?: string
  onClose: () => void
  onSave: (transaction: Transaction) => void
  onDelete: (id: string) => void
}

const TYPE_ICONS = {
  entrada: ArrowDownLeft,
  saida: ArrowUpRight,
  guardar: PiggyBank,
  resgatar: Undo2,
}

export function LancamentoModal({
  state,
  initialDate,
  transaction,
  presetType,
  presetBoxId,
  onClose,
  onSave,
  onDelete,
}: LancamentoModalProps) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? presetType ?? 'saida')
  const [date, setDate] = useState(transaction?.date ?? initialDate)
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [category, setCategory] = useState(transaction?.category ?? 'Outros')
  const [amount, setAmount] = useState(transaction ? centsToInput(transaction.amountCents) : '')
  const [boxId, setBoxId] = useState(transaction?.boxId ?? presetBoxId ?? state.boxes[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  const isTransfer = type === 'guardar' || type === 'resgatar'
  const available = useMemo(
    () => availableFor(state, date, boxId, transaction?.id),
    [state, date, boxId, transaction?.id],
  )

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

    const amountCents = parseAmountToCents(amount)
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!amountCents) return setError('Informe um valor em R$ maior que zero.')
    if (!date.startsWith(`${state.year}-`)) return setError(`A data deve estar no ano de ${state.year}.`)
    if (isTransfer && !boxId) return setError('Selecione uma caixinha.')

    if (type === 'guardar' && amountCents > available.freeCents) {
      return setError(`Saldo livre insuficiente. Disponível: ${formatBRL(available.freeCents)}.`)
    }
    if (type === 'resgatar' && amountCents > available.boxCents) {
      return setError(`A caixinha tem apenas ${formatBRL(available.boxCents)} disponíveis.`)
    }

    onSave({
      id: transaction?.id ?? createId(),
      date,
      description: description.trim(),
      category: isTransfer ? 'Caixinhas' : category,
      type,
      amountCents,
      boxId: isTransfer ? boxId : undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lancamento-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-4xl bg-white p-5 shadow-2xl sm:rounded-4xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
              {transaction ? 'Editar lançamento' : 'Novo lançamento'}
            </p>
            <h2 id="lancamento-title" className="mt-1 text-xl font-extrabold text-slate-900">
              {state.year} · {date.slice(5).replace('-', '/')}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="label">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              {TRANSACTION_TYPES.map((option) => {
                const Icon = TYPE_ICONS[option.value]
                const active = type === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setType(option.value)
                      setError(null)
                    }}
                    aria-pressed={active}
                    className={`flex min-h-[54px] items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-[11px] font-bold transition ${
                      active
                        ? 'border-coral bg-coral-soft text-coral'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="leading-tight">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="lancamento-data">Data</label>
              <input
                id="lancamento-data"
                ref={firstField}
                type="date"
                className="field money"
                value={date}
                min={isoDate(state.year, 0, 1)}
                max={isoDate(state.year, 11, 31)}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="lancamento-valor">Valor (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                <input
                  id="lancamento-valor"
                  className="field money !pl-11"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="lancamento-descricao">Descrição</label>
            <input
              id="lancamento-descricao"
              className="field"
              placeholder="Ex.: Mercado semanal"
              value={description}
              maxLength={140}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="lancamento-categoria">Categoria</label>
            <input
              id="lancamento-categoria"
              className="field"
              list="categorias"
              placeholder="Escolha ou crie uma categoria"
              value={isTransfer ? 'Caixinhas' : category}
              disabled={isTransfer}
              onChange={(event) => setCategory(event.target.value)}
            />
            <datalist id="categorias">
              {[...new Set(['Alimentação', 'Casa', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Outros', ...state.transactions.map((item) => item.category)])].map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          {isTransfer && (
            <div>
              <label className="label" htmlFor="lancamento-caixinha">Caixinha</label>
              {state.boxes.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Crie uma caixinha antes de transferir valores.
                </p>
              ) : (
                <select
                  id="lancamento-caixinha"
                  className="field"
                  value={boxId}
                  onChange={(event) => setBoxId(event.target.value)}
                  required
                >
                  {state.boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name} · {formatBRL(availableFor(state, date, box.id, transaction?.id).boxCents)}
                    </option>
                  ))}
                </select>
              )}
              <p className="money mt-2 text-xs text-slate-400">
                {type === 'guardar'
                  ? `Saldo livre disponível: ${formatBRLCompact(available.freeCents)}`
                  : `Disponível na caixinha: ${formatBRLCompact(available.boxCents)}`}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Salvar lançamento
            </button>
            {transaction && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    return
                  }
                  onDelete(transaction.id)
                }}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition sm:w-auto ${
                  confirmDelete ? 'border-coral bg-coral text-white' : 'border-slate-200 text-slate-500 hover:text-coral'
                }`}
              >
                <Trash2 size={16} /> {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-soft w-full sm:w-auto">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
