import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { BOX_COLORS } from '../lib/constants'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { createId } from '../lib/storage'
import type { Box } from '../types'

interface CaixinhaModalProps {
  box?: Box
  onClose: () => void
  onSave: (box: Box) => void
  onDelete: (id: string) => void
}

export function CaixinhaModal({ box, onClose, onSave, onDelete }: CaixinhaModalProps) {
  const [name, setName] = useState(box?.name ?? '')
  const [color, setColor] = useState(box?.color ?? BOX_COLORS[0])
  const [balance, setBalance] = useState(box ? centsToInput(box.balanceCents) : '0,00')
  const [goal, setGoal] = useState(box ? centsToInput(box.goalCents) : '0,00')
  const [targetDate, setTargetDate] = useState(box?.targetDate ?? '')
  const [yieldRate, setYieldRate] = useState(box?.yieldRate === undefined ? '' : String(box.yieldRate).replace('.', ','))
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

    const balanceCents = parseAmountToCents(balance) ?? 0
    const goalCents = parseAmountToCents(goal) ?? 0
    const rate = yieldRate.trim() ? Number(yieldRate.replace(',', '.')) : undefined

    if (!name.trim()) return setError('Dê um nome para a caixinha.')
    if (rate !== undefined && (!Number.isFinite(rate) || rate < -99 || rate > 1000)) {
      return setError('Informe um rendimento entre -99% e 1000%.')
    }

    onSave({
      id: box?.id ?? createId(),
      name: name.trim(),
      color,
      balanceCents,
      goalCents,
      targetDate: targetDate || undefined,
      yieldRate: rate,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="caixinha-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-4xl bg-white p-5 shadow-2xl sm:rounded-4xl sm:p-7">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">Caixinha</p>
            <h2 id="caixinha-title" className="mt-1 text-xl font-extrabold text-slate-900">
              {box ? 'Editar caixinha' : 'Nova caixinha'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="caixinha-nome">Nome</label>
            <input
              id="caixinha-nome"
              ref={firstField}
              className="field"
              placeholder="Ex.: Viagem 2027"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div>
            <span className="label">Cor</span>
            <div className="flex flex-wrap gap-2">
              {BOX_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Selecionar cor ${option}`}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    color === option ? 'ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: option }}
                >
                  {color === option && <Check size={16} className="text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="caixinha-saldo">Saldo inicial no ano (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                <input id="caixinha-saldo" className="field money !pl-11" inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="caixinha-meta">Meta (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                <input id="caixinha-meta" className="field money !pl-11" inputMode="decimal" value={goal} onChange={(event) => setGoal(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="caixinha-data">Data alvo (opcional)</label>
              <input id="caixinha-data" type="date" className="field money" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="caixinha-rendimento">Rendimento (opcional)</label>
              <div className="relative">
                <input
                  id="caixinha-rendimento"
                  className="field money !pr-10"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={yieldRate}
                  onChange={(event) => setYieldRate(event.target.value)}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            O saldo inicial é considerado em 01/jan e as transferências do ano são aplicadas em sequência.
          </p>

          {error && (
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">{error}</p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <button type="submit" className="btn-primary w-full sm:w-auto">Salvar caixinha</button>
            {box && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    return
                  }
                  onDelete(box.id)
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
