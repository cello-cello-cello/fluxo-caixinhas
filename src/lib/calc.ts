import {
  daysInMonth,
  isoDate,
  parseIsoDate,
  previousBusinessDayInMonthIso,
  previousBusinessDayIso,
  todayIso,
} from './dates'
import type { AnnualFlow, AppState, Box, DayFlow, MonthFlow, Position, Transaction } from '../types'

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
    const endIndex = (parsed.year + 1) * 12 + 11

    for (let index = startIndex; index <= endIndex; index += 1) {
      const year = Math.floor(index / 12)
      const month = index % 12
      occurrences.push({
        ...transaction,
        id: index === startIndex ? transaction.id : `${transaction.id}:${year}-${month + 1}`,
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
