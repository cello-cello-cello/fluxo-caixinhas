import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Database, Download, FileJson, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { centsToInput, parseAmountToCents } from '../lib/money'
import type { AppState } from '../types'

interface DadosProps {
  state: AppState
  onSettings: (year: number, initialBalanceCents: number) => void
  onImportJson: (file: File) => void
  onImportCsv: (file: File) => void
  onExportJson: () => void
  onExportTransactionsCsv: () => void
  onExportBoxesCsv: () => void
  onReset: () => void
}

export function Dados({
  state,
  onSettings,
  onImportJson,
  onImportCsv,
  onExportJson,
  onExportTransactionsCsv,
  onExportBoxesCsv,
  onReset,
}: DadosProps) {
  const [year, setYear] = useState(String(state.year))
  const [balance, setBalance] = useState(centsToInput(state.initialBalanceCents))
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)

  useEffect(() => setYear(String(state.year)), [state.year])
  useEffect(() => setBalance(centsToInput(state.initialBalanceCents)), [state.initialBalanceCents])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedYear = Number(year)
    const parsedBalance = parseAmountToCents(balance)
    const zero = /^(0[.,]?0*)$/.test(balance.trim())

    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2200) {
      setError('Informe um ano entre 1900 e 2200.')
      return
    }
    if (!parsedBalance && !zero) {
      setError('Informe um saldo base válido. Use 0 para começar do zero.')
      return
    }

    setError(null)
    onSettings(parsedYear, parsedBalance ?? 0)
  }

  return (
    <section>
      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">Seu arquivo</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Dados</h2>
        <p className="mt-1 text-sm text-slate-500">Tudo fica no seu dispositivo e pode ser exportado quando quiser.</p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E9EFF5] text-[#1E3A5F]">
              <Database size={17} />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900">Configurações do ano</h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="config-ano">Ano</label>
                <input id="config-ano" type="number" className="field money" min={1900} max={2200} value={year} onChange={(event) => setYear(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="config-saldo">Saldo base do 1º ano (R$)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                  <input id="config-saldo" className="field money !pl-11" inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
                </div>
              </div>
            </div>
            {error && <p role="alert" className="rounded-2xl bg-navy-soft px-4 py-3 text-sm font-semibold text-navy">{error}</p>}
            <button type="submit" className="btn-primary w-full sm:w-auto">Salvar configurações</button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Esse saldo é o ponto de partida do 1º ano. A cada virada de dezembro para janeiro, o fechamento do ano anterior vira a abertura do ano seguinte, inclusive nas caixinhas.
          </p>
        </article>

        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF4F0] text-[#3A5743]">
              <Download size={17} />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900">Exportar</h3>
          </div>
          <div className="space-y-2">
            <button type="button" className="btn-soft w-full justify-start hover:border-[#1E3A5F]" onClick={onExportJson}>
              <FileJson size={16} className="text-[#1E3A5F]" /> JSON completo (caixinhas, cartões e lançamentos)
            </button>
            <button type="button" className="btn-soft w-full justify-start hover:border-[#3A5743]" onClick={onExportTransactionsCsv}>
              <FileSpreadsheet size={16} className="text-[#3A5743]" /> CSV de lançamentos do ano
            </button>
            <button type="button" className="btn-soft w-full justify-start hover:border-[#1E3A5F]" onClick={onExportBoxesCsv}>
              <FileSpreadsheet size={16} className="text-[#1E3A5F]" /> CSV de caixinhas
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            O CSV usa ponto e vírgula como separador e valor com vírgula decimal, pronto para planilhas em pt-BR.
          </p>
        </article>

        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E9EFF5] text-[#1E3A5F]">
              <Upload size={17} />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900">Importar</h3>
          </div>
          <input
            ref={jsonInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImportJson(file)
              event.target.value = ''
            }}
          />
          <input
            ref={csvInput}
            type="file"
            accept="text/csv,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImportCsv(file)
              event.target.value = ''
            }}
          />
          <div className="space-y-2">
            <button type="button" className="btn-soft w-full justify-start hover:border-[#1E3A5F]" onClick={() => jsonInput.current?.click()}>
              <FileJson size={16} className="text-[#1E3A5F]" /> JSON (substitui todos os dados)
            </button>
            <button type="button" className="btn-soft w-full justify-start hover:border-[#3A5743]" onClick={() => csvInput.current?.click()}>
              <FileSpreadsheet size={16} className="text-[#3A5743]" /> CSV (substitui lançamentos do ano)
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Colunas aceitas no CSV: data;descricao;categoria;tipo;valor;caixinha_id;caixinha_nome.
          </p>
        </article>

        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3EF] text-[#A64B39]">
              <RotateCcw size={17} />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900">Recomeçar</h3>
          </div>
          <p className="text-sm text-slate-500">Apaga caixinhas, cartões e lançamentos deste dispositivo e volta ao ano atual.</p>
          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true)
                return
              }
              onReset()
              setConfirmReset(false)
            }}
            className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-extrabold transition sm:w-auto ${
              confirmReset
                ? 'border-[#C0604D] bg-[#C0604D] text-white shadow-md ring-2 ring-[#C0604D] ring-offset-2'
                : 'border-slate-200 text-slate-600 hover:border-[#C0604D] hover:text-[#A64B39]'
            }`}
          >
            <RotateCcw size={16} /> {confirmReset ? 'Confirmar limpeza' : 'Limpar todos os dados'}
          </button>
        </article>
      </div>
    </section>
  )
}
