export type TransactionType = 'entrada' | 'saida' | 'guardar' | 'resgatar'

export interface Transaction {
  id: string
  date: string
  description: string
  category: string
  type: TransactionType
  amountCents: number
  boxId?: string
  cardId?: string
  installmentGroupId?: string
  installmentIndex?: number
  installmentCount?: number
  invoiceMonth?: string
  recurrenceDay?: number
  adjustToBusinessDay?: boolean
  sourceId?: string
}

export interface CreditCard {
  id: string
  name: string
  limitCents: number
  closingDay: number
  dueDay: number
}

export interface Box {
  id: string
  name: string
  color: string
  balanceCents: number
  goalCents: number
  targetDate?: string
  yieldRate?: number
}

export interface AppState {
  version: 1
  year: number
  initialBalanceCents: number
  boxes: Box[]
  cards: CreditCard[]
  transactions: Transaction[]
}

export interface DayFlow {
  date: string
  day: number
  month: number
  incomeCents: number
  expenseCents: number
  toBoxCents: number
  fromBoxCents: number
  balanceCents: number
  transactions: Transaction[]
}

export interface MonthFlow {
  month: number
  openingBalanceCents: number
  closingBalanceCents: number
  incomeCents: number
  expenseCents: number
  toBoxCents: number
  fromBoxCents: number
  days: DayFlow[]
}

export interface AnnualFlow {
  year: number
  openingBalanceCents: number
  closingBalanceCents: number
  totalIncomeCents: number
  totalExpenseCents: number
  totalToBoxCents: number
  totalFromBoxCents: number
  months: MonthFlow[]
}

export interface Position {
  freeBalanceCents: number
  boxBalances: Record<string, number>
  totalBoxCents: number
  netWorthCents: number
}
