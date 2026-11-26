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
      setError('Informe um saldo inicial válido. Use 0 para começar do zero.')
      return
    }

    setError(null)
    onSettings(parsedYear, parsedBalance ?? 0)
  }

  return (
    <section>
      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">Seu arquivo</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Dados</h2>
        <p className="mt-1 text-sm text-slate-500">Tudo fica no seu dispositivo e pode ser exportado quando quiser.</p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <Database size={17} className="text-coral" />
            <h3 className="text-[15px] font-bold text-slate-900">Configurações do ano</h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="config-ano">Ano</label>
                <input id="config-ano" type="number" className="field money" min={1900} max={2200} value={year} onChange={(event) => setYear(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="config-saldo">Saldo livre em 01/jan (R$)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                  <input id="config-saldo" className="field money !pl-11" inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
                </div>
              </div>
            </div>
            {error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">{error}</p>}
            <button type="submit" className="btn-primary w-full sm:w-auto">Salvar configurações</button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            O saldo inicial é o ponto de partida do saldo livre. Transferências para caixinhas reduzem esse saldo, mas não contam como saída.
          </p>
        </article>

        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <Download size={17} className="text-mint-dark" />
            <h3 className="text-[15px] font-bold text-slate-900">Exportar</h3>
          </div>
          <div className="space-y-2">
            <button type="button" className="btn-soft w-full justify-start" onClick={onExportJson}>
              <FileJson size={16} className="text-coral" /> JSON completo (caixinhas + lançamentos)
            </button>
            <button type="button" className="btn-soft w-full justify-start" onClick={onExportTransactionsCsv}>
              <FileSpreadsheet size={16} className="text-mint-dark" /> CSV de lançamentos do ano
            </button>
            <button type="button" className="btn-soft w-full justify-start" onClick={onExportBoxesCsv}>
              <FileSpreadsheet size={16} className="text-indigo-500" /> CSV de caixinhas
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            O CSV usa ponto e vírgula como separador e valor com vírgula decimal, pronto para planilhas em pt-BR.
          </p>
        </article>

        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <Upload size={17} className="text-indigo-500" />
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
            <button type="button" className="btn-soft w-full justify-start" onClick={() => jsonInput.current?.click()}>
              <FileJson size={16} className="text-coral" /> JSON (substitui todos os dados)
            </button>
            <button type="button" className="btn-soft w-full justify-start" onClick={() => csvInput.current?.click()}>
              <FileSpreadsheet size={16} className="text-mint-dark" /> CSV (substitui lançamentos do ano)
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Colunas aceitas no CSV: data;descricao;categoria;tipo;valor;caixinha_id;caixinha_nome.
          </p>
        </article>

        <article className="card">
          <div className="mb-4 flex items-center gap-2">
            <RotateCcw size={17} className="text-slate-500" />
            <h3 className="text-[15px] font-bold text-slate-900">Recomeçar</h3>
          </div>
          <p className="text-sm text-slate-500">Apaga caixinhas e lançamentos deste dispositivo e volta ao ano atual.</p>
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
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition sm:w-auto ${
              confirmReset ? 'border-coral bg-coral text-white' : 'border-slate-200 text-slate-500 hover:text-coral'
            }`}
          >
            <RotateCcw size={16} /> {confirmReset ? 'Confirmar limpeza' : 'Limpar todos os dados'}
          </button>
        </article>
      </div>
    </section>
  )
}
