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

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
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

export function formatDate(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value
  return `${String(parsed.day).padStart(2, '0')} ${MONTH_SHORT[parsed.month]} ${parsed.year}`
}

export function monthYearLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} de ${year}`
}
