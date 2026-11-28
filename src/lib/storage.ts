import { carryIn, expandTransactions } from './calc'
import { BOX_COLORS } from './constants'
import { isoDate, isValidIsoDate, todayIso } from './dates'
import type { AppState, Box, CardInvoice, CardInvoiceItem, CreditCard, Transaction, TransactionType } from '../types'

const STORAGE_KEY = 'fluxo-caixinhas:v1'
const VALID_TYPES: TransactionType[] = ['entrada', 'saida', 'guardar', 'resgatar']

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createInitialState(year = new Date().getFullYear()): AppState {
  return { version: 1, year, initialBalanceCents: 0, boxes: [], cards: [], cardInvoices: [], transactions: [] }
}

export function createDemoState(year = new Date().getFullYear()): AppState {
  const currentMonth = Number(todayIso().slice(5, 7)) - 1
  const currentDate = isoDate(year, currentMonth, 18)

  return {
    version: 1,
    year,
    initialBalanceCents: 4_800_000,
    boxes: [
      {
        id: 'demo-viagem',
        name: 'Viagem 2027',
        color: '#4A6B53',
        balanceCents: 1_250_000,
        goalCents: 3_000_000,
        targetMonth: `${year + 1}-11`,
        autoContributionCents: 80_000,
        autoContributionDay: 5,
        yieldRate: 6,
      },
      {
        id: 'demo-reserva',
        name: 'Reserva de emergência',
        color: '#1E3A5F',
        balanceCents: 860_000,
        goalCents: 2_000_000,
        targetMonth: `${year + 1}-05`,
        autoContributionCents: 50_000,
        autoContributionDay: 20,
      },
      {
        id: 'demo-presentes',
        name: 'Presentes',
        color: '#C0604D',
        balanceCents: 180_000,
        goalCents: 600_000,
        targetMonth: `${year}-12`,
      },
    ],
    cards: [
      { id: 'demo-cartao-nubank', name: 'Nubank', limitCents: 1_200_000, closingDay: 10, dueDay: 15 },
      { id: 'demo-cartao-itaipava', name: 'Itaipava', limitCents: 800_000, closingDay: 18, dueDay: 25 },
    ],
    cardInvoices: [{
      id: 'demo-invoice-nubank',
      cardId: 'demo-cartao-nubank',
      invoiceMonth: isoDate(year, currentMonth, 1).slice(0, 7),
      items: [{
        id: 'demo-netflix',
        description: 'NETFLIX',
        amountCents: 3_990,
        currentInstallment: 2,
        installmentCount: 6,
        purchaseDate: isoDate(year, currentMonth, 13),
      }],
      rawText: '',
      sections: [],
    }],
    transactions: [
      {
        id: 'demo-salario',
        date: isoDate(year, 0, 5),
        description: 'Salário',
        category: 'Salário',
        type: 'entrada',
        amountCents: 750_000,
        recurrenceDay: 5,
        recurrenceEnd: `${year + 1}-12`,
      },
      {
        id: 'demo-aluguel',
        date: isoDate(year, 0, 10),
        description: 'Aluguel',
        category: 'Moradia',
        type: 'saida',
        amountCents: 220_000,
        recurrenceDay: 10,
        recurrenceEnd: `${year + 1}-12`,
      },
      {
        id: 'demo-mercado',
        date: isoDate(year, 0, 12),
        description: 'Mercado',
        category: 'Alimentação',
        type: 'saida',
        amountCents: 96_000,
        recurrenceDay: 12,
        recurrenceEnd: `${year + 1}-12`,
      },
      {
        id: 'demo-internet',
        date: isoDate(year, 0, 20),
        description: 'Internet',
        category: 'Telefone',
        type: 'saida',
        amountCents: 12_000,
        recurrenceDay: 20,
        recurrenceEnd: `${year + 1}-12`,
      },
      {
        id: 'demo-aporte-viagem',
        date: isoDate(year, 0, 5),
        description: 'Aporte automático · Viagem 2027',
        category: 'Caixinhas',
        type: 'guardar',
        amountCents: 80_000,
        boxId: 'demo-viagem',
        autoBoxId: 'demo-viagem',
        recurrenceDay: 5,
        recurrenceEnd: `${year + 1}-11`,
      },
      {
        id: 'demo-aporte-reserva',
        date: isoDate(year, 0, 20),
        description: 'Aporte automático · Reserva',
        category: 'Caixinhas',
        type: 'guardar',
        amountCents: 50_000,
        boxId: 'demo-reserva',
        autoBoxId: 'demo-reserva',
        recurrenceDay: 20,
        recurrenceEnd: `${year + 1}-05`,
      },
      {
        id: 'demo-resgate',
        date: currentDate,
        description: 'Resgate · Presentes',
        category: 'Caixinhas',
        type: 'resgatar',
        amountCents: 30_000,
        boxId: 'demo-presentes',
      },
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function toColor(value: unknown, fallback = '#4A6B53'): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function optionalDate(value: unknown): string | undefined {
  return isValidIsoDate(value) ? value : undefined
}

function optionalMonth(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return undefined
  const month = Number(value.slice(5))
  return month >= 1 && month <= 12 ? value : undefined
}

function sanitizeBox(value: unknown): Box | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : ''
  if (!name) return null

  const rate = Number(value.yieldRate)
  const autoContributionCents = Math.max(0, toInteger(value.autoContributionCents))
  const autoContributionDay = toInteger(value.autoContributionDay)
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    name,
    color: toColor(value.color, BOX_COLORS[0]),
    balanceCents: Math.max(0, toInteger(value.balanceCents)),
    goalCents: Math.max(0, toInteger(value.goalCents)),
    targetDate: optionalDate(value.targetDate),
    targetMonth: optionalMonth(value.targetMonth),
    autoContributionCents: autoContributionCents > 0 ? autoContributionCents : undefined,
    autoContributionDay: autoContributionDay >= 1 && autoContributionDay <= 31 ? autoContributionDay : undefined,
    yieldRate: Number.isFinite(rate) ? Math.min(1000, Math.max(-99, rate)) : undefined,
  }
}

function sanitizeCard(value: unknown): CreditCard | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : ''
  if (!name) return null

  const day = (value: unknown) => Math.min(31, Math.max(1, toInteger(value, 1)))
  const closingDate = optionalDate(value.closingDate)
  const dueDate = optionalDate(value.dueDate)

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    name,
    limitCents: Math.max(0, toInteger(value.limitCents)),
    closingDay: closingDate ? Number(closingDate.slice(8)) : day(value.closingDay),
    dueDay: dueDate ? Number(dueDate.slice(8)) : day(value.dueDay),
    closingDate,
    dueDate,
  }
}

function sanitizeCardInvoiceItem(value: unknown): CardInvoiceItem | null {
  if (!isRecord(value)) return null
  const description = typeof value.description === 'string' ? value.description.trim().slice(0, 140) : ''
  const amountCents = toInteger(value.amountCents)
  if (!description || amountCents === 0) return null

  const count = Math.min(36, Math.max(1, toInteger(value.installmentCount, 1)))
  const current = Math.min(count, Math.max(1, toInteger(value.currentInstallment, 1)))
  const source = typeof value.source === 'string' && value.source.trim() ? value.source.trim().slice(0, 120) : undefined

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    description,
    amountCents,
    currentInstallment: current,
    installmentCount: count,
    purchaseDate: optionalDate(value.purchaseDate),
    dueDate: optionalDate(value.dueDate),
    source,
  }
}

function sanitizeCardInvoice(value: unknown, cardIds: Set<string>): CardInvoice | null {
  if (!isRecord(value)) return null
  if (typeof value.cardId !== 'string' || !cardIds.has(value.cardId)) return null
  const invoiceMonth = optionalMonth(value.invoiceMonth)
  if (!invoiceMonth) return null

  return {
    id: typeof value.id === 'string' && value.id ? value.id : `${value.cardId}:${invoiceMonth}`,
    cardId: value.cardId,
    invoiceMonth,
    items: Array.isArray(value.items)
      ? value.items.map(sanitizeCardInvoiceItem).filter((item): item is CardInvoiceItem => item !== null)
      : [],
    rawText: typeof value.rawText === 'string' ? value.rawText : '',
    sections: Array.isArray(value.sections)
      ? value.sections.filter((section): section is string => typeof section === 'string').map((section) => section.slice(0, 80))
      : [],
    fromMonth: optionalMonth(value.fromMonth),
  }
}

function migrateCardInvoices(transactions: Transaction[], cardIds: Set<string>): CardInvoice[] {
  const groups = new Map<string, CardInvoice>()

  for (const transaction of transactions) {
    if (!transaction.cardId || !cardIds.has(transaction.cardId) || !transaction.installmentGroupId) continue
    const invoiceMonth = transaction.invoiceMonth ?? transaction.date.slice(0, 7)
    const key = `${transaction.cardId}|${invoiceMonth}|${transaction.installmentGroupId}`
    let invoice = groups.get(key)
    if (!invoice) {
      invoice = {
        id: `${transaction.cardId}:${invoiceMonth}:${transaction.installmentGroupId}`,
        cardId: transaction.cardId,
        invoiceMonth,
        items: [],
        rawText: '',
        sections: [],
      }
      groups.set(key, invoice)
    }

    const itemId = transaction.installmentGroupId.slice(transaction.cardId.length + 1)
    let item = invoice.items.find((candidate) => candidate.id === itemId)
    if (!item) {
      item = {
        id: itemId || transaction.installmentGroupId,
        description: transaction.description.replace(/ \(\d+\/\d+\)$/, ''),
        amountCents: transaction.type === 'entrada' ? -transaction.amountCents : transaction.amountCents,
        currentInstallment: transaction.installmentIndex ?? 1,
        installmentCount: transaction.installmentCount ?? 1,
        dueDate: transaction.date,
      }
      invoice.items.push(item)
    }

    const index = transaction.installmentIndex ?? item.currentInstallment
    if (index < item.currentInstallment) {
      item.currentInstallment = index
      item.dueDate = transaction.date
    }
    item.installmentCount = Math.max(item.installmentCount, transaction.installmentCount ?? item.installmentCount)
  }

  return [...groups.values()].map((invoice) => {
    const firstDate = invoice.items
      .map((item) => item.dueDate ?? '')
      .filter(Boolean)
      .sort()[0]
    return { ...invoice, fromMonth: firstDate?.slice(0, 7) }
  })
}

function sanitizeTransaction(value: unknown, boxIds: Set<string>, cardIds: Set<string>): Transaction | null {
  if (!isRecord(value)) return null
  if (!isValidIsoDate(value.date)) return null

  const type = VALID_TYPES.find((item) => item === value.type)
  if (!type) return null

  const amountCents = Math.max(0, toInteger(value.amountCents))
  if (amountCents === 0) return null

  const description = typeof value.description === 'string' ? value.description.trim().slice(0, 140) : ''
  const rawCategory = typeof value.category === 'string' && value.category.trim() ? value.category.trim() : 'Outros'
  const category = rawCategory === 'Casa' ? 'Moradia' : rawCategory
  const boxId = typeof value.boxId === 'string' && boxIds.has(value.boxId) ? value.boxId : undefined
  const autoBoxId = type === 'guardar' && typeof value.autoBoxId === 'string' && boxIds.has(value.autoBoxId)
    ? value.autoBoxId
    : undefined
  const cardId = typeof value.cardId === 'string' && cardIds.has(value.cardId) ? value.cardId : undefined
  const installmentGroupId = typeof value.installmentGroupId === 'string' && value.installmentGroupId
    ? value.installmentGroupId
    : undefined
  const installmentIndexValue = toInteger(value.installmentIndex)
  const installmentCountValue = toInteger(value.installmentCount)
  const invoiceMonth = typeof value.invoiceMonth === 'string' && /^\d{4}-\d{2}$/.test(value.invoiceMonth)
    ? value.invoiceMonth
    : undefined
  const recurrenceValue = toInteger(value.recurrenceDay)
  const recurrenceDay = recurrenceValue > 0 ? Math.min(31, recurrenceValue) : undefined
  const recurrenceEndMonth = typeof value.recurrenceEnd === 'string' && /^\d{4}-\d{2}$/.test(value.recurrenceEnd)
    ? Number(value.recurrenceEnd.slice(5))
    : 0
  const rawRecurrenceEnd = recurrenceEndMonth >= 1 && recurrenceEndMonth <= 12
    && typeof value.recurrenceEnd === 'string' && value.recurrenceEnd >= value.date.slice(0, 7)
    ? value.recurrenceEnd
    : undefined
  const recurrenceEnd = recurrenceDay ? rawRecurrenceEnd : undefined
  const adjustToBusinessDay = value.adjustToBusinessDay === true ? true : undefined

  if ((type === 'guardar' || type === 'resgatar') && !boxId) return null

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    date: value.date,
    description: description || (type === 'entrada' ? 'Entrada' : type === 'saida' ? 'Saída' : 'Transferência'),
    category,
    type,
    amountCents,
    boxId,
    autoBoxId,
    cardId,
    installmentGroupId,
    installmentIndex: installmentIndexValue > 0 ? installmentIndexValue : undefined,
    installmentCount: installmentCountValue > 0 ? installmentCountValue : undefined,
    invoiceMonth,
    recurrenceDay,
    recurrenceEnd,
    adjustToBusinessDay,
  }
}

export function sanitizeState(value: unknown): AppState | null {
  if (!isRecord(value) || value.version !== 1) return null

  const year = toInteger(value.year, new Date().getFullYear())
  const boxes = Array.isArray(value.boxes)
    ? value.boxes.map(sanitizeBox).filter((box): box is Box => box !== null)
    : []
  const boxIds = new Set(boxes.map((box) => box.id))
  const cards = Array.isArray(value.cards)
    ? value.cards.map(sanitizeCard).filter((card): card is CreditCard => card !== null)
    : []
  const cardIds = new Set(cards.map((card) => card.id))
  let cardInvoices = Array.isArray(value.cardInvoices)
    ? value.cardInvoices
        .map((item) => sanitizeCardInvoice(item, cardIds))
        .filter((item): item is CardInvoice => item !== null)
    : []
  const transactions = Array.isArray(value.transactions)
    ? value.transactions
        .map((item) => sanitizeTransaction(item, boxIds, cardIds))
        .filter((item): item is Transaction => item !== null)
    : []

  if (cardInvoices.length === 0) cardInvoices = migrateCardInvoices(transactions, cardIds)

  return {
    version: 1,
    year: Math.min(2200, Math.max(1900, year)),
    initialBalanceCents: toInteger(value.initialBalanceCents),
    boxes,
    cards,
    cardInvoices,
    transactions: transactions.filter((item) => !(item.cardId && item.installmentGroupId)),
  }
}

export function loadState(): AppState {
  if (typeof localStorage === 'undefined') return createInitialState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    return sanitizeState(JSON.parse(raw)) ?? createInitialState()
  } catch {
    return createInitialState()
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    return
  }
}

export function parseJsonImport(text: string): AppState | null {
  try {
    return sanitizeState(JSON.parse(text))
  } catch {
    return null
  }
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function exportTransactionsCsv(state: AppState): string {
  const names = new Map(state.boxes.map((box) => [box.id, box.name]))
  const rows = [
    ['data', 'descricao', 'categoria', 'tipo', 'valor', 'caixinha_id', 'caixinha_nome'],
    ...sortByDate(expandTransactions(state.transactions))
      .filter((transaction) => transaction.date.startsWith(`${state.year}-`))
      .map((transaction) => [
        transaction.date,
        transaction.description,
        transaction.category,
        transaction.type,
        csvAmount(transaction.amountCents),
        transaction.boxId ?? '',
        transaction.boxId ? (names.get(transaction.boxId) ?? '') : '',
      ]),
  ]
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
}

export function exportBoxesCsv(state: AppState): string {
  const boxBalances = carryIn(state, state.year).boxBalances
  const rows = [
    ['nome', 'cor', 'saldo_inicial', 'meta', 'data_alvo_mes', 'aporte_mensal', 'dia_aporte', 'rendimento_anual'],
    ...state.boxes.map((box) => [
      box.name,
      box.color,
      csvAmount(boxBalances[box.id] ?? box.balanceCents),
      csvAmount(box.goalCents),
      box.targetMonth ?? box.targetDate?.slice(0, 7) ?? '',
      box.autoContributionCents ? csvAmount(box.autoContributionCents) : '',
      box.autoContributionDay ? String(box.autoContributionDay) : '',
      box.yieldRate === undefined ? '' : String(box.yieldRate).replace('.', ','),
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
}

function sortByDate(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ';' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function parseCsvAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '')
  if (!cleaned) return null
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned

  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    normalized = cleaned.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? ',' : '.'
    const parts = cleaned.split(separator)
    normalized = parts.length > 2 || parts[1].length === 3 ? parts.join('') : `${parts[0]}.${parts[1]}`
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null
}

function parseCsvType(raw: string): TransactionType | null {
  const normalized = normalizeHeader(raw)
  const aliases: Record<string, TransactionType> = {
    entrada: 'entrada',
    income: 'entrada',
    saida: 'saida',
    saidas: 'saida',
    expense: 'saida',
    guardar: 'guardar',
    guardarnacaixinha: 'guardar',
    resgatar: 'resgatar',
    resgatardacaixinha: 'resgatar',
  }
  return aliases[normalized] ?? null
}

export function parseTransactionsCsv(
  text: string,
  state: AppState,
): { transactions: Transaction[]; skipped: number } | null {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return null

  const headers = splitCsvLine(lines[0]).map(normalizeHeader)
  const column = (...names: string[]): number => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1

  const dateIndex = column('data', 'date')
  const descriptionIndex = column('descricao', 'description')
  const categoryIndex = column('categoria', 'category')
  const typeIndex = column('tipo', 'type')
  const amountIndex = column('valor', 'amount')
  const boxIdIndex = column('caixinhaid', 'boxid')
  const boxNameIndex = column('caixinhanome', 'boxname')

  if (dateIndex < 0 || typeIndex < 0 || amountIndex < 0) return null

  const transactions: Transaction[] = []
  let skipped = 0

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const date = cells[dateIndex]
    const type = parseCsvType(cells[typeIndex] ?? '')
    const amountCents = parseCsvAmount(cells[amountIndex] ?? '')

    if (!isValidIsoDate(date) || !type || amountCents === null) {
      skipped += 1
      continue
    }

    const boxRef = boxIdIndex >= 0 ? cells[boxIdIndex] : ''
    const boxName = boxNameIndex >= 0 ? cells[boxNameIndex] : ''
    const box =
      state.boxes.find((item) => item.id === boxRef) ??
      state.boxes.find((item) => normalizeHeader(item.name) === normalizeHeader(boxName ?? ''))

    if ((type === 'guardar' || type === 'resgatar') && !box) {
      skipped += 1
      continue
    }

    transactions.push({
      id: createId(),
      date,
      description: (descriptionIndex >= 0 ? cells[descriptionIndex] : '')?.slice(0, 140) || 'Importado',
      category: (categoryIndex >= 0 ? cells[categoryIndex] : '') || 'Outros',
      type,
      amountCents,
      boxId: box?.id,
    })
  }

  return { transactions, skipped }
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
