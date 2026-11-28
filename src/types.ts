export type TransactionType = 'entrada' | 'saida' | 'guardar' | 'resgatar'

export type RecurrenceScope = 'single' | 'series'

export interface RecurrenceChange {
  baseId: string
  occurrenceId: string
  occurrenceMonth: string
  scope: RecurrenceScope
}

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
  recurrenceEnd?: string
  adjustToBusinessDay?: boolean
  sourceId?: string
  autoBoxId?: string
}

export interface CreditCard {
  id: string
  name: string
  limitCents: number
  closingDay: number
  dueDay: number
  closingDate?: string
  dueDate?: string
}

export interface CardInvoiceItem {
  id: string
  description: string
  amountCents: number
  currentInstallment: number
  installmentCount: number
  purchaseDate?: string
  dueDate?: string
  source?: string
}

export interface CardInvoice {
  id: string
  cardId: string
  invoiceMonth: string
  items: CardInvoiceItem[]
  rawText: string
  sections: string[]
  fromMonth?: string
}

export interface Box {
  id: string
  name: string
  color: string
  balanceCents: number
  goalCents: number
  targetDate?: string
  targetMonth?: string
  autoContributionCents?: number
  autoContributionDay?: number
  yieldRate?: number
}

export interface AppState {
  version: 1
  year: number
  initialBalanceCents: number
  boxes: Box[]
  cards: CreditCard[]
  cardInvoices: CardInvoice[]
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
