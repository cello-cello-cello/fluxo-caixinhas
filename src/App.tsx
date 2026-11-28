import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarRange, ChevronLeft, ChevronRight, CreditCard as CreditCardIcon, Database, PiggyBank } from 'lucide-react'
import { Caixinhas } from './components/Caixinhas'
import { CaixinhaModal } from './components/CaixinhaModal'
import { CartaoModal } from './components/CartaoModal'
import { Cartoes } from './components/Cartoes'
import { Dados } from './components/Dados'
import { FaturaImportModal } from './components/FaturaImportModal'
import { FluxoLogo } from './components/FluxoLogo'
import { FluxoAnual } from './components/FluxoAnual'
import type { ViewMode } from './components/FluxoAnual'
import { Graficos } from './components/Graficos'
import { LancamentoModal } from './components/LancamentoModal'
import { SenhaPdfModal } from './components/SenhaPdfModal'
import { SplashScreen } from './components/SplashScreen'
import { SummaryCards } from './components/SummaryCards'
import { boxTargetMonth } from './lib/boxes'
import { applyRecurrenceChange, calculateAnnualFlow, getCurrentPosition } from './lib/calc'
import { daysInMonth, isoDate, todayIso } from './lib/dates'
import { parseInvoiceDocument } from './lib/invoices'
import type { InstallmentFilter, InvoiceItemDraft, InvoiceParseResult } from './lib/invoices'
import { pdfPasswordIssue } from './lib/pdfPassword'
import {
  createDemoState,
  createId,
  createInitialState,
  downloadTextFile,
  exportBoxesCsv,
  exportJson,
  exportTransactionsCsv,
  loadState,
  parseJsonImport,
  parseTransactionsCsv,
  saveState,
} from './lib/storage'
import type { AppState, Box, CardInvoice, CreditCard, RecurrenceChange, Transaction, TransactionType } from './types'

type Tab = 'fluxo' | 'caixinhas' | 'cartoes' | 'graficos' | 'dados'

interface LaunchDraft {
  date: string
  transaction?: Transaction
  presetType?: TransactionType
  presetBoxId?: string
}

interface InvoiceDraft {
  card: CreditCard
  invoiceMonth: string
  items: InvoiceItemDraft[]
  rawText: string
  sections: string[]
  totalCents?: number
}

interface PasswordDraft {
  card: CreditCard
  file: File
  invoiceMonth: string
}

const TABS: { id: Tab; label: string; icon: typeof CalendarRange }[] = [
  { id: 'fluxo', label: 'Fluxo', icon: CalendarRange },
  { id: 'caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { id: 'cartoes', label: 'Cartões', icon: CreditCardIcon },
  { id: 'graficos', label: 'Gráficos', icon: BarChart3 },
  { id: 'dados', label: 'Dados', icon: Database },
]

function monthIndexOf(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return year * 12 + month - 1
}

function monthKeyFromIndex(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function buildAutoContribution(box: Box, stateYear: number): Transaction | null {
  const amountCents = box.autoContributionCents ?? 0
  if (amountCents <= 0) return null

  const today = todayIso()
  const currentYear = Number(today.slice(0, 4))
  const day = Math.max(1, Math.min(31, box.autoContributionDay ?? 1))
  const startYear = stateYear
  const startMonth = stateYear === currentYear ? Number(today.slice(5, 7)) - 1 : 0
  const targetMonth = boxTargetMonth(box)
  let startIndex = startYear * 12 + startMonth
  const targetIndex = targetMonth ? monthIndexOf(targetMonth) : null

  if (targetIndex !== null && targetIndex < startIndex) return null
  if (stateYear === currentYear && day < Number(today.slice(8, 10))) startIndex += 1
  if (targetIndex !== null && startIndex > targetIndex) {
    const date = isoDate(startYear, startMonth, Math.min(day, daysInMonth(startYear, startMonth)))
    return {
      id: `auto-${box.id}`,
      date,
      description: `Aporte automático · ${box.name}`,
      category: 'Caixinhas',
      type: 'guardar',
      amountCents,
      boxId: box.id,
      autoBoxId: box.id,
    }
  }

  const startKey = monthKeyFromIndex(startIndex)
  const [year, month] = startKey.split('-').map(Number)
  const recurring = targetIndex === null || targetIndex > startIndex

  return {
    id: `auto-${box.id}`,
    date: isoDate(year, month - 1, 1),
    description: `Aporte automático · ${box.name}`,
    category: 'Caixinhas',
    type: 'guardar',
    amountCents,
    boxId: box.id,
    autoBoxId: box.id,
    recurrenceDay: recurring ? day : undefined,
    recurrenceEnd: recurring ? targetMonth ?? undefined : undefined,
  }
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [demoBackup, setDemoBackup] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('fluxo')
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [focusedMonth, setFocusedMonth] = useState(() => new Date().getMonth())
  const [draft, setDraft] = useState<LaunchDraft | null>(null)
  const [boxDraft, setBoxDraft] = useState<{ box?: Box } | null>(null)
  const [cardDraft, setCardDraft] = useState<{ card?: CreditCard } | null>(null)
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft | null>(null)
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const finishSplash = useCallback(() => setShowSplash(false), [])

  useEffect(() => {
    if (demoBackup) return
    saveState(state)
  }, [state, demoBackup])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!draft && !boxDraft && !cardDraft && !invoiceDraft && !passwordDraft) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [draft, boxDraft, cardDraft, invoiceDraft, passwordDraft])

  const flow = useMemo(() => calculateAnnualFlow(state, state.year), [state])
  const position = useMemo(() => getCurrentPosition(state), [state])
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const planningFlow = useMemo(() => calculateAnnualFlow(state, currentYear), [state, currentYear])

  function changeYear(delta: number) {
    setState((previous) => ({ ...previous, year: previous.year + delta }))
    setToast(`Ano alterado para ${state.year + delta}.`)
  }

  function openMonth(month: number) {
    setFocusedMonth(month)
    setDraft({ date: isoDate(state.year, month, 1) })
  }

  function openTransfer(type: Extract<TransactionType, 'guardar' | 'resgatar'>, boxId: string) {
    const currentYear = new Date().getFullYear()
    const date = state.year === currentYear ? todayIso() : isoDate(state.year, 0, 1)
    setDraft({ date, presetType: type, presetBoxId: boxId })
  }

  function saveTransaction(transaction: Transaction, change?: RecurrenceChange) {
    const normalized: Transaction = {
      ...transaction,
      autoBoxId: transaction.type === 'guardar' ? transaction.autoBoxId : undefined,
    }
    setState((previous) => ({
      ...previous,
      transactions: change
        ? applyRecurrenceChange(previous.transactions, change, normalized)
        : previous.transactions.some((item) => item.id === normalized.id)
          ? previous.transactions.map((item) => (item.id === normalized.id ? normalized : item))
          : [...previous.transactions, normalized],
    }))
    setToast(
      change?.scope === 'single'
        ? 'Ocorrência salva. Demais meses mantidos.'
        : transaction.recurrenceDay
          ? 'Série recorrente salva. Meses seguintes recalculados.'
          : 'Lançamento salvo. Saldos recalculados em cascata.',
    )
  }

  function deleteTransaction(id: string, closeAfter = false, change?: RecurrenceChange) {
    const recurring = change !== undefined || state.transactions.some((item) => item.id === id && item.recurrenceDay !== undefined)
    setState((previous) => ({
      ...previous,
      transactions: change
        ? applyRecurrenceChange(previous.transactions, change)
        : previous.transactions.filter((item) => item.id !== id),
    }))
    if (closeAfter) setDraft(null)
    setToast(
      change?.scope === 'single'
        ? 'Ocorrência excluída. Demais meses mantidos.'
        : recurring
          ? 'Série recorrente excluída. Saldos recalculados.'
          : 'Lançamento excluído. Saldos recalculados.',
    )
  }

  function saveBox(box: Box) {
    setState((previous) => {
      const generated = buildAutoContribution(box, previous.year)
      return {
        ...previous,
        boxes: previous.boxes.some((item) => item.id === box.id)
          ? previous.boxes.map((item) => (item.id === box.id ? box : item))
          : [...previous.boxes, box],
        transactions: [
          ...previous.transactions.filter((item) => item.autoBoxId !== box.id),
          ...(generated ? [generated] : []),
        ],
      }
    })
    setBoxDraft(null)
    setToast('Caixinha salva.')
  }

  function useBestDepositDay(box: Box, day: number, amountCents: number) {
    saveBox({ ...box, autoContributionCents: amountCents, autoContributionDay: day })
    setToast(`Aporte automático ajustado para o dia ${day}.`)
  }

  function deleteBox(id: string) {
    if (state.transactions.some((transaction) => transaction.boxId === id && transaction.autoBoxId !== id)) {
      setBoxDraft(null)
      setToast('Não foi possível excluir: existem lançamentos vinculados a esta caixinha.')
      return
    }
    setState((previous) => ({
      ...previous,
      boxes: previous.boxes.filter((box) => box.id !== id),
      transactions: previous.transactions.filter((transaction) => transaction.boxId !== id),
    }))
    setBoxDraft(null)
    setToast('Caixinha excluída.')
  }

  function saveCard(card: CreditCard) {
    setState((previous) => ({
      ...previous,
      cards: previous.cards.some((item) => item.id === card.id)
        ? previous.cards.map((item) => (item.id === card.id ? card : item))
        : [...previous.cards, card],
    }))
    setCardDraft(null)
    setTab('cartoes')
    setToast('Cartão salvo na aba Cartões.')
  }

  function deleteCard(id: string) {
    setState((previous) => ({
      ...previous,
      cards: previous.cards.filter((card) => card.id !== id),
      cardInvoices: previous.cardInvoices.filter((invoice) => invoice.cardId !== id),
    }))
    setCardDraft(null)
    setTab('cartoes')
    setToast('Cartão excluído e faturas removidas.')
  }

  function openInvoice(card: CreditCard, invoiceMonth: string, parsed: InvoiceParseResult) {
    setInvoiceDraft({
      card,
      invoiceMonth,
      items: parsed.items,
      rawText: parsed.rawText,
      sections: parsed.sections,
      totalCents: parsed.totalCents,
    })
    setToast(
      parsed.items.length > 0
        ? `${parsed.items.length} lançamento(s) identificado(s). Confira antes de salvar.`
        : 'Nenhum lançamento identificado. Adicione manualmente na conferência.',
    )
  }

  async function importInvoicePdf(card: CreditCard, file: File, invoiceMonth: string) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setToast('Selecione um arquivo PDF.')
      return
    }

    try {
      const { readPdfInvoiceLines } = await import('./lib/pdfInvoice')
      const lines = await readPdfInvoiceLines(file)
      openInvoice(card, invoiceMonth, parseInvoiceDocument(lines, invoiceMonth))
    } catch (error) {
      if (pdfPasswordIssue(error) === 'need_password') {
        setPasswordDraft({ card, file, invoiceMonth })
        return
      }
      setToast('Não foi possível ler o PDF da fatura.')
    }
  }

  function unlockInvoice(parsed: InvoiceParseResult) {
    if (!passwordDraft) return
    openInvoice(passwordDraft.card, passwordDraft.invoiceMonth, parsed)
    setPasswordDraft(null)
  }

  function openManualInvoice(card: CreditCard) {
    const invoiceMonth = todayIso().slice(0, 7)
    setInvoiceDraft({
      card,
      invoiceMonth,
      items: [{
        id: createId(),
        description: '',
        amountCents: 0,
        currentInstallment: 1,
        installmentCount: 1,
      }],
      rawText: '',
      sections: [],
    })
  }

  function saveInvoice(items: InvoiceItemDraft[], filter: InstallmentFilter, totalCents?: number) {
    if (!invoiceDraft) return
    const { card, invoiceMonth } = invoiceDraft
    const invoice: CardInvoice = {
      id: `${card.id}:${invoiceMonth}`,
      cardId: card.id,
      invoiceMonth,
      items,
      rawText: invoiceDraft.rawText,
      sections: invoiceDraft.sections,
      totalCents,
      fromMonth: filter.fromMonth,
    }

    setState((previous) => ({
      ...previous,
      cardInvoices: [
        ...previous.cardInvoices.filter(
          (item) => !(item.cardId === card.id && item.invoiceMonth === invoiceMonth),
        ),
        invoice,
      ],
    }))
    setInvoiceDraft(null)
    setTab('cartoes')
    setToast(`${items.length} lançamento(s) salvo(s) apenas na aba Cartões.`)
  }

  function updateSettings(year: number, initialBalanceCents: number) {
    setState((previous) => ({ ...previous, year, initialBalanceCents }))
    setToast('Configurações salvas.')
  }

  function toggleDemo() {
    if (demoBackup) {
      setState(demoBackup)
      setDemoBackup(null)
      setFocusedMonth(new Date().getMonth())
      setToast('Você voltou aos seus dados.')
      return
    }
    setDemoBackup(state)
    setState(createDemoState(new Date().getFullYear()))
    setFocusedMonth(new Date().getMonth())
    setToast('Modo demonstração ativado. Seus dados ficaram preservados.')
  }

  async function importJson(file: File) {
    const imported = parseJsonImport(await file.text())
    if (!imported) {
      setToast('JSON inválido. Nada foi alterado.')
      return
    }
    setState(imported)
    setFocusedMonth(new Date().getMonth())
    setToast('JSON importado com sucesso.')
  }

  async function importCsv(file: File) {
    const parsed = parseTransactionsCsv(await file.text(), state)
    if (!parsed) {
      setToast('CSV inválido. Use as colunas data;tipo;valor.')
      return
    }
    setState((previous) => ({
      ...previous,
      transactions: [
        ...previous.transactions.filter((item) => !item.date.startsWith(`${previous.year}-`)),
        ...parsed.transactions,
      ],
    }))
    setToast(`${parsed.transactions.length} lançamento(s) importado(s)${parsed.skipped ? ` · ${parsed.skipped} ignorado(s)` : ''}.`)
  }

  function reset() {
    setState(createInitialState())
    setDemoBackup(null)
    setFocusedMonth(new Date().getMonth())
    setDraft(null)
    setBoxDraft(null)
    setCardDraft(null)
    setInvoiceDraft(null)
    setPasswordDraft(null)
    setToast('Dados limpos.')
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#E6EAF0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <FluxoLogo size={44} className="shrink-0 shadow-lift" />
            <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight">Fluxo</h1>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-[#E6EAF0] bg-white p-1 shadow-soft">
            <button
              type="button"
              onClick={() => changeYear(-1)}
              aria-label="Ano anterior"
              className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="money w-14 text-center text-sm font-extrabold text-slate-800">{state.year}</span>
            <button
              type="button"
              onClick={() => changeYear(1)}
              aria-label="Próximo ano"
              className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[73px] z-10 hidden border-b border-[#E6EAF0] bg-white/90 backdrop-blur-xl sm:block" aria-label="Navegação principal">
        <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-bold transition ${
                  tab === item.id ? 'border-navy text-navy' : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon size={16} /> {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-32 pt-6 sm:px-6 sm:pb-12">
        {tab === 'fluxo' && (
          <>
            <SummaryCards flow={flow} position={position} />
            <FluxoAnual
              flow={flow}
              focusedMonth={focusedMonth}
              onFocusedMonth={setFocusedMonth}
              viewMode={viewMode}
              onViewMode={setViewMode}
              onOpenDay={(date) => setDraft({ date })}
              onOpenMonth={openMonth}
              onEditTransaction={(transaction) => setDraft({ date: transaction.date, transaction })}
            />
          </>
        )}

        {tab === 'caixinhas' && (
          <Caixinhas
            state={state}
            position={position}
            monthFlow={planningFlow.months[currentMonth]}
            onAdd={() => setBoxDraft({})}
            onEdit={(box) => setBoxDraft({ box })}
            onDelete={(id) => {
              const box = state.boxes.find((item) => item.id === id)
              if (box) setBoxDraft({ box })
            }}
            onTransfer={openTransfer}
            onUseBestDay={useBestDepositDay}
          />
        )}

        {tab === 'cartoes' && (
          <Cartoes
            state={state}
            onAdd={() => setCardDraft({})}
            onEdit={(card) => setCardDraft({ card })}
            onDelete={(id) => {
              const card = state.cards.find((item) => item.id === id)
              if (card) setCardDraft({ card })
            }}
            onImportPdf={importInvoicePdf}
            onManual={openManualInvoice}
          />
        )}

        {tab === 'graficos' && <Graficos state={state} flow={flow} />}

        {tab === 'dados' && (
          <Dados
            state={state}
            demoActive={demoBackup !== null}
            onToggleDemo={toggleDemo}
            onSettings={updateSettings}
            onImportJson={importJson}
            onImportCsv={importCsv}
            onExportJson={() =>
              downloadTextFile(`fluxo-caixinhas-${todayIso()}.json`, exportJson(state), 'application/json')
            }
            onExportTransactionsCsv={() =>
              downloadTextFile(`lancamentos-${state.year}.csv`, exportTransactionsCsv(state), 'text/csv')
            }
            onExportBoxesCsv={() =>
              downloadTextFile(`caixinhas-${todayIso()}.csv`, exportBoxesCsv(state), 'text/csv')
            }
            onReset={reset}
          />
        )}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-[#E6EAF0] bg-white/95 backdrop-blur-xl sm:hidden" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center gap-1 py-3 text-[10px] font-bold transition ${
                  tab === item.id ? 'text-navy' : 'text-slate-400'
                }`}
              >
                <Icon size={19} strokeWidth={tab === item.id ? 2.6 : 2} />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      {draft && (
        <LancamentoModal
          key={`${draft.date}-${draft.transaction?.id ?? 'new'}-${draft.presetType ?? ''}-${draft.presetBoxId ?? ''}`}
          state={state}
          initialDate={draft.date}
          transaction={draft.transaction}
          presetType={draft.presetType}
          presetBoxId={draft.presetBoxId}
          onClose={() => setDraft(null)}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
        />
      )}

      {boxDraft && (
        <CaixinhaModal
          key={boxDraft.box?.id ?? 'new'}
          box={boxDraft.box}
          onClose={() => setBoxDraft(null)}
          onSave={saveBox}
          onDelete={deleteBox}
        />
      )}

      {cardDraft && (
        <CartaoModal
          key={cardDraft.card?.id ?? 'new'}
          card={cardDraft.card}
          onClose={() => setCardDraft(null)}
          onSave={saveCard}
          onDelete={deleteCard}
        />
      )}

      {invoiceDraft && (
        <FaturaImportModal
          key={`${invoiceDraft.card.id}-${invoiceDraft.invoiceMonth}`}
          card={invoiceDraft.card}
          invoiceMonth={invoiceDraft.invoiceMonth}
          items={invoiceDraft.items}
          rawText={invoiceDraft.rawText}
          invoiceTotalCents={invoiceDraft.totalCents}
          onClose={() => setInvoiceDraft(null)}
          onSave={saveInvoice}
        />
      )}

      {passwordDraft && (
        <SenhaPdfModal
          key={`${passwordDraft.card.id}-${passwordDraft.file.name}-${passwordDraft.invoiceMonth}`}
          card={passwordDraft.card}
          file={passwordDraft.file}
          invoiceMonth={passwordDraft.invoiceMonth}
          onClose={() => setPasswordDraft(null)}
          onUnlocked={unlockInvoice}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-28 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-[16px] bg-[#0F2942] px-4 py-3 text-center text-xs font-semibold text-white shadow-lift sm:bottom-6"
        >
          {toast}
        </div>
      )}

      {showSplash && <SplashScreen onFinish={finishSplash} />}
    </div>
  )
}
