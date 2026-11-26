import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Database,
  PiggyBank,
  Waves,
} from 'lucide-react'
import { Caixinhas } from './components/Caixinhas'
import { CaixinhaModal } from './components/CaixinhaModal'
import { Dados } from './components/Dados'
import { FluxoAnual } from './components/FluxoAnual'
import type { ViewMode } from './components/FluxoAnual'
import { Graficos } from './components/Graficos'
import { LancamentoModal } from './components/LancamentoModal'
import { SummaryCards } from './components/SummaryCards'
import { calculateAnnualFlow, getCurrentPosition } from './lib/calc'
import { isoDate, todayIso } from './lib/dates'
import {
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
import type { AppState, Box, Transaction, TransactionType } from './types'

type Tab = 'fluxo' | 'caixinhas' | 'graficos' | 'dados'

interface LaunchDraft {
  date: string
  transaction?: Transaction
  presetType?: TransactionType
  presetBoxId?: string
}

const TABS: { id: Tab; label: string; icon: typeof CalendarRange }[] = [
  { id: 'fluxo', label: 'Fluxo', icon: CalendarRange },
  { id: 'caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { id: 'graficos', label: 'Gráficos', icon: BarChart3 },
  { id: 'dados', label: 'Dados', icon: Database },
]

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>('fluxo')
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [focusedMonth, setFocusedMonth] = useState(() => new Date().getMonth())
  const [draft, setDraft] = useState<LaunchDraft | null>(null)
  const [boxDraft, setBoxDraft] = useState<{ box?: Box } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => saveState(state), [state])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!draft && !boxDraft) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [draft, boxDraft])

  const flow = useMemo(() => calculateAnnualFlow(state, state.year), [state])
  const position = useMemo(() => getCurrentPosition(state), [state])

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

  function saveTransaction(transaction: Transaction) {
    setState((previous) => ({
      ...previous,
      transactions: previous.transactions.some((item) => item.id === transaction.id)
        ? previous.transactions.map((item) => (item.id === transaction.id ? transaction : item))
        : [...previous.transactions, transaction],
    }))
    setDraft(null)
    setToast('Lançamento salvo. Saldos recalculados em cascata.')
  }

  function deleteTransaction(id: string) {
    setState((previous) => ({
      ...previous,
      transactions: previous.transactions.filter((item) => item.id !== id),
    }))
    setDraft(null)
    setToast('Lançamento excluído.')
  }

  function saveBox(box: Box) {
    setState((previous) => ({
      ...previous,
      boxes: previous.boxes.some((item) => item.id === box.id)
        ? previous.boxes.map((item) => (item.id === box.id ? box : item))
        : [...previous.boxes, box],
    }))
    setBoxDraft(null)
    setToast('Caixinha salva.')
  }

  function deleteBox(id: string) {
    if (state.transactions.some((transaction) => transaction.boxId === id)) {
      setBoxDraft(null)
      setToast('Não foi possível excluir: existem lançamentos vinculados a esta caixinha.')
      return
    }
    setState((previous) => ({ ...previous, boxes: previous.boxes.filter((box) => box.id !== id) }))
    setBoxDraft(null)
    setToast('Caixinha excluída.')
  }

  function updateSettings(year: number, initialBalanceCents: number) {
    setState((previous) => ({ ...previous, year, initialBalanceCents }))
    setToast('Configurações salvas.')
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
    setFocusedMonth(new Date().getMonth())
    setDraft(null)
    setBoxDraft(null)
    setToast('Dados limpos.')
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-coral text-white shadow-lift">
              <Waves size={20} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight">Fluxo</h1>
              <p className="hidden truncate text-[11px] font-medium text-slate-400 sm:block">Caixinhas e fluxo de caixa</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50/70 p-1">
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

      <nav className="sticky top-[73px] z-10 hidden border-b border-slate-100 bg-white/85 backdrop-blur-xl sm:block" aria-label="Navegação principal">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
                  tab === item.id ? 'border-coral text-coral' : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon size={16} /> {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-4 px-4 pb-28 pt-5 sm:pb-12">
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
            onAdd={() => setBoxDraft({})}
            onEdit={(box) => setBoxDraft({ box })}
            onDelete={(id) => {
              const box = state.boxes.find((item) => item.id === id)
              if (box) setBoxDraft({ box })
            }}
            onTransfer={openTransfer}
          />
        )}

        {tab === 'graficos' && <Graficos state={state} flow={flow} position={position} />}

        {tab === 'dados' && (
          <Dados
            state={state}
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

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/90 backdrop-blur-xl sm:hidden" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
                  tab === item.id ? 'text-coral' : 'text-slate-400'
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

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-3 text-center text-xs font-semibold text-white shadow-2xl sm:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
