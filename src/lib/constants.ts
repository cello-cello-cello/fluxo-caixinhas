import type { TransactionType } from '../types'

export const CATEGORIES = [
  { name: 'Alimentação', color: '#F59E0B' },
  { name: 'Casa', color: '#8B5CF6' },
  { name: 'Transporte', color: '#0EA5E9' },
  { name: 'Saúde', color: '#EF4444' },
  { name: 'Lazer', color: '#EC4899' },
  { name: 'Educação', color: '#6366F1' },
  { name: 'Assinaturas', color: '#14B8A6' },
  { name: 'Outros', color: '#94A3B8' },
]

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
  { value: 'guardar', label: 'Guardar na caixinha' },
  { value: 'resgatar', label: 'Resgatar da caixinha' },
]

export const BOX_COLORS = ['#FF385C', '#10B981', '#6366F1', '#F59E0B', '#0EA5E9', '#EC4899', '#8B5CF6', '#14B8A6']

export function categoryColor(name: string): string {
  return CATEGORIES.find((category) => category.name === name)?.color ?? '#94A3B8'
}
