import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Pencil, PiggyBank, Sparkles, Target } from 'lucide-react'
import { Ring } from './Ring'
import { boxTargetIso, findBestDepositDay, planBoxGoal, projectedBoxValue } from '../lib/boxes'
import type { BoxGoalPlan } from '../lib/boxes'
import { expandTransactions } from '../lib/calc'
import { formatDate, MONTH_NAMES } from '../lib/dates'
import { formatPercent } from '../lib/money'
import { usePrivacy } from '../lib/privacy'
import type { AppState, Box, MonthFlow, Position, TransactionType } from '../types'

interface CaixinhasProps {
  state: AppState
  position: Position
  monthFlow: MonthFlow
  onAdd: () => void
  onEdit: (box: Box) => void
  onDelete: (id: string) => void
  onTransfer: (type: Extract<TransactionType, 'guardar' | 'resgatar'>, boxId: string) => void
  onUseBestDay: (box: Box, day: number, amountCents: number) => void
}

export function Caixinhas({ state, position, monthFlow, onAdd, onEdit, onDelete, onTransfer, onUseBestDay }: CaixinhasProps) {
  const { formatBRL: formatMoney } = usePrivacy()
  const cards = position.netWorthCents > 0 ? position.totalBoxCents / position.netWorthCents : 0
  const dailyFreeBalances = Object.fromEntries(monthFlow.days.map((day) => [day.day, day.balanceCents]))
  const daysInCurrentMonth = monthFlow.days.length
  const movements = expandTransactions(state.transactions)
    .filter((item) => item.boxId && (item.type === 'guardar' || item.type === 'resgatar'))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return (
    <section>
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Caixinhas</h2>
        </div>
        <button type="button" className="btn-primary w-fit" onClick={onAdd}>
          <PiggyBank size={17} /> Nova caixinha
        </button>
      </header>

      <div className="card mb-5 grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo livre</p>
          <p className="money mt-1 text-xl font-extrabold text-slate-900">{formatMoney(position.freeBalanceCents)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Em caixinhas</p>
          <p className="money mt-1 text-xl font-extrabold text-[#1E3A5F]">{formatMoney(position.totalBoxCents)}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Parcela reservada</p>
          <p className="money mt-1 text-xl font-extrabold text-moss-dark">{Math.round(cards * 100)}%</p>
        </div>
      </div>

      {state.boxes.length === 0 ? (
        <div className="card flex flex-col items-center p-8 py-12 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-navy-soft text-navy">
            <Sparkles size={26} />
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-slate-900">Sua primeira caixinha</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Crie reservas e acompanhe suas metas.</p>
          <button type="button" className="btn-primary mt-5" onClick={onAdd}>
            Criar caixinha
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {state.boxes.map((box) => {
            const balance = position.boxBalances[box.id] ?? box.balanceCents
            const progress = box.goalCents > 0 ? balance / box.goalCents : 0
            const projection = projectedBoxValue(balance, box.yieldRate, boxTargetIso(box))
            const gain = projection - balance
            const plan = planBoxGoal(box, balance)
            const contributionCents = box.autoContributionCents ?? plan?.monthlyContributionCents ?? 0
            const suggestion = plan && !plan.achieved && contributionCents > 0
              ? findBestDepositDay(contributionCents, dailyFreeBalances, daysInCurrentMonth, formatMoney)
              : null
            const history = movements.filter((item) => item.boxId === box.id).slice(0, 5)

            return (
              <article key={box.id} className="card relative overflow-hidden p-5 pt-6 sm:p-6 sm:pt-7">
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
                    <p className="money mt-1 text-xl font-extrabold tracking-tight text-slate-900">{formatMoney(balance)}</p>
                    <p className="money mt-1 text-xs text-slate-400">
                      {box.goalCents > 0 ? `meta de ${formatMoney(box.goalCents)}` : 'sem meta definida'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
                  {(box.targetMonth || box.targetDate) && (
                    <p className="flex items-center gap-2 text-slate-500">
                      <CalendarDays size={14} className="text-slate-400" />
                      Alvo: {targetMonthLabel(box.targetMonth ?? box.targetDate?.slice(0, 7))}
                    </p>
                  )}
                  {box.autoContributionCents ? (
                    <p className="money flex items-center gap-2 text-navy">
                      <Target size={14} />
                      Aporte automático: {formatMoney(box.autoContributionCents)} · dia {box.autoContributionDay ?? 1}
                    </p>
                  ) : null}
                  {box.yieldRate !== undefined && (
                    <p className="money flex items-center gap-2 text-moss-dark">
                      <Sparkles size={14} />
                      {formatPercent(box.yieldRate)} · projeção {formatMoney(projection)}
                      {gain > 0 && <span className="money font-bold">(+{formatMoney(gain)})</span>}
                    </p>
                  )}
                  {!box.targetMonth && !box.targetDate && box.yieldRate === undefined && (
                    <p className="text-slate-400">Sem prazo ou rendimento definido.</p>
                  )}
                </div>

                {plan && (
                  <div className="mt-4 rounded-2xl border border-[#E6EAF0] bg-[#F8FAFC] p-4">
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
                          {formatMoney(plan.monthlyContributionCents)}
                          <span className="text-xs font-bold text-slate-400">{contributionPeriodLabel(plan)}</span>
                        </p>
                        <p className="money mt-0.5 text-[11px] text-slate-500">
                          {goalDeadlineLabel(plan)} · {formatMoney(plan.remainingCents)} restantes
                        </p>
                      </>
                    )}
                    {suggestion && suggestion.recommendedDay !== null && (
                      <div className="mt-2 border-t border-slate-200 pt-2 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-moss-dark">
                            <CalendarDays size={12} className="mr-1 inline align-[-2px]" />
                            Melhor dia: {suggestion.recommendedDay}
                          </p>
                          <button
                            type="button"
                            onClick={() => onUseBestDay(box, suggestion.recommendedDay as number, contributionCents)}
                            className="rounded-lg bg-white px-2 py-1 font-bold text-navy ring-1 ring-slate-200 transition hover:bg-[#E9EFF5]"
                          >
                            Usar dia {suggestion.recommendedDay}
                          </button>
                        </div>
                        <p className="mt-1 leading-relaxed text-slate-500">{suggestion.reason}</p>
                        {suggestion.hasNegativeRisk && (
                          <p className="mt-1 font-bold text-rose-700">O aporte compromete o caixa livre no período.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 border-t border-[#E6EAF0] pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Histórico</p>
                  {history.length === 0 ? (
                    <p className="mt-1 text-[11px] text-slate-400">Sem aportes ou resgates.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {history.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="min-w-0 truncate text-slate-500">
                            {formatDate(item.date)} · {item.description}
                          </span>
                          <span className={`money shrink-0 font-bold ${item.type === 'guardar' ? 'text-navy' : 'text-moss-dark'}`}>
                            {item.type === 'guardar' ? '+' : '−'} {formatMoney(item.amountCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button type="button" className="btn-soft !px-2 text-[11px]" onClick={() => onTransfer('guardar', box.id)}>
                    <ArrowDownToLine size={14} /> Guardar
                  </button>
                  <button type="button" className="btn-soft !px-2 text-[11px]" onClick={() => onTransfer('resgatar', box.id)}>
                    <ArrowUpFromLine size={14} /> Resgatar
                  </button>
                  <button
                    type="button"
                    className="btn-soft col-span-2 !px-2 text-[11px] text-slate-400 sm:col-span-1"
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

function targetMonthLabel(value?: string): string {
  if (!value) return '—'
  const [year, month] = value.split('-').map(Number)
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} de ${year}` : value
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

