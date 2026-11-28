import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { classifyInvoiceItem, countPlannedTransactions, installmentDueDate } from '../lib/invoices'
import type { InstallmentFilter, InvoiceItemDraft } from '../lib/invoices'
import { formatDate, isValidIsoDate } from '../lib/dates'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { usePrivacy } from '../lib/privacy'
import { createId } from '../lib/storage'
import type { CreditCard, InvoiceItemKind } from '../types'

interface FaturaImportModalProps {
  card: CreditCard
  invoiceMonth: string
  items: InvoiceItemDraft[]
  rawText?: string
  invoiceTotalCents?: number
  onClose: () => void
  onSave: (items: InvoiceItemDraft[], filter: InstallmentFilter, totalCents?: number) => void
}

interface DraftRow extends InvoiceItemDraft {
  amountInput: string
  included: boolean
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function parseSignedAmount(raw: string): number | null {
  const value = raw.trim()
  const negative = /^[-−(]/.test(value) || /\)$/.test(value)
  const absolute = parseAmountToCents(value.replace(/^[-−(]|\)$/g, ''))
  if (absolute === null) return null
  return negative ? -absolute : absolute
}

export function FaturaImportModal({ card, invoiceMonth, items, rawText, invoiceTotalCents, onClose, onSave }: FaturaImportModalProps) {
  const { formatBRL: formatMoney } = usePrivacy()
  const [year, month] = invoiceMonth.split('-').map(Number)
  const defaultDueDate = card.dueDate ?? installmentDueDate(card, year, Math.max(0, month - 1))
  const [rows, setRows] = useState<DraftRow[]>(() => items.map((item) => ({
    ...item,
    amountInput: centsToInput(item.amountCents),
    dueDate: item.dueDate ?? defaultDueDate,
    included: true,
    kind: item.kind ?? classifyInvoiceItem(item),
  })))
  const [totalInput, setTotalInput] = useState(() => (
    invoiceTotalCents !== undefined ? centsToInput(invoiceTotalCents) : ''
  ))
  const [fromMonth, setFromMonth] = useState(invoiceMonth)
  const [onlyFrom, setOnlyFrom] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  const [fromYear, fromMonthNumber] = fromMonth.split('-').map(Number)
  const yearOptions = useMemo(() => {
    const base = Number(invoiceMonth.slice(0, 4))
    const current = new Date().getFullYear()
    return [...new Set([base - 1, base, base + 1, base + 2, base + 3, current])].sort((a, b) => a - b)
  }, [invoiceMonth])

  const effectiveFilter: InstallmentFilter = onlyFrom ? { fromMonth } : {}

  const selectedTotalCents = useMemo(() => rows.reduce(
    (sum, row) => sum + (row.included ? parseSignedAmount(row.amountInput) ?? 0 : 0),
    0,
  ), [rows])
  const parsedTotalCents = totalInput.trim() ? parseSignedAmount(totalInput) : null
  const totalDifferenceCents = parsedTotalCents !== null ? selectedTotalCents - parsedTotalCents : undefined

  const plannedCount = useMemo(() => {
    const valid = rows.flatMap((row) => {
      if (!row.included || !row.description.trim()) return []
      const amountCents = parseSignedAmount(row.amountInput)
      const currentInstallment = Math.trunc(Number(row.currentInstallment))
      const installmentCount = Math.trunc(Number(row.installmentCount))
      if (amountCents === null || !Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) return []
      if (!Number.isInteger(currentInstallment) || currentInstallment < 1 || currentInstallment > installmentCount) return []
      return [{
        id: row.id,
        description: row.description.trim(),
        amountCents,
        currentInstallment,
        installmentCount,
        kind: row.kind,
        purchaseDate: row.purchaseDate,
        dueDate: row.dueDate ?? defaultDueDate,
        source: row.source,
      }]
    })
    return countPlannedTransactions(card, valid, invoiceMonth, effectiveFilter.fromMonth)
  }, [card, defaultDueDate, effectiveFilter.fromMonth, invoiceMonth, rows])

  useEffect(() => {
    firstField.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function updateRow(id: string, changes: Partial<DraftRow>) {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...changes } : row)))
  }

  function addRow() {
    setRows((previous) => [...previous, {
      id: createId(),
      description: '',
      amountInput: '0,00',
      amountCents: 0,
      currentInstallment: 1,
      installmentCount: 1,
      kind: 'vista',
      dueDate: defaultDueDate,
      included: true,
    }])
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (rows.length === 0) return setError('Adicione pelo menos um lançamento da fatura.')

    const selected = rows.filter((row) => row.included)
    if (selected.length === 0) return setError('Selecione pelo menos um lançamento para importar.')

    if (totalInput.trim() && parsedTotalCents === null) {
      return setError('Informe um total da fatura em R$ válido.')
    }
    if (parsedTotalCents !== null && parsedTotalCents < 0) {
      return setError('O total da fatura não pode ser negativo.')
    }

    const parsed: InvoiceItemDraft[] = []
    for (const row of selected) {
      const amountCents = parseSignedAmount(row.amountInput)
      const currentInstallment = Math.trunc(Number(row.currentInstallment))
      const installmentCount = Math.trunc(Number(row.installmentCount))

      if (!row.description.trim()) return setError('Informe a descrição de todos os lançamentos selecionados.')
      if (amountCents === null) return setError('Informe um valor em R$ válido para todos os lançamentos selecionados.')
      if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
        return setError('O total de parcelas deve estar entre 1 e 36.')
      }
      if (!Number.isInteger(currentInstallment) || currentInstallment < 1 || currentInstallment > installmentCount) {
        return setError('A parcela atual deve estar entre 1 e o total de parcelas.')
      }
      if (row.purchaseDate && !isValidIsoDate(row.purchaseDate)) {
        return setError('Informe uma data de compra válida.')
      }
      if (!isValidIsoDate(row.dueDate)) return setError('Informe uma data de vencimento válida.')

      parsed.push({
        id: row.id,
        description: row.description.trim(),
        amountCents,
        currentInstallment,
        installmentCount,
        kind: row.kind,
        purchaseDate: row.purchaseDate,
        dueDate: row.dueDate ?? defaultDueDate,
        source: row.source,
      })
    }

    onSave(parsed, effectiveFilter, parsedTotalCents ?? undefined)
  }

  return (
    <div
      className="modal-backdrop sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="fatura-title" className="modal-card max-w-3xl sm:rounded-[20px]">
        <header className="modal-header sm:px-6">
          <div>
            <p className="modal-kicker">Conferência da fatura</p>
            <h2 id="fatura-title" className="mt-1 text-xl font-extrabold text-slate-900">
              {card.name} · {invoiceMonth}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {card.dueDate ? 'Parcelas no vencimento configurado.' : `Parcelas restantes no dia ${card.dueDay} de cada mês.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form id="fatura-form" onSubmit={handleSubmit} className="modal-body space-y-3 sm:px-6">
          <div className="rounded-2xl border border-navy/10 bg-navy-soft/50 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#1E3A5F]"
                checked={onlyFrom}
                onChange={(event) => setOnlyFrom(event.target.checked)}
              />
              <span>Apenas a partir do mês/ano escolhido (ignorar parcelas anteriores)</span>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="fatura-inicio-mes">Mês inicial</label>
                <select
                  id="fatura-inicio-mes"
                  className="field !py-2 text-sm"
                  value={fromMonthNumber}
                  onChange={(event) => setFromMonth(`${fromYear}-${String(Number(event.target.value)).padStart(2, '0')}`)}
                  disabled={!onlyFrom}
                >
                  {MONTHS.map((label, index) => (
                    <option key={label} value={index + 1}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fatura-inicio-ano">Ano inicial</label>
                <select
                  id="fatura-inicio-ano"
                  className="field !py-2 text-sm"
                  value={fromYear}
                  onChange={(event) => setFromMonth(`${Number(event.target.value)}-${String(fromMonthNumber).padStart(2, '0')}`)}
                  disabled={!onlyFrom}
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex items-end sm:col-span-1">
                <p className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-navy">
                  Prévia: {plannedCount} lançamento(s)
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Aplicar a partir de {MONTHS[fromMonthNumber - 1]}/{fromYear}
              {!onlyFrom && ' (desativado: todas as parcelas serão lançadas)'}.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="fatura-total-pdf">Total da fatura (R$)</label>
                <input
                  id="fatura-total-pdf"
                  className="field money !py-2 text-sm"
                  inputMode="decimal"
                  placeholder="Não detectado"
                  value={totalInput}
                  onChange={(event) => setTotalInput(event.target.value)}
                />
              </div>
              <div>
                <p className="label">Total lido no PDF</p>
                <p className="money mt-1 text-sm font-bold text-slate-700">
                  {invoiceTotalCents !== undefined ? formatMoney(invoiceTotalCents) : 'Não detectado'}
                </p>
              </div>
              <div>
                <p className="label">Total selecionado</p>
                <p className="money mt-1 text-sm font-bold text-navy">{formatMoney(selectedTotalCents)}</p>
              </div>
            </div>
            {totalDifferenceCents !== undefined && (
              <p className={`mt-2 text-[11px] font-bold ${totalDifferenceCents === 0 ? 'text-moss-dark' : 'text-rose-700'}`}>
                {totalDifferenceCents === 0
                  ? 'Conferência OK: selecionado = total da fatura.'
                  : `Diferença de ${formatMoney(Math.abs(totalDifferenceCents))} (${totalDifferenceCents > 0 ? 'acima' : 'abaixo'} do total). Você pode revisar e salvar assim mesmo.`}
              </p>
            )}
          </div>

          {rows.map((row, index) => (
            <div key={row.id} className={`rounded-2xl border border-slate-100 bg-slate-50/60 p-3 ${row.included ? '' : 'opacity-60'}`}>
              <label className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1E3A5F]"
                  checked={row.included}
                  onChange={(event) => updateRow(row.id, { included: event.target.checked })}
                  aria-label={`Incluir ${row.description || `lançamento ${index + 1}`}`}
                />
                Incluir na importação
              </label>
              <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                <div>
                  <label className="label" htmlFor={`fatura-descricao-${row.id}`}>Descrição</label>
                  <input
                    id={`fatura-descricao-${row.id}`}
                    ref={index === 0 ? firstField : undefined}
                    className="field !py-2 text-sm"
                    value={row.description}
                    maxLength={140}
                    onChange={(event) => updateRow(row.id, { description: event.target.value })}
                    required={row.included}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`fatura-valor-${row.id}`}>Valor da parcela (R$)</label>
                  <input
                    id={`fatura-valor-${row.id}`}
                    className="field money !py-2 text-sm"
                    inputMode="decimal"
                    value={row.amountInput}
                    onChange={(event) => updateRow(row.id, { amountInput: event.target.value })}
                    required={row.included}
                  />
                </div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor={`fatura-tipo-${row.id}`}>Classificação</label>
                  <select
                    id={`fatura-tipo-${row.id}`}
                    className="field !py-2 text-sm"
                    value={row.kind ?? 'vista'}
                    onChange={(event) => updateRow(row.id, { kind: event.target.value as InvoiceItemKind })}
                  >
                    <option value="vista">Compra à vista</option>
                    <option value="parcela">Parcela</option>
                    <option value="credito">Crédito/Pagamento</option>
                    <option value="encargo">Encargo/Juros/Multa/IOF</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <label className="label" htmlFor={`fatura-compra-${row.id}`}>Data da compra</label>
                  <input
                    id={`fatura-compra-${row.id}`}
                    type="date"
                    className="field money !py-2 text-sm"
                    value={row.purchaseDate ?? ''}
                    onChange={(event) => updateRow(row.id, { purchaseDate: event.target.value || undefined })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`fatura-atual-${row.id}`}>Parcela atual</label>
                  <input
                    id={`fatura-atual-${row.id}`}
                    className="field money !py-2 text-sm"
                    inputMode="numeric"
                    min={1}
                    value={row.currentInstallment}
                    onChange={(event) => updateRow(row.id, { currentInstallment: Number(event.target.value) })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`fatura-total-${row.id}`}>Total de parcelas</label>
                  <input
                    id={`fatura-total-${row.id}`}
                    className="field money !py-2 text-sm"
                    inputMode="numeric"
                    min={1}
                    value={row.installmentCount}
                    onChange={(event) => updateRow(row.id, { installmentCount: Number(event.target.value) })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`fatura-vencimento-${row.id}`}>Vencimento</label>
                  <input
                    id={`fatura-vencimento-${row.id}`}
                    type="date"
                    className="field money !py-2 text-sm"
                    value={row.dueDate ?? defaultDueDate}
                    onChange={(event) => updateRow(row.id, { dueDate: event.target.value })}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5 text-[11px] text-slate-400">
                  <p>{row.source ? `Origem: ${row.source}` : 'Origem não identificada no PDF'}</p>
                  <p>{row.purchaseDate ? `Compra em ${formatDate(row.purchaseDate)}` : 'Data da compra não identificada no PDF'}</p>
                  <p>Valor negativo = crédito ou pagamento.</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700"
                  onClick={() => setRows((previous) => previous.filter((item) => item.id !== row.id))}
                >
                  <Trash2 size={13} /> Remover
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="btn-soft w-full" onClick={addRow}>
            <Plus size={16} /> Adicionar lançamento manual
          </button>

          {rawText && (
            <details className="rounded-2xl border border-slate-100 bg-slate-50/60">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600">
                <ChevronDown size={14} /> Ver texto bruto do PDF
              </summary>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 text-[11px] leading-relaxed text-slate-500">
                {rawText}
              </pre>
            </details>
          )}

          {error && (
            <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">{error}</p>
          )}
        </form>

        <footer className="modal-footer sm:px-6">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-soft min-h-11 flex-1">Cancelar</button>
            <button type="submit" form="fatura-form" className="btn-primary min-h-11 flex-[2]">Salvar fatura e parcelas</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
