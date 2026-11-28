export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const WEEKDAY_SHORT = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'] as const

export const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function weekdayShort(year: number, month: number, day: number): string {
  return WEEKDAY_SHORT[new Date(year, month, day).getDay()]
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = new Date(year, month, day).getDay()
  return weekday === 0 || weekday === 6
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return false
  return day >= 1 && day <= daysInMonth(year, month - 1)
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  if (!isValidIsoDate(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return { year, month: month - 1, day }
}

export function todayIso(): string {
  const now = new Date()
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

export function dateToIso(date: Date): string {
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDaysIso(value: string, days: number): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  const date = new Date(parsed.year, parsed.month, parsed.day)
  date.setDate(date.getDate() + days)
  return dateToIso(date)
}

export function previousBusinessDayIso(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  const date = new Date(parsed.year, parsed.month, parsed.day)
  if (date.getDay() === 6) date.setDate(date.getDate() - 1)
  if (date.getDay() === 0) date.setDate(date.getDate() - 2)
  return dateToIso(date)
}

export function previousBusinessDayInMonthIso(year: number, month: number, day: number): string {
  let current = Math.max(1, Math.min(day, daysInMonth(year, month)))
  while (current > 1 && isWeekend(year, month, current)) current -= 1
  return isoDate(year, month, current)
}

export function formatDate(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  return `${String(parsed.day).padStart(2, '0')} ${MONTH_SHORT[parsed.month]} ${parsed.year}`
}

export function monthYearLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} de ${year}`
}

export function formatFriendlyDate(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  const weekday = WEEKDAY_LONG[new Date(parsed.year, parsed.month, parsed.day).getDay()]
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return `${String(parsed.day).padStart(2, '0')} de ${MONTH_NAMES[parsed.month]} · ${label}`
}
