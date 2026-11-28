import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { planBoxGoal } from '../lib/boxes'
import { BOX_COLORS } from '../lib/constants'
import { MONTH_NAMES } from '../lib/dates'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { usePrivacy } from '../lib/privacy'
import { createId } from '../lib/storage'
import type { Box } from '../types'

interface CaixinhaModalProps {
  box?: Box
  onClose: () => void
  onSave: (box: Box) => void
  onDelete: (id: string) => void
}

export function CaixinhaModal({ box, onClose, onSave, onDelete }: CaixinhaModalProps) {
  const { formatBRL: formatMoney } = usePrivacy()
  const currentYear = new Date().getFullYear()
  const initialTarget = box?.targetMonth ?? box?.targetDate?.slice(0, 7) ?? `${currentYear + 1}-11`
  const [name, setName] = useState(box?.name ?? '')
  const [color, setColor] = useState(box?.color ?? BOX_COLORS[0])
  const [balance, setBalance] = useState(box ? centsToInput(box.balanceCents) : '0,00')
  const [goal, setGoal] = useState(box ? centsToInput(box.goalCents) : '0,00')
  const [hasTarget, setHasTarget] = useState(Boolean(box?.targetMonth || box?.targetDate) || !box)
  const [targetYear, setTargetYear] = useState(Number(initialTarget.slice(0, 4)) || currentYear + 1)
  const [targetMonth, setTargetMonth] = useState(Math.max(0, Number(initialTarget.slice(5)) - 1))
  const [autoAmount, setAutoAmount] = useState(box ? centsToInput(box.autoContributionCents ?? 0) : '0,00')
  const [autoDay, setAutoDay] = useState(String(box?.autoContributionDay ?? 5))
  const [yieldRate, setYieldRate] = useState(box?.yieldRate === undefined ? '' : String(box.yieldRate).replace('.', ','))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  const targetKey = hasTarget ? `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}` : undefined
  const suggestedCents = useMemo(() => {
    const draft: Box = {
      id: 'rascunho',
      name: name || 'Caixinha',
      color,
      balanceCents: parseAmountToCents(balance) ?? 0,
      goalCents: parseAmountToCents(goal) ?? 0,
      targetMonth: targetKey,
    }
    return planBoxGoal(draft, draft.balanceCents)?.monthlyContributionCents ?? 0
  }, [balance, color, goal, name, targetKey])

  const yearOptions = useMemo(() => {
    const options = new Set<number>([currentYear - 1, currentYear, currentYear + 1, currentYear + 2, targetYear])
    return [...options].filter((year) => year >= 1900 && year <= 2200).sort((a, b) => a - b)
  }, [currentYear, targetYear])

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
    const autoContributionCents = parseAmountToCents(autoAmount) ?? 0
    const day = Number(autoDay)
    const rate = yieldRate.trim() ? Number(yieldRate.replace(',', '.')) : undefined

    if (!name.trim()) return setError('Dê um nome para a caixinha.')
    if (rate !== undefined && (!Number.isFinite(rate) || rate < -99 || rate > 1000)) {
      return setError('Informe um rendimento entre -99% e 1000%.')
    }
    if (autoContributionCents > 0 && (!Number.isInteger(day) || day < 1 || day > 31)) {
      return setError('O dia do aporte deve estar entre 1 e 31.')
    }

    onSave({
      id: box?.id ?? createId(),
      name: name.trim(),
      color,
      balanceCents,
      goalCents,
      targetMonth: targetKey,
      targetDate: undefined,
      autoContributionCents: autoContributionCents > 0 ? autoContributionCents : undefined,
      autoContributionDay: autoContributionCents > 0 ? day : undefined,
      yieldRate: rate,
    })
  }

  return (
    <div
      className="modal-backdrop sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="caixinha-title" className="modal-card max-w-lg sm:rounded-[20px]">
        <header className="modal-header sm:px-6">
          <div>
            <h2 id="caixinha-title" className="text-xl font-extrabold text-slate-900">
              {box ? 'Editar caixinha' : 'Nova caixinha'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form id="caixinha-form" onSubmit={handleSubmit} className="modal-body space-y-4 sm:px-6">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="caixinha-saldo">Saldo base (R$)</label>
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

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1E3A5F]"
                checked={hasTarget}
                onChange={(event) => setHasTarget(event.target.checked)}
              />
              Definir mês/ano alvo
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                aria-label="Mês alvo"
                className="field !py-2 text-sm"
                value={targetMonth}
                disabled={!hasTarget}
                onChange={(event) => setTargetMonth(Number(event.target.value))}
              >
                {MONTH_NAMES.map((label, index) => (
                  <option key={label} value={index}>{label}</option>
                ))}
              </select>
              <select
                aria-label="Ano alvo"
                className="field !py-2 text-sm"
                value={targetYear}
                disabled={!hasTarget}
                onChange={(event) => setTargetYear(Number(event.target.value))}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="caixinha-aporte">Aporte mensal automático (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                <input
                  id="caixinha-aporte"
                  className="field money !pl-11"
                  inputMode="decimal"
                  value={autoAmount}
                  onChange={(event) => setAutoAmount(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="caixinha-dia-aporte">Dia do aporte</label>
              <input
                id="caixinha-dia-aporte"
                className="field money"
                inputMode="numeric"
                min={1}
                max={31}
                value={autoDay}
                onChange={(event) => setAutoDay(event.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {suggestedCents > 0
              ? `Sugestão pelo prazo: ${formatMoney(suggestedCents)} por mês.`
              : 'Deixe o aporte em 0,00 para apenas acompanhar a sugestão.'}
          </p>

          <div>
            <label className="label" htmlFor="caixinha-rendimento">Rendimento ao ano (opcional)</label>
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

          {error && (
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">{error}</p>
          )}
        </form>

        <footer className="modal-footer sm:px-6">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-soft min-h-11 flex-1">Cancelar</button>
            <button type="submit" form="caixinha-form" className="btn-primary min-h-11 flex-[2]">Salvar caixinha</button>
          </div>
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
              className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${
                confirmDelete ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-500 hover:text-navy'
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
