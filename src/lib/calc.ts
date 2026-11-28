import {
  daysInMonth,
  isoDate,
  parseIsoDate,
  previousBusinessDayInMonthIso,
  previousBusinessDayIso,
  todayIso,
} from './dates'
import type {
  AnnualFlow,
  AppState,
  Box,
  DayFlow,
  MonthFlow,
  Position,
  RecurrenceChange,
  Transaction,
} from '../types'

function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

function effectiveDate(date: string, adjustToBusinessDay?: boolean): string {
  return adjustToBusinessDay ? previousBusinessDayIso(date) : date
}

function recurrenceDate(year: number, month: number, day: number, adjustToBusinessDay?: boolean): string {
  const limit = daysInMonth(year, month)
  const targetDay = Math.min(day, limit)
  if (!adjustToBusinessDay) return isoDate(year, month, targetDay)
  if (day > limit) return previousBusinessDayInMonthIso(year, month, targetDay)
  return previousBusinessDayIso(isoDate(year, month, targetDay))
}

function parseMonthKey(value: string | undefined): { year: number; month: number } | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  if (month < 1 || month > 12) return null
  return { year, month }
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthIndex(key: string): number | null {
  const parsed = parseMonthKey(key)
  if (!parsed) return null
  return parsed.year * 12 + parsed.month - 1
}

function addMonths(key: string, delta: number): string | null {
  const index = monthIndex(key)
  if (index === null) return null
  const next = index + delta
  return monthKey(Math.floor(next / 12), ((next % 12) + 12) % 12 + 1)
}

function recurrenceEndKey(transaction: Transaction, parsed: { year: number; month: number }): string {
  const explicit = parseMonthKey(transaction.recurrenceEnd)
  return explicit ? monthKey(explicit.year, explicit.month) : monthKey(parsed.year + 1, 12)
}

export function occurrenceMonthKey(id: string, fallbackDate: string): string {
  const match = id.match(/:(\d{4}-\d{2})$/)
  return match?.[1] ?? fallbackDate.slice(0, 7)
}

function firstDateForMonth(key: string, day: number): string {
  const parsed = parseMonthKey(key)
  if (!parsed) return ''
  return isoDate(parsed.year, parsed.month - 1, Math.min(day, daysInMonth(parsed.year, parsed.month - 1)))
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function expandTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.flatMap((transaction) => {
    if (!transaction.recurrenceDay) {
      return [{ ...transaction, date: effectiveDate(transaction.date, transaction.adjustToBusinessDay) }]
    }
    const parsed = parseIsoDate(transaction.date)
    if (!parsed) return [transaction]

    const day = Math.max(1, Math.min(31, transaction.recurrenceDay))
    const occurrences: Transaction[] = []
    const startIndex = parsed.year * 12 + parsed.month
    const explicitEndIndex = monthIndex(recurrenceEndKey(transaction, parsed))
    const endIndex = explicitEndIndex === null ? startIndex : Math.max(startIndex, explicitEndIndex)

    for (let index = startIndex; index <= endIndex; index += 1) {
      const year = Math.floor(index / 12)
      const month = index % 12
      occurrences.push({
        ...transaction,
        id: index === startIndex ? transaction.id : `${transaction.id}:${monthKey(year, month + 1)}`,
        date: recurrenceDate(year, month, day, transaction.adjustToBusinessDay),
        sourceId: transaction.id,
      })
    }

    return occurrences
  })
}

export function resolveBaseId(transactions: Transaction[], id: string): string {
  return transactions.find((transaction) => transaction.id === id)?.sourceId ?? id
}

export function applyRecurrenceChange(
  transactions: Transaction[],
  change: RecurrenceChange,
  edited?: Transaction,
): Transaction[] {
  const base = transactions.find((transaction) => transaction.id === change.baseId)
  const unchanged = () => {
    if (!edited) return transactions.filter((transaction) => transaction.id !== change.baseId)
    return transactions.some((transaction) => transaction.id === edited.id)
      ? transactions.map((transaction) => (transaction.id === edited.id ? edited : transaction))
      : [...transactions, edited]
  }
  const parsed = base ? parseIsoDate(base.date) : null
  const occurrenceIndex = monthIndex(change.occurrenceMonth)
  if (!base || !base.recurrenceDay || !parsed || occurrenceIndex === null) return unchanged()

  const startIndex = parsed.year * 12 + parsed.month
  const endIndex = Math.max(startIndex, monthIndex(recurrenceEndKey(base, parsed)) ?? startIndex)
  if (occurrenceIndex < startIndex || occurrenceIndex > endIndex) return unchanged()

  const previousMonth = addMonths(change.occurrenceMonth, -1)
  const nextMonth = addMonths(change.occurrenceMonth, 1)
  const previousIndex = previousMonth ? monthIndex(previousMonth) : null
  const nextIndex = nextMonth ? monthIndex(nextMonth) : null
  const others = transactions.filter((transaction) => transaction.id !== base.id)
  const result: Transaction[] = []

  if (previousIndex !== null && previousIndex >= startIndex && previousMonth) {
    result.push({ ...base, recurrenceEnd: previousMonth })
  }

  if (change.scope === 'series' && edited) {
    result.push({
      ...edited,
      id: change.occurrenceId === base.id ? base.id : makeId(),
      sourceId: undefined,
    })
  }

  if (change.scope === 'single' && edited) {
    result.push({
      ...edited,
      id: change.occurrenceId,
      recurrenceDay: undefined,
      recurrenceEnd: undefined,
      sourceId: undefined,
    })
  }

  if (change.scope === 'single' && nextIndex !== null && nextIndex <= endIndex && nextMonth) {
    const day = Math.max(1, Math.min(31, base.recurrenceDay))
    result.push({
      ...base,
      id: makeId(),
      date: firstDateForMonth(nextMonth, day),
      recurrenceEnd: recurrenceEndKey(base, parsed),
    })
  }

  return [...result, ...others]
}

function matchesId(transaction: Transaction, id?: string): boolean {
  return !id || (transaction.sourceId ?? transaction.id) === id
}

function applyTransaction(
  transaction: Transaction,
  freeBalance: { value: number },
  boxBalances: Record<string, number>,
): void {
  const amount = transaction.amountCents

  switch (transaction.type) {
    case 'entrada':
      freeBalance.value += amount
      break
    case 'saida':
      freeBalance.value -= amount
      break
    case 'guardar':
      freeBalance.value -= amount
      if (transaction.boxId && transaction.boxId in boxBalances) {
        boxBalances[transaction.boxId] += amount
      }
      break
    case 'resgatar':
      freeBalance.value += amount
      if (transaction.boxId && transaction.boxId in boxBalances) {
        boxBalances[transaction.boxId] -= amount
      }
      break
  }
}

function initialBoxBalances(boxes: Box[]): Record<string, number> {
  return Object.fromEntries(boxes.map((box) => [box.id, box.balanceCents]))
}

function baseYear(state: AppState, transactions: Transaction[]): number {
  return Math.min(state.year, ...transactions.map((transaction) => parseYear(transaction.date)))
}

export function carryIn(
  state: AppState,
  year: number,
  excludeId?: string,
): { freeCents: number; boxBalances: Record<string, number> } {
  const freeBalance = { value: state.initialBalanceCents }
  const boxBalances = initialBoxBalances(state.boxes)
  const allTransactions = expandTransactions(state.transactions)
  const firstYear = baseYear(state, allTransactions)
  const cutoff = isoDate(year, 0, 1)

  const transactions = sortTransactions(
    allTransactions.filter(
      (transaction) =>
        transaction.date < cutoff && matchesId(transaction, excludeId) && parseYear(transaction.date) >= firstYear,
    ),
  )

  for (const transaction of transactions) {
    applyTransaction(transaction, freeBalance, boxBalances)
  }

  return { freeCents: freeBalance.value, boxBalances }
}

export function calculateAnnualFlow(state: AppState, year: number): AnnualFlow {
  const byDate = new Map<string, Transaction[]>()

  for (const transaction of expandTransactions(state.transactions)) {
    if (parseYear(transaction.date) !== year) continue
    const list = byDate.get(transaction.date) ?? []
    list.push(transaction)
    byDate.set(transaction.date, list)
  }

  const openingBalanceCents = carryIn(state, year).freeCents
  const freeBalance = { value: openingBalanceCents }
  const months: MonthFlow[] = []

  for (let month = 0; month < 12; month += 1) {
    const openingBalanceCents = freeBalance.value
    const days: DayFlow[] = []
    let incomeCents = 0
    let expenseCents = 0
    let toBoxCents = 0
    let fromBoxCents = 0

    for (let day = 1; day <= daysInMonth(year, month); day += 1) {
      const date = isoDate(year, month, day)
      const transactions = sortTransactions(byDate.get(date) ?? [])
      let dayIncome = 0
      let dayExpense = 0
      let dayToBox = 0
      let dayFromBox = 0

      for (const transaction of transactions) {
        switch (transaction.type) {
          case 'entrada':
            dayIncome += transaction.amountCents
            break
          case 'saida':
            dayExpense += transaction.amountCents
            break
          case 'guardar':
            dayToBox += transaction.amountCents
            break
          case 'resgatar':
            dayFromBox += transaction.amountCents
            break
        }
      }

      freeBalance.value += dayIncome - dayExpense - dayToBox + dayFromBox

      days.push({
        date,
        day,
        month,
        incomeCents: dayIncome,
        expenseCents: dayExpense,
        toBoxCents: dayToBox,
        fromBoxCents: dayFromBox,
        balanceCents: freeBalance.value,
        transactions,
      })

      incomeCents += dayIncome
      expenseCents += dayExpense
      toBoxCents += dayToBox
      fromBoxCents += dayFromBox
    }

    months.push({
      month,
      openingBalanceCents,
      closingBalanceCents: freeBalance.value,
      incomeCents,
      expenseCents,
      toBoxCents,
      fromBoxCents,
      days,
    })
  }

  return {
    year,
    openingBalanceCents,
    closingBalanceCents: freeBalance.value,
    totalIncomeCents: months.reduce((sum, item) => sum + item.incomeCents, 0),
    totalExpenseCents: months.reduce((sum, item) => sum + item.expenseCents, 0),
    totalToBoxCents: months.reduce((sum, item) => sum + item.toBoxCents, 0),
    totalFromBoxCents: months.reduce((sum, item) => sum + item.fromBoxCents, 0),
    months,
  }
}

export interface BreathingRoom {
  date: string
  amountCents: number
  hasIncome: boolean
}

function flowDeltaCents(transaction: Transaction): number {
  switch (transaction.type) {
    case 'entrada':
    case 'resgatar':
      return transaction.amountCents
    case 'saida':
    case 'guardar':
      return -transaction.amountCents
  }
}

export function calculateBreathingRoom(flow: AnnualFlow, month: number, today = todayIso()): BreathingRoom {
  const monthFlow = flow.months[month]
  if (!monthFlow || monthFlow.days.length === 0) {
    return { date: isoDate(flow.year, month, 1), amountCents: 0, hasIncome: false }
  }

  const todayParts = parseIsoDate(today)
  const startDay = todayParts?.year === flow.year && todayParts.month === month ? todayParts.day : 1
  const firstIndex = Math.max(0, Math.min(monthFlow.days.length - 1, startDay - 1))
  let balanceCents = firstIndex === 0 ? monthFlow.openingBalanceCents : monthFlow.days[firstIndex - 1].balanceCents

  for (let index = firstIndex; index < monthFlow.days.length; index += 1) {
    const dayFlow = monthFlow.days[index]
    let beforeTransaction = balanceCents

    for (const transaction of dayFlow.transactions) {
      if (transaction.type === 'entrada' && transaction.amountCents > 0) {
        return { date: dayFlow.date, amountCents: beforeTransaction, hasIncome: true }
      }
      beforeTransaction += flowDeltaCents(transaction)
    }

    balanceCents = beforeTransaction
  }

  const lastDay = monthFlow.days[monthFlow.days.length - 1]
  return { date: lastDay.date, amountCents: lastDay.balanceCents, hasIncome: false }
}

export function calculatePosition(state: AppState, upToDate: string, excludeId?: string): Position {
  const cutoffYear = parseYear(upToDate)
  const opening = carryIn(state, cutoffYear, excludeId)
  const freeBalance = { value: opening.freeCents }
  const boxBalances = opening.boxBalances
  const startOfYear = isoDate(cutoffYear, 0, 1)

  const transactions = sortTransactions(
    expandTransactions(state.transactions).filter(
      (transaction) =>
        transaction.date >= startOfYear && transaction.date <= upToDate && matchesId(transaction, excludeId),
    ),
  )

  for (const transaction of transactions) {
    applyTransaction(transaction, freeBalance, boxBalances)
  }

  const totalBoxCents = Object.values(boxBalances).reduce((sum, value) => sum + value, 0)

  return {
    freeBalanceCents: freeBalance.value,
    boxBalances,
    totalBoxCents,
    netWorthCents: freeBalance.value + totalBoxCents,
  }
}

export function getCurrentPosition(state: AppState): Position {
  const currentYear = new Date().getFullYear()
  const today = todayIso()

  if (state.year > currentYear) return calculatePosition(state, isoDate(state.year, 0, 1))
  if (state.year < currentYear) return calculatePosition(state, isoDate(state.year, 11, 31))
  return calculatePosition(state, today > isoDate(state.year, 11, 31) ? isoDate(state.year, 11, 31) : today)
}

export function availableFor(
  state: AppState,
  date: string,
  boxId: string | undefined,
  excludeId?: string,
): { freeCents: number; boxCents: number } {
  const cutoffYear = parseYear(date)
  const opening = carryIn(state, cutoffYear, excludeId)
  const freeBalance = { value: opening.freeCents }
  const boxBalances = opening.boxBalances
  const startOfYear = isoDate(cutoffYear, 0, 1)

  const transactions = sortTransactions(
    expandTransactions(state.transactions).filter(
      (transaction) => transaction.date >= startOfYear && transaction.date <= date && matchesId(transaction, excludeId),
    ),
  )

  for (const transaction of transactions) {
    applyTransaction(transaction, freeBalance, boxBalances)
  }

  return {
    freeCents: freeBalance.value,
    boxCents: boxId ? (boxBalances[boxId] ?? 0) : 0,
  }
}

function parseYear(date: string): number {
  return Number(date.slice(0, 4))
}
