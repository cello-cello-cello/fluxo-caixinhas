import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Pencil, PiggyBank, Trash2, Undo2, X } from 'lucide-react'
import { availableFor, expandTransactions, occurrenceMonthKey, resolveBaseId } from '../lib/calc'
import { CATEGORIES, TRANSACTION_TYPES } from '../lib/constants'
import { formatDate, formatFriendlyDate, isoDate, MONTH_NAMES, parseIsoDate, previousBusinessDayIso } from '../lib/dates'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { usePrivacy } from '../lib/privacy'
import { createId } from '../lib/storage'
import type { AppState, RecurrenceChange, RecurrenceScope, Transaction, TransactionType } from '../types'

interface LancamentoModalProps {
  state: AppState
  initialDate: string
  transaction?: Transaction
  presetType?: TransactionType
  presetBoxId?: string
  onClose: () => void
  onSave: (transaction: Transaction, change?: RecurrenceChange) => void
  onDelete: (id: string, closeAfter?: boolean, change?: RecurrenceChange) => void
}

const TYPE_ICONS: Record<TransactionType, typeof ArrowDownLeft> = {
  entrada: ArrowDownLeft,
  saida: ArrowUpRight,
  guardar: PiggyBank,
  resgatar: Undo2,
}

const TYPE_LABELS = Object.fromEntries(
  TRANSACTION_TYPES.map((option) => [option.value, option.label]),
) as Record<TransactionType, string>

const SHORT_TYPE_LABELS: Record<TransactionType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  guardar: 'Guardar',
  resgatar: 'Resgatar',
}

const TYPE_STYLES: Record<TransactionType, { active: string; idle: string; surface: string; text: string }> = {
  entrada: {
    active: 'border-[#4A6B53] bg-[#EEF4F0] text-[#3A5743]',
    idle: 'border-slate-200 text-slate-500 hover:border-[#4A6B53] hover:text-[#3A5743]',
    surface: 'bg-[#EEF4F0] text-[#3A5743]',
    text: 'text-[#3A5743]',
  },
  saida: {
    active: 'border-[#C0604D] bg-[#FFF3EF] text-[#A64B39]',
    idle: 'border-slate-200 text-slate-500 hover:border-[#C0604D] hover:text-[#A64B39]',
    surface: 'bg-[#FFF3EF] text-[#A64B39]',
    text: 'text-[#A64B39]',
  },
  guardar: {
    active: 'border-[#1E3A5F] bg-[#E9EFF5] text-[#1E3A5F]',
    idle: 'border-slate-200 text-slate-500 hover:border-[#1E3A5F] hover:text-[#1E3A5F]',
    surface: 'bg-[#E9EFF5] text-[#1E3A5F]',
    text: 'text-[#1E3A5F]',
  },
  resgatar: {
    active: 'border-[#1E3A5F] bg-[#E9EFF5] text-[#1E3A5F]',
    idle: 'border-slate-200 text-slate-500 hover:border-[#1E3A5F] hover:text-[#1E3A5F]',
    surface: 'bg-[#E9EFF5] text-[#1E3A5F]',
    text: 'text-[#1E3A5F]',
  },
}

function defaultRecurrenceEnd(date: string): string {
  const parsed = parseIsoDate(date)
  return `${(parsed?.year ?? new Date().getFullYear()) + 1}-12`
}

function endMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function recurrenceEndLabel(end: string): string {
  return `${end.slice(5)}/${end.slice(0, 4)}`
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
  const { formatBRL: formatMoney, formatBRLCompact: formatMoneyCompact } = usePrivacy()
  const initialBaseId = transaction?.sourceId ?? transaction?.id ?? null
  const initialBase = transaction
    ? state.transactions.find((candidate) => candidate.id === initialBaseId) ?? transaction
    : undefined
  const initialEnd = initialBase?.recurrenceEnd ?? defaultRecurrenceEnd(initialBase?.date ?? initialDate)

  const [type, setType] = useState<TransactionType>(initialBase?.type ?? presetType ?? 'saida')
  const [date, setDate] = useState(transaction?.date ?? initialDate)
  const [description, setDescription] = useState(initialBase?.description ?? '')
  const [category, setCategory] = useState(initialBase?.category ?? 'Outros')
  const [amount, setAmount] = useState(initialBase ? centsToInput(initialBase.amountCents) : '')
  const [boxId, setBoxId] = useState(initialBase?.boxId ?? presetBoxId ?? state.boxes[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(initialBaseId)
  const [editingOccurrenceId, setEditingOccurrenceId] = useState<string | null>(
    initialBase?.recurrenceDay ? transaction?.id ?? null : null,
  )
  const [editingOccurrenceMonth, setEditingOccurrenceMonth] = useState<string | null>(
    initialBase?.recurrenceDay
      ? occurrenceMonthKey(transaction?.id ?? initialBase.id, initialBase.date)
      : null,
  )
  const [editingYear, setEditingYear] = useState<number | null>(
    transaction ? parseIsoDate(transaction.date)?.year ?? null : null,
  )
  const [repeatMonthly, setRepeatMonthly] = useState(initialBase?.recurrenceDay !== undefined)
  const [recurrenceDay, setRecurrenceDay] = useState<number | null>(initialBase?.recurrenceDay ?? null)
  const [endMonth, setEndMonth] = useState(() => {
    const month = Number(initialEnd.slice(5)) - 1
    return month >= 0 && month <= 11 ? month : 11
  })
  const [endYear, setEndYear] = useState(() => {
    const year = Number(initialEnd.slice(0, 4))
    return Number.isFinite(year) ? year : new Date().getFullYear() + 1
  })
  const [scope, setScope] = useState<RecurrenceScope>('series')
  const [adjustToBusinessDay, setAdjustToBusinessDay] = useState(initialBase?.adjustToBusinessDay === true)
  const firstField = useRef<HTMLInputElement>(null)

  const isTransfer = type === 'guardar' || type === 'resgatar'
  const minDate = isoDate(editingYear === null ? state.year : Math.min(state.year, editingYear), 0, 1)
  const maxDate = isoDate(editingYear === null ? state.year : Math.max(state.year, editingYear), 11, 31)
  const expandedTransactions = useMemo(() => expandTransactions(state.transactions), [state.transactions])
  const effectiveDate = useMemo(
    () => (adjustToBusinessDay ? previousBusinessDayIso(date) : date),
    [adjustToBusinessDay, date],
  )
  const available = useMemo(
    () => availableFor(state, effectiveDate, boxId, editingId ?? undefined),
    [state, effectiveDate, boxId, editingId],
  )

  const dayTransactions = useMemo(
    () => expandedTransactions.filter((item) => item.date === date).sort((a, b) => a.id.localeCompare(b.id)),
    [expandedTransactions, date],
  )

  const dayIncome = dayTransactions
    .filter((item) => item.type === 'entrada')
    .reduce((sum, item) => sum + item.amountCents, 0)
  const dayExpense = dayTransactions
    .filter((item) => item.type === 'saida')
    .reduce((sum, item) => sum + item.amountCents, 0)
  const dayToBox = dayTransactions
    .filter((item) => item.type === 'guardar')
    .reduce((sum, item) => sum + item.amountCents, 0)
  const dayFromBox = dayTransactions
    .filter((item) => item.type === 'resgatar')
    .reduce((sum, item) => sum + item.amountCents, 0)

  useEffect(() => {
    firstField.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function editingChange(): RecurrenceChange | undefined {
    if (!editingId || !editingOccurrenceId || !editingOccurrenceMonth) return undefined
    return {
      baseId: editingId,
      occurrenceId: editingOccurrenceId,
      occurrenceMonth: editingOccurrenceMonth,
      scope,
    }
  }

  function changeFor(item: Transaction): RecurrenceChange | undefined {
    const baseId = resolveBaseId(expandedTransactions, item.id)
    const base = state.transactions.find((candidate) => candidate.id === baseId)
    if (!base?.recurrenceDay) return undefined
    return {
      baseId,
      occurrenceId: item.id,
      occurrenceMonth: occurrenceMonthKey(item.id, base.date),
      scope,
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const amountCents = parseAmountToCents(amount)
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!amountCents) return setError('Informe um valor em R$ maior que zero.')
    const parsedDate = parseIsoDate(date)
    if (!parsedDate) return setError('Informe uma data válida.')
    if (parsedDate.year !== state.year && parsedDate.year !== editingYear) {
      return setError(`A data deve estar no ano de ${state.year}${editingYear === null ? '' : ` ou ${editingYear}`}.`)
    }
    const finalEnd = endMonthKey(endYear, endMonth)
    const startMonth = endMonthKey(parsedDate.year, parsedDate.month)
    if (repeatMonthly && finalEnd < startMonth) {
      return setError('O fim da repetição não pode ser anterior ao mês do lançamento.')
    }
    if (isTransfer && !boxId) return setError('Selecione uma caixinha.')

    if (type === 'guardar' && amountCents > available.freeCents) {
      return setError(`Saldo livre insuficiente. Disponível: ${formatMoney(available.freeCents)}.`)
    }
    if (type === 'resgatar' && amountCents > available.boxCents) {
      return setError(`A caixinha tem apenas ${formatMoney(available.boxCents)} disponíveis.`)
    }

    onSave(
      {
        id: editingId ?? createId(),
        date,
        description: description.trim(),
        category: isTransfer ? 'Caixinhas' : category,
        type,
        amountCents,
        boxId: isTransfer ? boxId : undefined,
        ...(type === 'saida' && initialBase?.cardId
          ? {
              cardId: initialBase.cardId,
              installmentGroupId: initialBase.installmentGroupId,
              installmentIndex: initialBase.installmentIndex,
              installmentCount: initialBase.installmentCount,
              invoiceMonth: initialBase.invoiceMonth,
            }
          : {}),
        recurrenceDay: repeatMonthly ? recurrenceDay ?? parsedDate.day : undefined,
        recurrenceEnd: repeatMonthly ? finalEnd : undefined,
        adjustToBusinessDay,
        autoBoxId: isTransfer && initialBase?.autoBoxId ? initialBase.autoBoxId : undefined,
      },
      editingChange(),
    )

    if (editingId) {
      onClose()
      return
    }

    setDescription('')
    setAmount('')
    setCategory('Outros')
    setPendingDeleteId(null)
  }

  function startEdit(item: Transaction) {
    const baseId = resolveBaseId(expandedTransactions, item.id)
    const base = state.transactions.find((candidate) => candidate.id === baseId) ?? item
    const recurring = base.recurrenceDay !== undefined
    const finalEnd = base.recurrenceEnd ?? defaultRecurrenceEnd(base.date)
    const endMonthValue = Number(finalEnd.slice(5)) - 1
    setEditingId(base.id)
    setEditingOccurrenceId(recurring ? item.id : null)
    setEditingOccurrenceMonth(recurring ? occurrenceMonthKey(item.id, base.date) : null)
    setEditingYear(parseIsoDate(item.date)?.year ?? parseIsoDate(base.date)?.year ?? null)
    setType(base.type)
    setDate(item.date)
    setDescription(base.description)
    setCategory(base.category)
    setAmount(centsToInput(base.amountCents))
    setBoxId(base.boxId ?? state.boxes[0]?.id ?? '')
    setRepeatMonthly(recurring)
    setRecurrenceDay(base.recurrenceDay ?? null)
    setEndMonth(endMonthValue >= 0 && endMonthValue <= 11 ? endMonthValue : 11)
    setEndYear(Number(finalEnd.slice(0, 4)) || new Date().getFullYear() + 1)
    setScope('series')
    setAdjustToBusinessDay(base.adjustToBusinessDay === true)
    setError(null)
    setConfirmDelete(false)
    setPendingDeleteId(null)
    firstField.current?.focus()
  }

  function deleteFromList(item: Transaction) {
    if (pendingDeleteId !== item.id) {
      if (changeFor(item)) setScope('series')
      setPendingDeleteId(item.id)
      return
    }
    onDelete(resolveBaseId(expandedTransactions, item.id), false, changeFor(item))
    setPendingDeleteId(null)
    if (editingId === item.id) onClose()
  }

  const pendingItem = dayTransactions.find((item) => item.id === pendingDeleteId)
  const showScope = Boolean(editingOccurrenceMonth || (pendingItem && changeFor(pendingItem)))

  return (
    <div
      className="modal-backdrop sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lancamento-title"
        className="modal-card max-w-lg sm:rounded-[20px]"
      >
        <header className="modal-header sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="lancamento-title" className="text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">
                {formatFriendlyDate(date)}
              </h2>
              {editingId && <span className="chip bg-navy-soft text-navy">Editando</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form id="lancamento-form" onSubmit={handleSubmit} className="modal-body space-y-4 sm:px-6">
          <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Lançamentos deste dia</h3>
            <span className="chip bg-white text-navy">
              {dayTransactions.length} {dayTransactions.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip money bg-[#EEF4F0] text-[#3A5743]">Entradas {formatMoneyCompact(dayIncome)}</span>
            <span className="chip money bg-[#FFF3EF] text-[#A64B39]">Saídas {formatMoneyCompact(dayExpense)}</span>
            {(dayToBox > 0 || dayFromBox > 0) && (
              <span className="chip money bg-[#E9EFF5] text-[#1E3A5F]">
                Caixinhas {formatMoneyCompact(dayToBox)} guard. / {formatMoneyCompact(dayFromBox)} resg.
              </span>
            )}
          </div>

          {dayTransactions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Nenhum lançamento neste dia. Cadastre quantos quiser abaixo.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {dayTransactions.map((item) => {
                const Icon = TYPE_ICONS[item.type]
                const positive = item.type === 'entrada' || item.type === 'resgatar'
                const style = TYPE_STYLES[item.type]
                const box = item.boxId ? state.boxes.find((candidate) => candidate.id === item.boxId) : undefined
                const pending = pendingDeleteId === item.id
                const base = state.transactions.find(
                  (candidate) => candidate.id === resolveBaseId(expandedTransactions, item.id),
                )
                const itemEnd = item.recurrenceEnd ?? defaultRecurrenceEnd(base?.date ?? item.date)

                return (
                  <li key={item.id} className={`flex items-center gap-2 py-2 ${editingId === item.id ? 'rounded-xl bg-[#E9EFF5] px-2' : ''}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${style.surface}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{item.description}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {item.category} · {TYPE_LABELS[item.type]}
                        {box ? ` · ${box.name}` : ''}
                        {item.recurrenceDay ? ` · Mensal até ${recurrenceEndLabel(itemEnd)}` : ''}
                      </p>
                    </div>
                    <span className={`money shrink-0 text-xs font-extrabold sm:text-sm ${style.text}`}>
                      {positive ? '+ ' : '− '}
                      {formatMoney(item.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Editar ${item.description}`}
                      aria-pressed={editingId === item.id}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#1E3A5F] ring-1 ring-slate-200 transition hover:bg-[#E9EFF5]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFromList(item)}
                      aria-label={pending ? `Confirmar exclusão de ${item.description}` : `Excluir ${item.description}`}
                      title={pending ? 'Confirmar exclusão' : 'Excluir'}
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                        pending
                          ? 'bg-[#0F2942] text-white shadow-md ring-2 ring-[#0F2942] ring-offset-2'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-[#0F2942]'
                      }`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          </section>

          <div>
            <span className="label">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              {TRANSACTION_TYPES.map((option) => {
                const Icon = TYPE_ICONS[option.value]
                const active = type === option.value
                const style = TYPE_STYLES[option.value]
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setType(option.value)
                      setError(null)
                    }}
                    aria-pressed={active}
                    className={`flex min-h-[48px] items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-bold transition ${active ? style.active : style.idle}`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="leading-tight">{SHORT_TYPE_LABELS[option.value]}</span>
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
                min={minDate}
                max={maxDate}
                onChange={(event) => {
                  setDate(event.target.value)
                  const parsed = parseIsoDate(event.target.value)
                  if (parsed) setRecurrenceDay(parsed.day)
                  setPendingDeleteId(null)
                }}
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#1E3A5F]/15 bg-[#E9EFF5]/60 px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-800" htmlFor="lancamento-recorrencia">
                <input
                  id="lancamento-recorrencia"
                  aria-label="Repetir mensalmente"
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#1E3A5F]"
                  checked={repeatMonthly}
                  onChange={(event) => setRepeatMonthly(event.target.checked)}
                />
                Repetir mensalmente
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-800" htmlFor="lancamento-dia-util">
                <input
                  id="lancamento-dia-util"
                  aria-label="Antecipar se cair no fim de semana"
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#1E3A5F]"
                  checked={adjustToBusinessDay}
                  onChange={(event) => setAdjustToBusinessDay(event.target.checked)}
                />
                Antecipar se cair no fim de semana
              </label>
              {adjustToBusinessDay && (
                <span className="money text-[11px] font-bold text-[#1E3A5F]">
                  Data efetiva: {formatDate(effectiveDate)}
                </span>
              )}
            </div>

            {repeatMonthly && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#1E3A5F]/15 bg-white px-3 py-2">
                <span className="text-xs font-bold text-slate-500">Repetir até:</span>
                <select
                  aria-label="Mês final da recorrência"
                  className="field !w-auto !py-1.5 text-xs"
                  value={endMonth}
                  onChange={(event) => setEndMonth(Number(event.target.value))}
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index}>{name}</option>
                  ))}
                </select>
                <select
                  aria-label="Ano final da recorrência"
                  className="field !w-auto !py-1.5 text-xs"
                  value={endYear}
                  onChange={(event) => setEndYear(Number(event.target.value))}
                >
                  {(() => {
                    const firstYear = Math.min(endYear, parseIsoDate(date)?.year ?? state.year)
                    const count = Math.max(21, endYear - firstYear + 1)
                    return Array.from({ length: count }, (_, index) => firstYear + index)
                      .filter((year) => year <= 2200)
                      .map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))
                  })()}
                </select>
              </div>
            )}

            {showScope && (
              <fieldset className="rounded-2xl border border-[#1E3A5F]/15 bg-white p-3.5">
                <legend className="label px-1">Aplicar alteração ou exclusão</legend>
                <div className="grid gap-2">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="recurrence-scope"
                      className="mt-1 accent-[#1E3A5F]"
                      checked={scope === 'single'}
                      onChange={() => setScope('single')}
                    />
                    <span>
                      <span className="block font-bold">Apenas este lançamento</span>
                      <span className="block text-[11px] text-slate-500">Os demais meses seguem a série original.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="recurrence-scope"
                      className="mt-1 accent-[#1E3A5F]"
                      checked={scope === 'series'}
                      onChange={() => setScope('series')}
                    />
                    <span>
                      <span className="block font-bold">Este e os próximos até o fim</span>
                      <span className="block text-[11px] text-slate-500">A alteração vale deste mês em diante.</span>
                    </span>
                  </label>
                </div>
              </fieldset>
            )}

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
              {[...new Set([...CATEGORIES.map((item) => item.name), ...state.transactions.map((item) => item.category)])].map((item) => (
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
                      {box.name} · {formatMoney(availableFor(state, effectiveDate, box.id, editingId ?? undefined).boxCents)}
                    </option>
                  ))}
                </select>
              )}
              <p className="money mt-2 text-xs text-slate-400">
                {type === 'guardar'
                  ? `Saldo livre disponível: ${formatMoneyCompact(available.freeCents)}`
                  : `Disponível na caixinha: ${formatMoneyCompact(available.boxCents)}`}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">
              {error}
            </p>
          )}

        </form>

        <footer className="modal-footer sm:px-6">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-soft min-h-11 flex-1">
              Fechar
            </button>
            <button type="submit" form="lancamento-form" className="btn-primary min-h-11 flex-[2]">
              {editingId ? 'Salvar alterações' : 'Adicionar ao dia'}
            </button>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                onDelete(editingId ?? '', true, editingChange())
              }}
              className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-extrabold transition ${
                confirmDelete
                  ? 'border-[#0F2942] bg-[#0F2942] text-white shadow-lift'
                  : 'border-slate-200 text-slate-600 hover:border-[#0F2942] hover:text-[#0F2942]'
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
