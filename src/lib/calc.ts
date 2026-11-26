import { daysInMonth, isoDate, todayIso } from './dates'
import type { AnnualFlow, AppState, Box, DayFlow, MonthFlow, Position, Transaction } from '../types'

function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
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

export function calculateAnnualFlow(state: AppState, year: number): AnnualFlow {
  const byDate = new Map<string, Transaction[]>()

  for (const transaction of state.transactions) {
    if (parseYear(transaction.date) !== year) continue
    const list = byDate.get(transaction.date) ?? []
    list.push(transaction)
    byDate.set(transaction.date, list)
  }

  const freeBalance = { value: state.initialBalanceCents }
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
    openingBalanceCents: state.initialBalanceCents,
    closingBalanceCents: freeBalance.value,
    totalIncomeCents: months.reduce((sum, item) => sum + item.incomeCents, 0),
    totalExpenseCents: months.reduce((sum, item) => sum + item.expenseCents, 0),
    totalToBoxCents: months.reduce((sum, item) => sum + item.toBoxCents, 0),
    totalFromBoxCents: months.reduce((sum, item) => sum + item.fromBoxCents, 0),
    months,
  }
}

export function calculatePosition(state: AppState, upToDate: string, excludeId?: string): Position {
  const freeBalance = { value: state.initialBalanceCents }
  const boxBalances = initialBoxBalances(state.boxes)

  const transactions = sortTransactions(
    state.transactions.filter((transaction) => transaction.date <= upToDate && transaction.id !== excludeId),
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
  const freeBalance = { value: state.initialBalanceCents }
  const boxBalances = initialBoxBalances(state.boxes)

  const transactions = sortTransactions(
    state.transactions.filter((transaction) => transaction.date <= date && transaction.id !== excludeId),
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
