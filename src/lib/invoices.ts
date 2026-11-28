import { daysInMonth, isoDate, parseIsoDate, previousBusinessDayIso } from './dates'
import { parseAmountToCents } from './money'
import type { AppState, CardInvoiceItem, CreditCard, InvoiceItemKind, Transaction } from '../types'

export type InvoiceItemDraft = CardInvoiceItem

export interface InvoiceParseResult {
  items: InvoiceItemDraft[]
  rawText: string
  sections: string[]
  totalCents?: number
}

export interface CardCommitment {
  committedCents: number
  availableCents: number
  openInstallments: number
  futureInstallments: number
  exceeded: boolean
}

export interface InstallmentFilter {
  fromMonth?: string
}

const DATE = /\b(\d{2})\/(\d{2})(?:\/\d{2,4})?\b/
const DATE_GLOBAL = /\b(\d{2})\/(\d{2})(?:\/\d{2,4})?\b/g
const DATE_ONLY = /^\d{2}\/\d{2}(?:\/\d{2,4})?$/
const FRACTION = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/g
const FRACTION_ONLY = /^\d{1,2}\s*\/\s*\d{1,2}$/
const PARCEL_FRAGMENT = /^(?:parc\.?|parcela(?:mento)?|parcelad[ao]s?|parcelas?)\s*\d{1,2}\s*\/\s*\d{1,2}$/i
const PARCEL_PREFIX = /(?:parc\.?|parcelas?|parcelamento|parcelad[ao]s?)\s*$/i
const NUMBER = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}/g
const HAS_AMOUNT = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}/
const AMOUNT_ONLY = /^[-−(]?\s*R?\$?\s*[-−]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*[-−)]?$/i
const CARD_FINAL = /(?:final\s*(?:n[ºo]?)?|cart[ãa]o\s*(?:final\s*)?|fatura\s*)\s*:?\s*(\d{4})/i
const MASKED_CARD = /\*{2,}\s*\*{2,}\s*\*{2,}\s*(\d{4})/i
const BARE_FINAL = /^(?:\*+\s*)?(\d{4})(?:\s*\*+)?$/
const SECTION_HEADER = /^(?:cart[ãa]o|fatura|lan[çc]amentos|compras|cr[ée]ditos?|d[ée]bitos?)/i
const INSTITUTIONAL_LINE = /^(?:sac\b|ouvidoria|central\s+de\s+atendimento|telefone|fone\b|ddd\b|cet\b|custo\s+efetivo\s+total|endere[çc]o\b|cep\b|resumo\s+da\s+fatura|valor\s+total|total\s+da\s+fatura|total\s+geral|subtotal|total\b|hist[óo]rico(?:\s+de\s+faturas?)?|fatura\s+anterior|faturas\s+anteriores)/i
const INVOICE_TOTAL = /(?:valor\s+total|total\s+da\s+fatura|total\s+geral|total)\s*:?\s*(?:R\$\s*)?(-?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|-?\s*\d+[.,]\d{2})/i
const CREDIT_WORD = /(?:cr[ée]dito|estorno|pagamento|reembolso|devolu[çc][aã]o)/i
const CHARGE_WORD = /(?:juros?|multa|encargos?|iof|taxa|tarifa|cet)/i

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
    .replace(/[|¦@]/g, ' ')
    .replace(/\){2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(NUMBER, (token) => normalizeNumber(token))
}

function isHeaderOrNoise(line: string): boolean {
  return INSTITUTIONAL_LINE.test(line)
    || SECTION_HEADER.test(line)
    || Boolean(CARD_FINAL.exec(line) ?? MASKED_CARD.exec(line))
}

function isCompleteLine(line: string): boolean {
  return DATE.test(line) && HAS_AMOUNT.test(line)
}

function isOrphanFragment(line: string): boolean {
  if (isCompleteLine(line)) return false
  if (DATE_ONLY.test(line) || FRACTION_ONLY.test(line) || PARCEL_FRAGMENT.test(line) || AMOUNT_ONLY.test(line)) return true
  return !DATE.test(line) && !HAS_AMOUNT.test(line) && /\p{L}/u.test(line)
}

function canMergeFragment(previous: string | undefined, line: string): boolean {
  if (!previous || isHeaderOrNoise(previous) || isHeaderOrNoise(line)) return false
  if (isCompleteLine(previous) || isCompleteLine(line)) return false
  if (HAS_AMOUNT.test(previous)) return false
  return isOrphanFragment(line)
}

function reconstructInvoiceLines(rawLines: string[]): string[] {
  const normalized = rawLines.map(normalizeInvoiceLine).filter(Boolean)
  const lines: string[] = []

  for (const line of normalized) {
    const previous = lines[lines.length - 1]
    if (canMergeFragment(previous, line)) {
      lines[lines.length - 1] = normalizeInvoiceLine(`${previous} ${line}`)
    } else {
      lines.push(line)
    }
  }

  return lines
}

export function classifyInvoiceItem(item: Pick<CardInvoiceItem, 'description' | 'amountCents' | 'currentInstallment' | 'installmentCount'>): InvoiceItemKind {
  if (item.amountCents < 0 || CREDIT_WORD.test(item.description)) return 'credito'
  if (CHARGE_WORD.test(item.description)) return 'encargo'
  if (item.installmentCount > 1) return 'parcela'
  return 'vista'
}

function detectInvoiceTotal(lines: string[]): number | undefined {
  for (const line of lines) {
    const match = INVOICE_TOTAL.exec(line)
    if (!match) continue
    const cents = parseAmountToCents(match[1])
    if (cents) return cents
  }
  return undefined
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
  if (!line) return null

  const descriptionOnly = line.replace(DATE, ' ')
  if (INSTITUTIONAL_LINE.test(line) || INSTITUTIONAL_LINE.test(descriptionOnly)) return null

  const fractions = fractionsIn(line)
  const installmentFraction = fractions.find(
    (fraction) => fraction.first >= 1 && fraction.first <= fraction.second && fraction.second >= 2 && fraction.second <= 36,
  )
  const dates = [...line.matchAll(DATE_GLOBAL)].filter((match) => {
    const day = Number(match[1])
    const month = Number(match[2])
    const index = match.index ?? 0
    const prefix = line.slice(Math.max(0, index - 24), index)
    return day >= 1 && day <= 31 && month >= 1 && month <= 12
      && !(fractions.some((fraction) => fraction.raw === match[0]) && PARCEL_PREFIX.test(prefix))
  })
  const dateMatch = dates.find((match) => match.index === 0) ?? dates[0]
  if (!dateMatch) return null

  const amounts = [...line.matchAll(NUMBER)]
  const amountMatch = amounts[amounts.length - 1]
  if (!amountMatch || amountMatch.index === undefined) return null

  const amountToken = amountMatch[0]
  const positiveCents = parseAmountToCents(amountToken)
  if (!positiveCents) return null

  const amountIndex = amountMatch.index
  const before = line.slice(Math.max(0, amountIndex - 3), amountIndex)
  const after = line.slice(amountIndex + amountToken.length, amountIndex + amountToken.length + 3)
  const signIsNegative = /[-−(]\s*$/.test(before) || /^\s*[-−)]/.test(after)
  const negative = signIsNegative || CREDIT_WORD.test(line)
  const amountCents = negative ? -positiveCents : positiveCents
  const classification = classifyInvoiceItem({
    description: line,
    amountCents,
    currentInstallment: installmentFraction?.first ?? 1,
    installmentCount: installmentFraction?.second ?? 1,
  })

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
    amountCents,
    currentInstallment: installmentFraction?.first ?? 1,
    installmentCount: installmentFraction?.second ?? 1,
    kind: classification,
    purchaseDate: purchaseDateFrom(Number(dateMatch[1]), Number(dateMatch[2]), invoiceMonth),
    source,
  }
}

export function parseInvoiceDocument(rawLines: string[], invoiceMonth: string): InvoiceParseResult {
  const lines = reconstructInvoiceLines(rawLines)
  const items: InvoiceItemDraft[] = []
  const sections: string[] = []
  let final: string | undefined
  let section: string | undefined

  lines.forEach((line, index) => {
    const bareFinal = BARE_FINAL.exec(line)
    const cardFinal = CARD_FINAL.exec(line) ?? MASKED_CARD.exec(line)
      ?? (bareFinal && !/^(?:19|20)\d{2}$/.test(bareFinal[1]) ? bareFinal : null)
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

  return { items, rawText: lines.join('\n'), sections, totalCents: detectInvoiceTotal(lines) }
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
    const futureCount = Math.max(0, count - current)
    const groupId = `${card.id}:${item.id}`
    const transactions: Transaction[] = []

    for (let installment = current; installment <= current + futureCount; installment += 1) {
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

export function cardCommitment(state: AppState, cardId: string, today = new Date()): CardCommitment {
  const empty: CardCommitment = {
    committedCents: 0,
    availableCents: 0,
    openInstallments: 0,
    futureInstallments: 0,
    exceeded: false,
  }
  const card = state.cards.find((item) => item.id === cardId)
  if (!card) return empty

  const start = isoDate(today.getFullYear(), today.getMonth(), 1)
  const groups = state.cardInvoices
    .filter((invoice) => invoice.cardId === cardId)
    .flatMap((invoice) => invoice.items.map((item) => ({
      item,
      transactions: buildInstallmentTransactions(card, [item], invoice.invoiceMonth, { fromMonth: invoice.fromMonth })
        .filter((transaction) => transaction.date >= start),
    })))
    .filter((group) => group.transactions.length > 0)
  const open = groups.flatMap((group) => group.transactions)
  const committedCents = open.reduce(
    (sum, item) => sum + (item.type === 'entrada' ? -item.amountCents : item.amountCents),
    0,
  )
  const futureInstallments = groups.reduce((sum, group) => sum + group.transactions.length - 1, 0)
  const limitCents = card.limitCents

  return {
    committedCents,
    availableCents: Math.min(limitCents, Math.max(0, limitCents - committedCents)),
    openInstallments: open.length,
    futureInstallments,
    exceeded: committedCents > limitCents,
  }
}
