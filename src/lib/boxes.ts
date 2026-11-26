import { parseIsoDate, todayIso } from './dates'

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
