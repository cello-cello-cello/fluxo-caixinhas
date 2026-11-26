import type { TransactionType } from '../types'

export const CATEGORIES = [
  { name: 'Alimentação', color: '#4A6B53' },
  { name: 'Casa', color: '#1E3A5F' },
  { name: 'Transporte', color: '#6E8CA8' },
  { name: 'Saúde', color: '#3A5743' },
  { name: 'Lazer', color: '#0F2942' },
  { name: 'Educação', color: '#8AA08D' },
  { name: 'Assinaturas', color: '#5D7A8C' },
  { name: 'Outros', color: '#94A3B8' },
]

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
  { value: 'guardar', label: 'Guardar na caixinha' },
  { value: 'resgatar', label: 'Resgatar da caixinha' },
]

export const BOX_COLORS = ['#4A6B53', '#1E3A5F', '#3A5743', '#0F2942', '#6E8CA8', '#8AA08D', '#5D7A8C', '#94A3B8']

export function categoryColor(name: string): string {
  return CATEGORIES.find((category) => category.name === name)?.color ?? '#94A3B8'
}
