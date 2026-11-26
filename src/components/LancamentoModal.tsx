import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Pencil, PiggyBank, Trash2, Undo2, X } from 'lucide-react'
import { availableFor, expandTransactions, resolveBaseId } from '../lib/calc'
import { CATEGORIES, categoryColor, CHART_COLORS, TRANSACTION_TYPES } from '../lib/constants'
import { formatDate, isoDate, parseIsoDate, previousBusinessDayIso } from '../lib/dates'
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
  onDelete: (id: string, closeAfter?: boolean) => void
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(transaction?.sourceId ?? transaction?.id ?? null)
  const [editingYear, setEditingYear] = useState<number | null>(
    transaction ? parseIsoDate(transaction.date)?.year ?? null : null,
  )
  const [repeatMonthly, setRepeatMonthly] = useState(transaction?.recurrenceDay !== undefined)
  const [adjustToBusinessDay, setAdjustToBusinessDay] = useState(transaction?.adjustToBusinessDay === true)
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
    if (isTransfer && !boxId) return setError('Selecione uma caixinha.')

    if (type === 'guardar' && amountCents > available.freeCents) {
      return setError(`Saldo livre insuficiente. Disponível: ${formatBRL(available.freeCents)}.`)
    }
    if (type === 'resgatar' && amountCents > available.boxCents) {
      return setError(`A caixinha tem apenas ${formatBRL(available.boxCents)} disponíveis.`)
    }

    onSave({
      id: editingId ?? createId(),
      date,
      description: description.trim(),
      category: isTransfer ? 'Caixinhas' : category,
      type,
      amountCents,
      boxId: isTransfer ? boxId : undefined,
      recurrenceDay: repeatMonthly ? parsedDate.day : undefined,
      adjustToBusinessDay,
    })

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
    setEditingId(baseId)
    setEditingYear(parseIsoDate(base.date)?.year ?? null)
    setType(base.type)
    setDate(base.date)
    setDescription(base.description)
    setCategory(base.category)
    setAmount(centsToInput(base.amountCents))
    setBoxId(base.boxId ?? state.boxes[0]?.id ?? '')
    setRepeatMonthly(base.recurrenceDay !== undefined)
    setAdjustToBusinessDay(base.adjustToBusinessDay === true)
    setError(null)
    setConfirmDelete(false)
    setPendingDeleteId(null)
    firstField.current?.focus()
  }

  function deleteFromList(item: Transaction) {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id)
      return
    }
    onDelete(resolveBaseId(expandedTransactions, item.id), false)
    setPendingDeleteId(null)
    if (editingId === item.id) onClose()
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
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">
              {editingId ? (repeatMonthly ? 'Editar série recorrente' : 'Editar lançamento') : 'Painel do dia'}
            </p>
            <h2 id="lancamento-title" className="money mt-1 text-xl font-extrabold text-slate-900">
              {state.year} · {date.slice(5).replace('-', '/')}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <section className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Lançamentos deste dia</h3>
            <span className="chip bg-white text-navy">
              {dayTransactions.length} {dayTransactions.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip money bg-[#EEF4F0] text-[#3A5743]">Entradas {formatBRLCompact(dayIncome)}</span>
            <span className="chip money bg-[#FFF3EF] text-[#A64B39]">Saídas {formatBRLCompact(dayExpense)}</span>
            {(dayToBox > 0 || dayFromBox > 0) && (
              <span className="chip money bg-[#E9EFF5] text-[#1E3A5F]">
                Caixinhas {formatBRLCompact(dayToBox)} guard. / {formatBRLCompact(dayFromBox)} resg.
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

                return (
                  <li key={item.id} className={`flex items-center gap-2 py-2.5 ${editingId === item.id ? 'rounded-xl bg-[#E9EFF5] px-2' : ''}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${style.surface}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{item.description}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {item.category} · {TYPE_LABELS[item.type]}
                        {box ? ` · ${box.name}` : ''}
                      </p>
                    </div>
                    <span className={`money shrink-0 text-xs font-extrabold sm:text-sm ${style.text}`}>
                      {positive ? '+ ' : '− '}
                      {formatBRL(item.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Editar ${item.description}`}
                      aria-pressed={editingId === item.id}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#1E3A5F] ring-1 ring-slate-200 transition hover:bg-[#E9EFF5]"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFromList(item)}
                      aria-label={pending ? `Confirmar exclusão de ${item.description}` : `Excluir ${item.description}`}
                      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 text-xs font-extrabold transition ${
                        pending
                          ? 'bg-[#0F2942] text-white shadow-md ring-2 ring-[#0F2942] ring-offset-2'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-[#0F2942]'
                      }`}
                    >
                      {pending ? <><Trash2 size={14} /> Confirmar</> : <Trash2 size={16} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Cada exclusão recalcula o dia, os meses seguintes e toda a cascata de saldos.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                    className={`flex min-h-[54px] items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-[11px] font-bold transition ${active ? style.active : style.idle}`}
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
                min={minDate}
                max={maxDate}
                onChange={(event) => {
                  setDate(event.target.value)
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
            <label
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#1E3A5F]/15 bg-[#E9EFF5]/60 p-3.5 transition hover:border-[#1E3A5F]/40"
              htmlFor="lancamento-recorrencia"
            >
              <input
                id="lancamento-recorrencia"
                aria-label="Repetir todo mês no dia selecionado"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A5F]"
                checked={repeatMonthly}
                onChange={(event) => setRepeatMonthly(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-bold text-slate-800">Repetir todo mês no dia selecionado</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                  Aplica até dezembro do ano seguinte. Em meses curtos, usa o último dia válido (28/29/30).
                  {adjustToBusinessDay ? ' Fins de semana são antecipados para sexta.' : ''}
                </span>
              </span>
            </label>

            <label
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#1E3A5F]/15 bg-white p-3.5 transition hover:border-[#1E3A5F]/40"
              htmlFor="lancamento-dia-util"
            >
              <input
                id="lancamento-dia-util"
                aria-label="Antecipar se cair em sábado ou domingo"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A5F]"
                checked={adjustToBusinessDay}
                onChange={(event) => setAdjustToBusinessDay(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-bold text-slate-800">Antecipar se cair em sábado ou domingo</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                  Sábado vira sexta; domingo vira sexta da semana anterior. Vale para o lançamento único e para a recorrência.
                </span>
                {adjustToBusinessDay && (
                  <span className="money mt-1 block text-[11px] font-bold text-[#1E3A5F]">
                    Data efetiva: {formatDate(effectiveDate)}
                  </span>
                )}
              </span>
            </label>
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="chip border border-slate-100 bg-white"
                style={{ color: isTransfer ? CHART_COLORS.navy : categoryColor(category) }}
              >
                <i
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isTransfer ? CHART_COLORS.navy : categoryColor(category) }}
                />
                {isTransfer ? 'Caixinhas' : category || 'Sem categoria'}
              </span>
              <span className="text-[11px] text-slate-400">Cor usada nos gráficos</span>
            </div>
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
                      {box.name} · {formatBRL(availableFor(state, effectiveDate, box.id, editingId ?? undefined).boxCents)}
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
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <button type="submit" className="btn-primary min-h-12 w-full sm:w-auto">
              {editingId ? 'Salvar alterações' : 'Adicionar ao dia'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    return
                  }
                  onDelete(editingId, true)
                }}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-extrabold transition sm:w-auto ${
                  confirmDelete
                    ? 'border-[#0F2942] bg-[#0F2942] text-white shadow-lift'
                    : 'border-slate-200 text-slate-600 hover:border-[#0F2942] hover:text-[#0F2942]'
                }`}
              >
                <Trash2 size={16} /> {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-soft min-h-12 w-full sm:w-auto">
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
