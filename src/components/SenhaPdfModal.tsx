import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Lock, X } from 'lucide-react'
import { parseInvoiceDocument } from '../lib/invoices'
import type { InvoiceParseResult } from '../lib/invoices'
import { pdfPasswordIssue } from '../lib/pdfPassword'
import type { CreditCard } from '../types'

interface SenhaPdfModalProps {
  card: CreditCard
  file: File
  invoiceMonth: string
  onClose: () => void
  onUnlocked: (parsed: InvoiceParseResult) => void
}

export function SenhaPdfModal({ card, file, invoiceMonth, onClose, onUnlocked }: SenhaPdfModalProps) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  function handleClose() {
    setPassword('')
    setVisible(false)
    setError(null)
    onClose()
  }

  useEffect(() => {
    firstField.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPassword('')
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    setError(null)
    setBusy(true)

    try {
      const { readPdfInvoiceLines } = await import('../lib/pdfInvoice')
      const lines = await readPdfInvoiceLines(file, password)
      const parsed = parseInvoiceDocument(lines, invoiceMonth)
      setPassword('')
      setVisible(false)
      onUnlocked(parsed)
    } catch (caught) {
      const issue = pdfPasswordIssue(caught)
      if (issue === 'incorrect_password') {
        setError('Senha incorreta. Confira os dígitos e tente novamente.')
        setPassword('')
      } else if (issue === 'need_password') {
        setError('Este PDF exige senha. Digite a senha para continuar.')
      } else {
        setError('Não foi possível ler o PDF da fatura.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="senha-pdf-title" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-4xl bg-white p-5 shadow-2xl sm:rounded-4xl sm:p-7">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-soft text-navy">
              <Lock size={19} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">PDF protegido</p>
              <h2 id="senha-pdf-title" className="mt-1 text-xl font-extrabold text-slate-900">Senha da fatura</h2>
              <p className="mt-1 text-xs text-slate-500">{card.name} · {invoiceMonth}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="senha-pdf">Senha do PDF</label>
            <div className="relative">
              <input
                id="senha-pdf"
                ref={firstField}
                type={visible ? 'text' : 'password'}
                className="field money !pr-12"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a senha"
              />
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Informe a senha do arquivo, como os dígitos do CPF quando for esse o caso. Ela é usada apenas nesta leitura, em memória, e não é salva no aplicativo.
          </p>

          {error && (
            <p role="alert" className="rounded-2xl bg-[#FFF3EF] px-4 py-3 text-sm font-semibold text-[#A64B39]">{error}</p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
              {busy ? 'Abrindo...' : 'Tentar abrir'}
            </button>
            <button type="button" onClick={handleClose} className="btn-soft w-full sm:w-auto">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
