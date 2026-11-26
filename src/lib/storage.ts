import { BOX_COLORS } from './constants'
import { isValidIsoDate } from './dates'
import type { AppState, Box, Transaction, TransactionType } from '../types'

const STORAGE_KEY = 'fluxo-caixinhas:v1'
const VALID_TYPES: TransactionType[] = ['entrada', 'saida', 'guardar', 'resgatar']

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createInitialState(year = new Date().getFullYear()): AppState {
  return { version: 1, year, initialBalanceCents: 0, boxes: [], transactions: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function toColor(value: unknown, fallback = '#FF385C'): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function optionalDate(value: unknown): string | undefined {
  return isValidIsoDate(value) ? value : undefined
}

function sanitizeBox(value: unknown): Box | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : ''
  if (!name) return null

  const rate = Number(value.yieldRate)
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    name,
    color: toColor(value.color, BOX_COLORS[0]),
    balanceCents: Math.max(0, toInteger(value.balanceCents)),
    goalCents: Math.max(0, toInteger(value.goalCents)),
    targetDate: optionalDate(value.targetDate),
    yieldRate: Number.isFinite(rate) ? Math.min(1000, Math.max(-99, rate)) : undefined,
  }
}

function sanitizeTransaction(value: unknown, boxIds: Set<string>): Transaction | null {
  if (!isRecord(value)) return null
  if (!isValidIsoDate(value.date)) return null

  const type = VALID_TYPES.find((item) => item === value.type)
  if (!type) return null

  const amountCents = Math.max(0, toInteger(value.amountCents))
  if (amountCents === 0) return null

  const description = typeof value.description === 'string' ? value.description.trim().slice(0, 140) : ''
  const category = typeof value.category === 'string' && value.category.trim() ? value.category.trim() : 'Outros'
  const boxId = typeof value.boxId === 'string' && boxIds.has(value.boxId) ? value.boxId : undefined

  if ((type === 'guardar' || type === 'resgatar') && !boxId) return null

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    date: value.date,
    description: description || (type === 'entrada' ? 'Entrada' : type === 'saida' ? 'Saída' : 'Transferência'),
    category,
    type,
    amountCents,
    boxId,
  }
}

export function sanitizeState(value: unknown): AppState | null {
  if (!isRecord(value) || value.version !== 1) return null

  const year = toInteger(value.year, new Date().getFullYear())
  const boxes = Array.isArray(value.boxes)
    ? value.boxes.map(sanitizeBox).filter((box): box is Box => box !== null)
    : []
  const boxIds = new Set(boxes.map((box) => box.id))
  const transactions = Array.isArray(value.transactions)
    ? value.transactions
        .map((item) => sanitizeTransaction(item, boxIds))
        .filter((item): item is Transaction => item !== null)
    : []

  return {
    version: 1,
    year: Math.min(2200, Math.max(1900, year)),
    initialBalanceCents: toInteger(value.initialBalanceCents),
    boxes,
    transactions,
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
    ...sortByDate(state.transactions)
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
  const rows = [
    ['nome', 'cor', 'saldo_inicial', 'meta', 'data_alvo', 'rendimento_anual'],
    ...state.boxes.map((box) => [
      box.name,
      box.color,
      csvAmount(box.balanceCents),
      csvAmount(box.goalCents),
      box.targetDate ?? '',
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
