import { parseIsoDate, todayIso } from './dates'
import { formatBRL } from './money'
import type { Box } from '../types'

export function boxTargetMonth(box: Box): string | undefined {
  if (box.targetMonth && /^\d{4}-\d{2}$/.test(box.targetMonth)) return box.targetMonth
  return box.targetDate?.slice(0, 7)
}

export function boxTargetIso(box: Box): string | undefined {
  const month = boxTargetMonth(box)
  return month ? `${month}-01` : undefined
}

export function monthsUntil(targetDate: string, fromDate = todayIso()): number {
  const target = parseIsoDate(targetDate)
  const from = parseIsoDate(fromDate)
  if (!target || !from) return 0

  const months =
    (target.year - from.year) * 12 +
    (target.month - from.month) +
    (target.day - from.day) / 30

  return Math.max(0, months)
}

export function projectedBoxValue(balanceCents: number, yieldRate: number | undefined, targetDate?: string): number {
  if (!targetDate || !yieldRate || balanceCents <= 0) return balanceCents
  const years = monthsUntil(targetDate) / 12
  return Math.round(balanceCents * Math.pow(1 + yieldRate / 100, years))
}

export interface BoxGoalPlan {
  remainingCents: number
  monthsRemaining: number
  monthlyContributionCents: number
  achieved: boolean
  overdue: boolean
  hasTargetDate: boolean
}

export function planBoxGoal(box: Box, balanceCents: number, fromDate = todayIso()): BoxGoalPlan | null {
  if (box.goalCents <= 0) return null

  const targetMonth = boxTargetMonth(box)
  const fromMonth = fromDate.slice(0, 7)
  const targetIndex = targetMonth ? Number(targetMonth.slice(0, 4)) * 12 + Number(targetMonth.slice(5)) : null
  const fromIndex = Number(fromMonth.slice(0, 4)) * 12 + Number(fromMonth.slice(5))
  const monthsRemaining = targetIndex !== null ? Math.max(0, targetIndex - fromIndex) : 0
  const remainingCents = Math.max(0, box.goalCents - balanceCents)

  return {
    remainingCents,
    monthsRemaining,
    monthlyContributionCents: monthsRemaining > 0 ? Math.round(remainingCents / monthsRemaining) : remainingCents,
    achieved: balanceCents >= box.goalCents,
    overdue: Boolean(targetMonth && targetMonth < fromMonth),
    hasTargetDate: Boolean(targetMonth),
  }
}

export interface BestDepositDayResult {
  recommendedDay: number | null
  projectedMinBalance: number
  hasNegativeRisk: boolean
  reason: string
}

export function findBestDepositDay(
  contributionAmount: number,
  dailyFreeBalances: Record<number, number>,
  daysInMonth: number,
  formatMoney: (cents: number) => string = formatBRL,
): BestDepositDayResult {
  if (contributionAmount <= 0) {
    return {
      recommendedDay: null,
      projectedMinBalance: 0,
      hasNegativeRisk: false,
      reason: 'Meta já atingida ou sem aporte necessário.',
    }
  }

  let bestSafeDay: number | null = null
  let bestSafeMinAfter = -Infinity
  let fallbackDay = 1
  let fallbackMinAfter = -Infinity

  for (let day = 1; day <= daysInMonth; day += 1) {
    let minBalanceFromDay = Infinity

    for (let currentDay = day; currentDay <= daysInMonth; currentDay += 1) {
      const balanceAfterDeposit = (dailyFreeBalances[currentDay] ?? 0) - contributionAmount
      minBalanceFromDay = Math.min(minBalanceFromDay, balanceAfterDeposit)
    }

    if (minBalanceFromDay >= 0 && (bestSafeDay === null || minBalanceFromDay > bestSafeMinAfter)) {
      bestSafeDay = day
      bestSafeMinAfter = minBalanceFromDay
    }

    if (minBalanceFromDay > fallbackMinAfter) {
      fallbackDay = day
      fallbackMinAfter = minBalanceFromDay
    }
  }

  if (bestSafeDay !== null) {
    return {
      recommendedDay: bestSafeDay,
      projectedMinBalance: bestSafeMinAfter,
      hasNegativeRisk: false,
      reason: `Mantém o saldo livre positivo até o fim do mês (mínimo de ${formatMoney(bestSafeMinAfter)}).`,
    }
  }

  return {
    recommendedDay: fallbackDay,
    projectedMinBalance: fallbackMinAfter,
    hasNegativeRisk: true,
    reason: `Mesmo no melhor dia (${fallbackDay}), o saldo livre encosta em ${formatMoney(fallbackMinAfter)}.`,
  }
}
