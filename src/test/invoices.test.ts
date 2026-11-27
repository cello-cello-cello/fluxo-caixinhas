import { describe, expect, it } from 'vitest'
import {
  buildInstallmentTransactions,
  cardCommitment,
  countPlannedTransactions,
  installmentDueDate,
  parseInvoiceDocument,
  parseInvoiceLines,
} from '../lib/invoices'
import { createInitialState } from '../lib/storage'
import type { CreditCard } from '../types'

const card: CreditCard = {
  id: 'c1',
  name: 'Cartão',
  limitCents: 100_000,
  closingDay: 10,
  dueDay: 15,
}

describe('importação da fatura', () => {
  it('extrai descrição, valor, data e parcelas das linhas do PDF', () => {
    const items = parseInvoiceLines([
      '15/10 SUPERMERCADO R$ 125,90',
      '15/10 NETFLIX parc. 02/10 R$ 39,90',
      '15/10 LOJA X parc. 03/06 R$ 100,00',
      'TOTAL R$ 1.000,00',
    ], '2026-11')

    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({
      description: 'SUPERMERCADO',
      amountCents: 12_590,
      currentInstallment: 1,
      installmentCount: 1,
      purchaseDate: '2026-10-15',
    })
    expect(items[1]).toMatchObject({
      description: 'NETFLIX',
      amountCents: 3_990,
      currentInstallment: 2,
      installmentCount: 10,
      purchaseDate: '2026-10-15',
    })
    expect(items[2]).toMatchObject({
      description: 'LOJA X',
      amountCents: 10_000,
      currentInstallment: 3,
      installmentCount: 6,
      purchaseDate: '2026-10-15',
    })
  })

  it('normaliza faturas do Santander e ignora linhas que não são lançamentos', () => {
    const parsed = parseInvoiceDocument([
      'Cartão final 4761',
      'Compras',
      'CET R$ 12,00',
      '15/10 COMPRA PARCELADA 02/06 30.50',
      '15/10 PAGAMENTO - R$ 50,00',
      '4000-1234 15/10 SUPERMERCADO R$ 20,00',
    ], '2026-11')

    expect(parsed.sections).toEqual(['Final 4761', 'Compras'])
    expect(parsed.rawText).toContain('15/10 COMPRA PARCELADA 02/06 30,50')
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[0]).toMatchObject({
      description: 'COMPRA',
      amountCents: 3_050,
      currentInstallment: 2,
      installmentCount: 6,
      purchaseDate: '2026-10-15',
      source: 'Final 4761 · Compras',
    })
    expect(parsed.items[1]).toMatchObject({
      description: 'Crédito da fatura',
      amountCents: -5_000,
      currentInstallment: 1,
      installmentCount: 1,
      source: 'Final 4761 · Compras',
    })
  })

  it('descarta parcelas anteriores ao mês inicial escolhido', () => {
    const items = [{
      id: 'parcelada',
      description: 'Compra',
      amountCents: 10_000,
      currentInstallment: 1,
      installmentCount: 3,
    }]

    const transactions = buildInstallmentTransactions(card, items, '2026-11', { fromMonth: '2026-12' })
    expect(transactions.map((item) => item.date)).toEqual(['2026-12-15', '2027-01-15'])
    expect(countPlannedTransactions(card, items, '2026-11', '2026-12')).toBe(2)
  })

  it('antecipa o vencimento que cai em domingo para o dia útil anterior', () => {
    expect(installmentDueDate(card, 2026, 10)).toBe('2026-11-13')
    expect(installmentDueDate(card, 2026, 11)).toBe('2026-12-15')
  })
})

describe('projeção de parcelas', () => {
  it('gera a parcela atual e as seguintes até a última no vencimento de cada mês', () => {
    const transactions = buildInstallmentTransactions(
      card,
      [{ id: 'netflix', description: 'NETFLIX', amountCents: 10_000, currentInstallment: 2, installmentCount: 6 }],
      '2026-11',
    )

    expect(transactions.map((item) => item.date)).toEqual([
      '2026-11-13',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
      '2027-03-15',
    ])
    expect(transactions.map((item) => item.installmentIndex)).toEqual([2, 3, 4, 5, 6])
    expect(transactions[0]).toMatchObject({
      cardId: 'c1',
      installmentGroupId: 'c1:netflix',
      type: 'saida',
      category: 'Cartão',
      description: 'NETFLIX (2/6)',
    })
  })

  it('respeita um vencimento ajustado manualmente na parcela atual', () => {
    const [first] = buildInstallmentTransactions(
      card,
      [{
        id: 'manual',
        description: 'Compra',
        amountCents: 5_000,
        currentInstallment: 1,
        installmentCount: 2,
        dueDate: '2026-11-20',
      }],
      '2026-11',
    )

    expect(first.date).toBe('2026-11-20')
  })

  it('compromete o limite com as parcelas futuras em aberto', () => {
    const state = createInitialState(2026)
    state.cards = [{ ...card, limitCents: 30_000 }]
    state.transactions = buildInstallmentTransactions(
      card,
      [{ id: 'parcelada', description: 'Compra', amountCents: 10_000, currentInstallment: 2, installmentCount: 6 }],
      '2026-11',
    )

    expect(cardCommitment(state, 'c1', new Date(2026, 10, 27))).toEqual({
      committedCents: 50_000,
      availableCents: 0,
      openInstallments: 5,
      exceeded: true,
    })
  })

  it('desconta créditos e pagamentos do comprometimento do limite', () => {
    const state = createInitialState(2026)
    state.cards = [{ ...card, limitCents: 30_000 }]
    state.transactions = [
      ...buildInstallmentTransactions(
        card,
        [{ id: 'parcelada', description: 'Compra', amountCents: 10_000, currentInstallment: 2, installmentCount: 6 }],
        '2026-11',
      ),
      {
        id: 'pagamento',
        date: '2026-11-15',
        description: 'Pagamento (2/6)',
        category: 'Cartão',
        type: 'entrada',
        amountCents: 20_000,
        cardId: 'c1',
      },
    ]

    expect(cardCommitment(state, 'c1', new Date(2026, 10, 27))).toEqual({
      committedCents: 30_000,
      availableCents: 0,
      openInstallments: 6,
      exceeded: false,
    })
  })
})
