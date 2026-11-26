const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const compactFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatBRL(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

export function formatBRLCompact(cents: number): string {
  return compactFormatter.format(cents / 100)
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function parseAmountToCents(raw: string): number | null {
  let value = raw.trim().replace(/[^\d,.-]/g, '')
  if (!value) return null

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandSeparator = decimalSeparator === ',' ? '.' : ','
    value = value.split(thousandSeparator).join('').replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    const parts = value.split(',')
    value = parts.length > 2 || parts[1].length === 3 ? parts.join('') : `${parts[0]}.${parts[1]}`
  } else if (lastDot >= 0) {
    const parts = value.split('.')
    value = parts.length > 2 || parts[1].length === 3 ? parts.join('') : `${parts[0]}.${parts[1]}`
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null

  const cents = Math.round(parsed * 100)
  return cents > 0 ? cents : null
}

export function formatPercent(rate: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(rate)}% a.a.`
}
