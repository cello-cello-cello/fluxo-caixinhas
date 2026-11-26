import type { TransactionType } from '../types'

export const CHART_COLORS = {
  navy: '#1E3A5F',
  navyDark: '#0F2942',
  navyMuted: '#6E8CA8',
  moss: '#4A6B53',
  mossDark: '#3A5743',
  mossMuted: '#8AA08D',
  coral: '#C0604D',
  coralMuted: '#D98A76',
  terracotta: '#9E4747',
  amber: '#B47B2B',
  petrol: '#2E6F7E',
  plum: '#7A4E78',
  olive: '#6F7A3A',
  brown: '#8A6A4F',
  violet: '#5E5A9E',
  cyan: '#3C8D9E',
  rose: '#A85C6E',
  steel: '#5B6B7A',
  slate: '#94A3B8',
  track: '#EEF2F6',
} as const

export const CATEGORIES = [
  { name: 'Salário', color: CHART_COLORS.moss },
  { name: 'Dívida', color: CHART_COLORS.terracotta },
  { name: 'Rotativo', color: CHART_COLORS.plum },
  { name: 'Cartão', color: CHART_COLORS.olive },
  { name: 'Telefone', color: CHART_COLORS.navyMuted },
  { name: 'Moradia', color: CHART_COLORS.navy },
  { name: 'Alimentação', color: CHART_COLORS.coralMuted },
  { name: 'Transporte', color: CHART_COLORS.petrol },
  { name: 'Saúde', color: CHART_COLORS.mossDark },
  { name: 'Lazer', color: CHART_COLORS.amber },
  { name: 'Educação', color: CHART_COLORS.navyDark },
  { name: 'Assinaturas', color: CHART_COLORS.mossMuted },
  { name: 'Outros', color: CHART_COLORS.slate },
]

const FALLBACK_CATEGORY_COLORS = [
  CHART_COLORS.coral,
  CHART_COLORS.brown,
  CHART_COLORS.violet,
  CHART_COLORS.cyan,
  CHART_COLORS.rose,
  CHART_COLORS.steel,
] as const

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
  { value: 'guardar', label: 'Guardar na caixinha' },
  { value: 'resgatar', label: 'Resgatar da caixinha' },
]

export const BOX_COLORS = [
  CHART_COLORS.moss,
  CHART_COLORS.navy,
  CHART_COLORS.mossDark,
  CHART_COLORS.navyDark,
  CHART_COLORS.navyMuted,
  CHART_COLORS.mossMuted,
  CHART_COLORS.coralMuted,
  CHART_COLORS.slate,
]

function colorHash(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return hash
}

export function categoryColor(name: string): string {
  const exact = CATEGORIES.find((category) => category.name === name)
  if (exact) return exact.color
  return FALLBACK_CATEGORY_COLORS[colorHash(name) % FALLBACK_CATEGORY_COLORS.length] ?? CHART_COLORS.slate
}
