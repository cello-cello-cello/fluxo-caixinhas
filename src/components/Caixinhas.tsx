import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Pencil, PiggyBank, Sparkles, Target } from 'lucide-react'
import { Ring } from './Ring'
import { findBestDepositDay, planBoxGoal, projectedBoxValue } from '../lib/boxes'
import type { BoxGoalPlan } from '../lib/boxes'
import { formatDate } from '../lib/dates'
import { formatBRL, formatPercent } from '../lib/money'
import type { AppState, Box, MonthFlow, Position, TransactionType } from '../types'

interface CaixinhasProps {
  state: AppState
  position: Position
  monthFlow: MonthFlow
  onAdd: () => void
  onEdit: (box: Box) => void
  onDelete: (id: string) => void
  onTransfer: (type: Extract<TransactionType, 'guardar' | 'resgatar'>, boxId: string) => void
}

export function Caixinhas({ state, position, monthFlow, onAdd, onEdit, onDelete, onTransfer }: CaixinhasProps) {
  const cards = position.netWorthCents > 0 ? position.totalBoxCents / position.netWorthCents : 0
  const dailyFreeBalances = Object.fromEntries(monthFlow.days.map((day) => [day.day, day.balanceCents]))
  const daysInCurrentMonth = monthFlow.days.length

  return (
    <section>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-navy">Reservas separadas</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Caixinhas</h2>
          <p className="mt-1 text-sm text-slate-500">Guardar e resgatar nunca viram gasto de consumo.</p>
        </div>
        <button type="button" className="btn-primary w-fit" onClick={onAdd}>
          <PiggyBank size={17} /> Nova caixinha
        </button>
      </header>

      <div className="card mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo livre</p>
          <p className="money mt-1 text-lg font-extrabold text-slate-900">{formatBRL(position.freeBalanceCents)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Em caixinhas</p>
          <p className="money mt-1 text-lg font-extrabold text-[#1E3A5F]">{formatBRL(position.totalBoxCents)}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parcela reservada</p>
          <p className="money mt-1 text-lg font-extrabold text-moss-dark">{Math.round(cards * 100)}%</p>
        </div>
      </div>

      {state.boxes.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-navy-soft text-navy">
            <Sparkles size={26} />
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-slate-900">Sua primeira caixinha</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Crie reservas com metas, prazo e rendimento estimado sem confundir com o gasto do dia a dia.
          </p>
          <button type="button" className="btn-primary mt-5" onClick={onAdd}>
            Criar caixinha
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.boxes.map((box) => {
            const balance = position.boxBalances[box.id] ?? box.balanceCents
            const progress = box.goalCents > 0 ? balance / box.goalCents : 0
            const projection = projectedBoxValue(balance, box.yieldRate, box.targetDate)
            const gain = projection - balance
            const plan = planBoxGoal(box, balance)
            const suggestion = plan && !plan.achieved
              ? findBestDepositDay(plan.monthlyContributionCents, dailyFreeBalances, daysInCurrentMonth)
              : null

            return (
              <article key={box.id} className="card relative overflow-hidden pt-6">
                <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: box.color }} />
                <div className="flex items-start gap-4">
                  <Ring progress={progress} color={box.color} size={88} stroke={9} label={`Progresso de ${box.name}`}>
                    <span className="money text-sm font-extrabold" style={{ color: box.color }}>
                      {box.goalCents > 0 ? `${Math.min(999, Math.round(progress * 100))}%` : '—'}
                    </span>
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-base font-extrabold text-slate-900">{box.name}</h3>
                      <button
                        type="button"
                        onClick={() => onEdit(box)}
                        aria-label={`Editar ${box.name}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                    <p className="money mt-1 text-xl font-extrabold tracking-tight text-slate-900">{formatBRL(balance)}</p>
                    <p className="money mt-1 text-xs text-slate-400">
                      {box.goalCents > 0 ? `meta de ${formatBRL(box.goalCents)}` : 'sem meta definida'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
                  {box.targetDate && (
                    <p className="flex items-center gap-2 text-slate-500">
                      <CalendarDays size={14} className="text-slate-400" />
                      Alvo: {formatDate(box.targetDate)}
                    </p>
                  )}
                  {box.yieldRate !== undefined && (
                    <p className="flex items-center gap-2 text-moss-dark">
                      <Sparkles size={14} />
                      {formatPercent(box.yieldRate)} · projeção {formatBRL(projection)}
                      {gain > 0 && <span className="money font-bold">(+{formatBRL(gain)})</span>}
                    </p>
                  )}
                  {!box.targetDate && box.yieldRate === undefined && (
                    <p className="text-slate-400">Sem prazo ou rendimento definido.</p>
                  )}
                </div>

                {plan && (
                  <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Target size={13} /> Planejamento da meta
                      </p>
                      <span
                        className={`chip ${
                          plan.achieved
                            ? 'bg-moss-soft text-moss-dark'
                            : plan.overdue
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-navy-soft text-navy'
                        }`}
                      >
                        {plan.achieved ? 'Meta atingida' : plan.overdue ? 'Prazo vencido' : 'Em andamento'}
                      </span>
                    </div>
                    {!plan.achieved && (
                      <>
                        <p className="money mt-2 text-lg font-extrabold text-navy">
                          {formatBRL(plan.monthlyContributionCents)}
                          <span className="text-xs font-bold text-slate-400">{contributionPeriodLabel(plan)}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {goalDeadlineLabel(plan)} · {formatBRL(plan.remainingCents)} restantes
                        </p>
                      </>
                    )}
                    {suggestion && suggestion.recommendedDay !== null && (
                      <div className="mt-2 border-t border-slate-200 pt-2 text-[11px]">
                        <p className="font-bold text-moss-dark">
                          <CalendarDays size={12} className="mr-1 inline align-[-2px]" />
                          Melhor dia: {suggestion.recommendedDay}
                        </p>
                        <p className="mt-1 leading-relaxed text-slate-500">{suggestion.reason}</p>
                        {suggestion.hasNegativeRisk && (
                          <p className="mt-1 font-bold text-rose-700">O aporte compromete o caixa livre no período.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" className="btn-soft !px-2 text-[11px]" onClick={() => onTransfer('guardar', box.id)}>
                    <ArrowDownToLine size={14} /> Guardar
                  </button>
                  <button type="button" className="btn-soft !px-2 text-[11px]" onClick={() => onTransfer('resgatar', box.id)}>
                    <ArrowUpFromLine size={14} /> Resgatar
                  </button>
                  <button
                    type="button"
                    className="btn-soft !px-2 text-[11px] text-slate-400"
                    onClick={() => onDelete(box.id)}
                    aria-label={`Excluir ${box.name}`}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function contributionPeriodLabel(plan: BoxGoalPlan): string {
  if (!plan.hasTargetDate) return ' em uma vez'
  if (plan.monthsRemaining === 0) return ' neste mês'
  return '/mês'
}

function goalDeadlineLabel(plan: BoxGoalPlan): string {
  if (!plan.hasTargetDate) return 'sem prazo definido'
  if (plan.overdue) return 'prazo vencido'
  if (plan.monthsRemaining === 0) return 'mês atual'
  return `${plan.monthsRemaining} ${plan.monthsRemaining === 1 ? 'mês' : 'meses'} restantes`
}

