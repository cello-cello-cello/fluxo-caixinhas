import { describe, expect, it } from 'vitest'
import { centsToInput, formatBRL, parseAmountToCents } from '../lib/money'

describe('valores em BRL', () => {
  it('formata centavos com R$ e pt-BR', () => {
    expect(formatBRL(123456)).toContain('1.234,56')
    expect(centsToInput(123456)).toBe('1234,56')
  })

  it('interpreta valores digitados em formatos comuns', () => {
    expect(parseAmountToCents('10,00')).toBe(1000)
    expect(parseAmountToCents('1.234,56')).toBe(123456)
    expect(parseAmountToCents('1234.56')).toBe(123456)
    expect(parseAmountToCents('R$ 89,90')).toBe(8990)
  })

  it('rejeita valores vazios ou não positivos', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('0')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
  })
})
