import { useCallback, useEffect, useRef } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { daysInMonth, isWeekend, MONTH_NAMES, MONTH_SHORT, todayIso, weekdayShort } from '../lib/dates'
import { formatBRL, formatBRLCompact } from '../lib/money'
import type { AnnualFlow, Transaction } from '../types'

export type ViewMode = 'month' | 'year'

interface FluxoAnualProps {
  flow: AnnualFlow
  focusedMonth: number
  onFocusedMonth: (month: number) => void
  viewMode: ViewMode
  onViewMode: (mode: ViewMode) => void
  onOpenDay: (date: string) => void
  onOpenMonth: (month: number) => void
  onEditTransaction: (transaction: Transaction) => void
}

type MiniTone = 'moss' | 'navy' | 'coral' | 'auto'

const TONE_CLASS: Record<MiniTone, string> = {
  moss: 'text-[#4A6B53]',
  navy: 'text-[#1E3A5F]',
  coral: 'text-[#C0604D]',
  auto: '',
}

function balanceTone(value: number): string {
  return value < 0 ? 'text-[#C0604D]' : 'text-[#4A6B53]'
}

function negativeDaySurface(value: number): string {
  return value < 0 ? 'bg-[#FFF3EF] ring-1 ring-[#C0604D]/30' : ''
}

export function FluxoAnual({
  flow,
  focusedMonth,
  onFocusedMonth,
  viewMode,
  onViewMode,
  onOpenDay,
  onOpenMonth,
  onEditTransaction,
}: FluxoAnualProps) {
  const month = flow.months[focusedMonth]
  const monthStripRef = useRef<HTMLDivElement>(null)
  const today = todayIso()

  const scrollToMonth = useCallback((index: number) => {
    const button = monthStripRef.current?.querySelector<HTMLButtonElement>(`[data-month="${index}"]`)
    button?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [])

  useEffect(() => {
    scrollToMonth(focusedMonth)
  }, [focusedMonth, scrollToMonth])

  function moveMonth(delta: number) {
    const next = Math.min(11, Math.max(0, focusedMonth + delta))
    onFocusedMonth(next)
    scrollToMonth(next)
  }

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Ano de {flow.year}</h2>
        </div>
        <div className="inline-flex w-fit rounded-2xl border border-[#E6EAF0] bg-white p-1 shadow-soft" role="group" aria-label="Modo de visualização">
          {(
            [
              ['month', 'Mês focado'],
              ['year', 'Ano completo'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewMode(value)}
              aria-pressed={viewMode === value}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                viewMode === value ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          disabled={focusedMonth === 0}
          aria-label="Mês anterior"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#E6EAF0] bg-white text-[#1E3A5F] shadow-soft transition hover:border-[#1E3A5F] hover:bg-[#E9EFF5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={monthStripRef}
          className="no-scrollbar flex flex-1 touch-pan-x gap-2 overflow-x-auto scroll-smooth pb-1"
        >
          {flow.months.map((item) => (
            <button
              key={item.month}
              data-month={item.month}
              type="button"
              onClick={() => onFocusedMonth(item.month)}
              aria-label={`${MONTH_NAMES[item.month]}: fechamento ${formatBRL(item.closingBalanceCents)}`}
              aria-current={focusedMonth === item.month ? 'true' : undefined}
                className={`min-w-[104px] shrink-0 rounded-[14px] border bg-white px-4 py-3 text-left shadow-soft transition ${
                  focusedMonth === item.month
                    ? 'border-[#1E3A5F] bg-[#E9EFF5]'
                    : `border-[#E6EAF0] hover:border-[#1E3A5F] ${negativeDaySurface(item.closingBalanceCents)}`
                }`}
            >
              <span className={`block text-[11px] font-bold uppercase tracking-wide ${focusedMonth === item.month ? 'text-[#1E3A5F]' : 'text-slate-400'}`}>
                {MONTH_SHORT[item.month]}
              </span>
              <span className={`money mt-1 block text-xs font-extrabold ${balanceTone(item.closingBalanceCents)}`}>
                {formatBRLCompact(item.closingBalanceCents)}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => moveMonth(1)}
          disabled={focusedMonth === 11}
          aria-label="Próximo mês"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#E6EAF0] bg-white text-[#1E3A5F] shadow-soft transition hover:border-[#1E3A5F] hover:bg-[#E9EFF5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {viewMode === 'month' ? (
        <article className="card p-5 sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {MONTH_NAMES[month.month]} <span className="text-slate-300">·</span> {flow.year}
              </h3>
            </div>
            <button type="button" className="btn-primary !px-3 !py-2.5 text-xs" onClick={() => onOpenMonth(month.month)}>
              <Plus size={15} /> Novo
            </button>
          </header>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Entradas" value={month.incomeCents} tone="moss" />
            <MiniStat label="Saídas" value={month.expenseCents} tone="coral" />
            <MiniStat label="Para caixinhas" value={month.toBoxCents} tone="navy" />
            <MiniStat label="Fechamento" value={month.closingBalanceCents} tone="auto" />
          </div>

          <div className="mt-6 divide-y divide-[#E6EAF0] border-t border-[#E6EAF0]">
            {month.days.map((day) => {
              const weekday = weekdayShort(flow.year, month.month, day.day)
              const weekend = isWeekend(flow.year, month.month, day.day)
              const isToday = day.date === today

              return (
                <div key={day.date} className="py-2">
                  <button
                    type="button"
                    onClick={() => onOpenDay(day.date)}
                    aria-label={`${day.day} de ${MONTH_NAMES[month.month]}, ${weekday}${isToday ? ', hoje' : ''}: saldo ${formatBRL(day.balanceCents)}`}
                    className={`grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-transparent px-2.5 py-2.5 text-left transition hover:border-[#E6EAF0] hover:bg-white ${negativeDaySurface(day.balanceCents)}`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-content-center rounded-xl border text-center transition ${
                        isToday
                          ? 'border-[#1E3A5F] bg-[#E9EFF5]'
                          : weekend
                            ? 'border-[#F0DDD7] bg-[#FFF8F5]'
                            : 'border-[#E6EAF0] bg-[#F8FAFC]'
                      }`}
                    >
                      <span className={`text-sm font-extrabold leading-none ${isToday ? 'text-[#1E3A5F]' : weekend ? 'text-[#C0604D]' : 'text-slate-500'}`}>
                        {day.day}
                      </span>
                      <span className={`mt-0.5 text-[9px] font-bold leading-none ${weekend ? 'text-[#C0604D]' : 'text-slate-400'}`}>
                        {weekday}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${day.transactions.length === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                        {day.transactions.length === 0
                          ? '—'
                          : day.transactions.map((item) => item.description).slice(0, 2).join(', ')}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {day.incomeCents > 0 && (
                          <span className="chip bg-[#EEF4F0] text-[#4A6B53]">+ {formatBRLCompact(day.incomeCents)}</span>
                        )}
                        {day.expenseCents > 0 && (
                          <span className="chip bg-[#FFF3EF] text-[#C0604D]">− {formatBRLCompact(day.expenseCents)}</span>
                        )}
                        {(day.toBoxCents > 0 || day.fromBoxCents > 0) && (
                          <span className="chip bg-[#E9EFF5] text-[#1E3A5F]">Caixinha</span>
                        )}
                      </span>
                    </span>
                      <span className="text-right">
                        <span className={`money block text-sm font-extrabold ${balanceTone(day.balanceCents)}`}>
                          {formatBRL(day.balanceCents)}
                        </span>
                      </span>
                  </button>
                  {day.transactions.length > 0 && (
                    <div className="ml-14 mt-1 flex flex-wrap gap-1.5 pb-1">
                      {day.transactions.map((transaction) => (
                        <button
                          key={transaction.id}
                          type="button"
                          onClick={() => onEditTransaction(transaction)}
                          className="min-h-8 rounded-lg border border-[#E6EAF0] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-[#1E3A5F] hover:bg-white hover:text-[#1E3A5F]"
                        >
                          {transaction.description} · {formatBRLCompact(transaction.amountCents)}
                          {transaction.recurrenceDay
                            ? transaction.recurrenceEnd
                              ? ` · Mensal até ${transaction.recurrenceEnd.slice(5)}/${transaction.recurrenceEnd.slice(0, 4)}`
                              : ' · Mensal'
                            : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </article>
      ) : (
        <article className="card !p-3 sm:!p-6">
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays size={15} className="text-[#1E3A5F]" />
              Arraste para o lado para ver os 12 meses
            </p>
            <div className="hidden items-center gap-3 text-[11px] font-semibold text-slate-400 sm:flex">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#4A6B53]" /> entrada</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#C0604D]" /> saída</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#1E3A5F]" /> caixinha</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[16px] border border-[#E6EAF0] bg-white">
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead>
                    <tr className="bg-[#F1F5F9]">
                      <th scope="col" className="sticky left-0 z-10 w-16 bg-[#F1F5F9] px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">
                    Dia
                  </th>
                  {flow.months.map((item) => (
                    <th key={item.month} scope="col" className="min-w-[84px] px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onOpenMonth(item.month)}
                        className="text-[11px] font-extrabold uppercase tracking-wide text-[#1E3A5F] transition hover:text-[#0F2942]"
                        title={`Adicionar lançamento em ${MONTH_NAMES[item.month]}`}
                      >
                        {MONTH_SHORT[item.month]}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
                  const hasDay = day <= daysInMonth(flow.year, focusedMonth)
                  const rowWeekday = hasDay ? weekdayShort(flow.year, focusedMonth, day) : ''
                  const rowWeekend = hasDay && isWeekend(flow.year, focusedMonth, day)

                  return (
                    <tr key={day} className="border-t border-[#EEF2F6]">
                      <th scope="row" className="sticky left-0 z-10 bg-white/95 px-3 py-1.5 text-left backdrop-blur">
                        <span className="block text-[11px] font-bold text-slate-500">{String(day).padStart(2, '0')}</span>
                        <span className={`mt-0.5 block text-[9px] font-semibold ${rowWeekend ? 'text-[#C0604D]' : 'text-slate-400'}`}>
                          {rowWeekday}
                        </span>
                      </th>
                      {flow.months.map((item) => {
                        const dayFlow = day <= daysInMonth(flow.year, item.month) ? item.days[day - 1] : null
                        if (!dayFlow) {
                          return (
                            <td key={item.month} className="px-1 py-1.5 text-center">
                              <span className="block py-2 text-[11px] text-slate-200">—</span>
                            </td>
                          )
                        }

                        const weekday = weekdayShort(flow.year, item.month, day)
                        const weekend = isWeekend(flow.year, item.month, day)
                        const isToday = dayFlow.date === today

                        return (
                          <td key={item.month} className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => onOpenDay(dayFlow.date)}
                              aria-label={`${day} de ${MONTH_NAMES[item.month]}, ${weekday}${isToday ? ', hoje' : ''}: saldo ${formatBRL(dayFlow.balanceCents)}`}
                              className={`relative w-full rounded-xl px-1.5 py-1.5 transition hover:bg-[#E9EFF5] ${
                                dayFlow.balanceCents < 0
                                  ? negativeDaySurface(dayFlow.balanceCents)
                                  : isToday
                                    ? 'bg-[#E9EFF5] ring-1 ring-[#1E3A5F]'
                                    : dayFlow.transactions.length > 0
                                      ? 'bg-slate-50/70'
                                      : ''
                              }`}
                            >
                              <span className={`money block text-[10px] font-bold ${balanceTone(dayFlow.balanceCents)}`}>
                                {formatBRLCompact(dayFlow.balanceCents)}
                              </span>
                              <span className={`mt-0.5 block text-[9px] font-semibold ${weekend ? 'text-[#C0604D]' : 'text-slate-400'}`}>
                                {weekday}
                              </span>
                              <span className="mt-1 flex justify-center gap-1">
                                {dayFlow.incomeCents > 0 && <i className="h-1.5 w-1.5 rounded-full bg-[#4A6B53]" />}
                                {dayFlow.expenseCents > 0 && <i className="h-1.5 w-1.5 rounded-full bg-[#C0604D]" />}
                                {(dayFlow.toBoxCents > 0 || dayFlow.fromBoxCents > 0) && (
                                  <i className="h-1.5 w-1.5 rounded-full bg-[#1E3A5F]" />
                                )}
                              </span>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E6EAF0] bg-[#F1F5F9]">
                  <th scope="row" className="sticky left-0 z-10 bg-[#F1F5F9] px-3 py-3 text-[10px] font-extrabold uppercase text-[#1E3A5F]">
                    Fecha
                  </th>
                  {flow.months.map((item) => (
                    <td key={item.month} className={`money px-2 py-3 text-center text-[10px] font-extrabold ${balanceTone(item.closingBalanceCents)}`}>
                      {formatBRLCompact(item.closingBalanceCents)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      )}
    </section>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: MiniTone }) {
  return (
    <div className="rounded-[14px] border border-[#E6EAF0] bg-[#F8FAFC] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`money mt-1 text-base font-extrabold sm:text-lg ${tone === 'auto' ? balanceTone(value) : TONE_CLASS[tone]}`}>
        {formatBRL(value)}
      </p>
    </div>
  )
}
