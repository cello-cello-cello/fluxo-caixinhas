import { daysInMonth, isoDate, parseIsoDate, previousBusinessDayIso } from './dates'
import { parseAmountToCents } from './money'
import type { AppState, CardInvoiceItem, CreditCard, Transaction } from '../types'

export type InvoiceItemDraft = CardInvoiceItem

export interface InvoiceParseResult {
  items: InvoiceItemDraft[]
  rawText: string
  sections: string[]
}

export interface InstallmentFilter {
  fromMonth?: string
}

const DATE = /\b(\d{2})\/(\d{2})(?:\/\d{2,4})?\b/
const DATE_GLOBAL = /\b(\d{2})\/(\d{2})(?:\/\d{2,4})?\b/g
const FRACTION = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/g
const NUMBER = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}/g
const CARD_FINAL = /(?:final|final\s+n[ºo]?|cart[ãa]o\s+final)\s*:?\s*(\d{4})/i
const MASKED_CARD = /\*{2,}\s*\*{2,}\s*\*{2,}\s*(\d{4})/i
const SECTION_HEADER = /^(?:cart[ãa]o|fatura|lan[çc]amentos|compras|cr[ée]ditos?|d[ée]bitos?)/i
const PHONE = /(?:\(?\d{2}\)?[\s-]*)?\d{4,5}-?\d{4}\b/
const IGNORE_LINE = /^(?:valor\s+)?total\b|^(?:subtotal|limite|saldo|hist[óo]rico|fatura\s+anterior|faturas\s+anteriores|cet\b|custo\s+efetivo\s+total|iof\b|juros?\b|multa\b|encargos?\b|taxa\b|endere[çc]o\b|cep\b|sac\b|ouvidoria|telefone|fone\b|central\s+de\s+atendimento|ddd\b)/i
const CREDIT_WORD = /(?:cr[ée]dito|estorno|pagamento|reembolso|devolu[çc][aã]o)/i

interface Fraction {
  raw: string
  first: number
  second: number
}

function invoiceParts(invoiceMonth: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(invoiceMonth)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return null
  return { year, month }
}

function normalizeNumber(token: string): string {
  if (/^\d{1,3},\d{3}[.,]\d{2}$/.test(token)) {
    return token.replace(/,/g, '.').replace(/\.(\d{2})$/, ',$1')
  }
  if (/^\d+\.\d{2}$/.test(token)) return token.replace('.', ',')
  return token
}

export function normalizeInvoiceLine(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(NUMBER, (token) => normalizeNumber(token))
}

function fractionsIn(line: string): Fraction[] {
  return [...line.matchAll(FRACTION)].map((item) => ({
    raw: item[0],
    first: Number(item[1]),
    second: Number(item[2]),
  }))
}

function purchaseDateFrom(day: number, month: number, invoiceMonth: string): string | undefined {
  const { year, month: baseMonth } = invoiceParts(invoiceMonth) ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }
  const parsedMonth = month - 1
  if (day < 1 || day > daysInMonth(year, parsedMonth)) return undefined
  return isoDate(parsedMonth > baseMonth ? year - 1 : year, parsedMonth, day)
}

function parseTransactionLine(line: string, index: number, invoiceMonth: string, source?: string): InvoiceItemDraft | null {
  if (!line || PHONE.test(line)) return null

  const descriptionOnly = line.replace(DATE, ' ')
  if (IGNORE_LINE.test(line) || IGNORE_LINE.test(descriptionOnly)) return null

  const dates = [...line.matchAll(DATE_GLOBAL)].filter((match) => {
    const day = Number(match[1])
    const month = Number(match[2])
    return day >= 1 && day <= 31 && month >= 1 && month <= 12
  })
  const dateMatch = dates.find((match) => match.index === 0) ?? dates[0]
  if (!dateMatch) return null

  const amounts = [...line.matchAll(NUMBER)]
  const amountMatch = amounts[amounts.length - 1]
  if (!amountMatch || amountMatch.index === undefined) return null

  const amountToken = amountMatch[0]
  const positiveCents = parseAmountToCents(amountToken)
  if (!positiveCents) return null

  const remaining = line.replace(dateMatch[0], ' ')
  const fractions = fractionsIn(remaining)
  const installmentFraction = fractions.find(
    (fraction) => fraction.first >= 1 && fraction.first <= fraction.second && fraction.second >= 2 && fraction.second <= 36,
  )

  const amountIndex = amountMatch.index
  const before = line.slice(Math.max(0, amountIndex - 3), amountIndex)
  const after = line.slice(amountIndex + amountToken.length, amountIndex + amountToken.length + 3)
  const signIsNegative = /[-−(]\s*$/.test(before) || /^\s*[-−)]/.test(after)
  const negative = signIsNegative || CREDIT_WORD.test(line)

  let description = line
  for (const token of [dateMatch[0], installmentFraction?.raw, amountToken]) {
    if (token) description = description.replace(token, ' ')
  }
  description = description
    .replace(/R\$/gi, ' ')
    .replace(/parcelamento|parcelad[ao]s?|parcelas?|parc\.?/gi, ' ')
    .replace(/[-−()]/g, ' ')
    .replace(CREDIT_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)

  return {
    id: `pdf-${invoiceMonth}-${index}`,
    description: description || (negative ? 'Crédito da fatura' : 'Compra da fatura'),
    amountCents: negative ? -positiveCents : positiveCents,
    currentInstallment: installmentFraction?.first ?? 1,
    installmentCount: installmentFraction?.second ?? 1,
    purchaseDate: purchaseDateFrom(Number(dateMatch[1]), Number(dateMatch[2]), invoiceMonth),
    source,
  }
}

export function parseInvoiceDocument(rawLines: string[], invoiceMonth: string): InvoiceParseResult {
  const lines = rawLines.map(normalizeInvoiceLine).filter(Boolean)
  const items: InvoiceItemDraft[] = []
  const sections: string[] = []
  let final: string | undefined
  let section: string | undefined

  lines.forEach((line, index) => {
    const cardFinal = CARD_FINAL.exec(line) ?? MASKED_CARD.exec(line)
    if (cardFinal) final = `Final ${cardFinal[1]}`
    else if (!DATE.test(line) && SECTION_HEADER.test(line)) section = line.slice(0, 80)

    const sourceParts = [final, section].filter((part): part is string => Boolean(part))
    const source = sourceParts.length > 0 ? sourceParts.join(' · ') : undefined
    for (const part of sourceParts) {
      if (!sections.includes(part)) sections.push(part)
    }

    const item = parseTransactionLine(line, index, invoiceMonth, source)
    if (item) items.push(item)
  })

  return { items, rawText: lines.join('\n'), sections }
}

export function parseInvoiceLines(lines: string[], invoiceMonth: string): InvoiceItemDraft[] {
  return parseInvoiceDocument(lines, invoiceMonth).items
}

export function installmentDueDate(card: CreditCard, year: number, month: number, offset = 0): string {
  const target = year * 12 + month + offset
  const targetYear = Math.floor(target / 12)
  const targetMonth = target % 12
  const day = Math.max(1, Math.min(card.dueDay, daysInMonth(targetYear, targetMonth)))
  return previousBusinessDayIso(isoDate(targetYear, targetMonth, day))
}

export function cardDueDate(card: CreditCard, invoiceMonth: string, offset = 0): string {
  const explicit = card.dueDate ? parseIsoDate(card.dueDate) : null
  if (explicit) {
    const target = explicit.year * 12 + explicit.month + offset
    const targetYear = Math.floor(target / 12)
    const targetMonth = target % 12
    const day = Math.max(1, Math.min(explicit.day, daysInMonth(targetYear, targetMonth)))
    return previousBusinessDayIso(isoDate(targetYear, targetMonth, day))
  }

  const parts = invoiceParts(invoiceMonth)
  const now = new Date()
  const base = parts ?? { year: now.getFullYear(), month: now.getMonth() }
  return installmentDueDate(card, base.year, base.month, offset)
}

export function buildInstallmentTransactions(
  card: CreditCard,
  items: InvoiceItemDraft[],
  invoiceMonth: string,
  filter: InstallmentFilter = {},
): Transaction[] {
  const parts = invoiceParts(invoiceMonth)
  if (!parts) return []

  const fromMonth = filter.fromMonth && /^\d{4}-\d{2}$/.test(filter.fromMonth) ? filter.fromMonth : undefined

  return items.flatMap((item) => {
    const count = Math.max(1, Math.min(36, Math.trunc(item.installmentCount)))
    const current = Math.max(1, Math.min(count, Math.trunc(item.currentInstallment)))
    const groupId = `${card.id}:${item.id}`
    const transactions: Transaction[] = []

    for (let installment = current; installment <= count; installment += 1) {
      const explicitDate = item.dueDate ? parseIsoDate(item.dueDate) : null
      const date = installment === current && explicitDate
        ? item.dueDate as string
        : cardDueDate(card, invoiceMonth, installment - current)
      if (fromMonth && date.slice(0, 7) < fromMonth) continue

      transactions.push({
        id: `${groupId}:${installment}`,
        date,
        description: `${item.description} (${installment}/${count})`,
        category: 'Cartão',
        type: item.amountCents < 0 ? 'entrada' : 'saida',
        amountCents: Math.abs(item.amountCents),
        cardId: card.id,
        installmentGroupId: groupId,
        installmentIndex: installment,
        installmentCount: count,
        invoiceMonth,
      })
    }

    return transactions
  })
}

export function countPlannedTransactions(
  card: CreditCard,
  items: InvoiceItemDraft[],
  invoiceMonth: string,
  fromMonth?: string,
): number {
  return buildInstallmentTransactions(card, items, invoiceMonth, { fromMonth }).length
}

export function cardCommitment(
  state: AppState,
  cardId: string,
  today = new Date(),
): { committedCents: number; availableCents: number; openInstallments: number; exceeded: boolean } {
  const card = state.cards.find((item) => item.id === cardId)
  if (!card) return { committedCents: 0, availableCents: 0, openInstallments: 0, exceeded: false }

  const start = isoDate(today.getFullYear(), today.getMonth(), 1)
  const open = state.cardInvoices
    .filter((invoice) => invoice.cardId === cardId)
    .flatMap((invoice) => buildInstallmentTransactions(card, invoice.items, invoice.invoiceMonth, { fromMonth: invoice.fromMonth }))
    .filter((item) => item.date >= start)
  const committedCents = open.reduce(
    (sum, item) => sum + (item.type === 'entrada' ? -item.amountCents : item.amountCents),
    0,
  )
  const limitCents = card.limitCents

  return {
    committedCents,
    availableCents: Math.min(limitCents, Math.max(0, limitCents - committedCents)),
    openInstallments: open.length,
    exceeded: committedCents > limitCents,
  }
}
