import { describe, expect, it } from 'vitest'
import {
  buildInstallmentTransactions,
  cardCommitment,
  cardDueDate,
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

const parceledItems = [
  { id: 'parcelada', description: 'Compra', amountCents: 10_000, currentInstallment: 2, installmentCount: 6 },
]

function invoiceFor(invoiceItems: typeof parceledItems, invoiceMonth = '2026-11') {
  return {
    id: `c1:${invoiceMonth}`,
    cardId: 'c1',
    invoiceMonth,
    items: invoiceItems,
    rawText: '',
    sections: [],
  }
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
      kind: 'credito',
      source: 'Final 4761 · Compras',
    })
  })

  it('reconstrói linhas quebradas, remove ruído e preserva letras acentuadas', () => {
    const parsed = parseInvoiceDocument([
      'Cartão final 8018',
      'CAFÉ @ DA ESQUINA',
      '15/10',
      'parc. 02/06',
      '30.50 ))',
      'Resumo da Fatura VALOR TOTAL R$ 96.67',
      'CET R$ 12,00',
      'SAC 0800 123 4567',
    ], '2026-11')

    expect(parsed.totalCents).toBe(9_667)
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]).toMatchObject({
      description: 'CAFÉ DA ESQUINA',
      amountCents: 3_050,
      currentInstallment: 2,
      installmentCount: 6,
      kind: 'parcela',
      purchaseDate: '2026-10-15',
      source: 'Final 8018',
    })
    expect(parsed.rawText).toContain('CAFÉ DA ESQUINA 15/10 parc. 02/06 30,50')
  })

  it('classifica itens, detecta o total e associa o final de cada bloco', () => {
    const parsed = parseInvoiceDocument([
      'Fatura final 4761',
      '15/10 MERCADO 96.67',
      '15/10 PAGAMENTO -531,71',
      'Cartão final 3785',
      'Juros',
      '15/10 JUROS 12,34',
      'Fatura final 8018',
      '15/10 LOJA 30,50',
      'VALOR TOTAL R$ 1.234,56',
    ], '2026-11')

    expect(parsed.totalCents).toBe(123_456)
    expect(parsed.items.map((item) => item.kind)).toEqual(['vista', 'credito', 'encargo', 'vista'])
    expect(parsed.items.map((item) => item.source)).toEqual([
      'Final 4761',
      'Final 4761',
      'Final 3785',
      'Final 8018',
    ])
    expect(parsed.items[1].amountCents).toBe(-53_171)
    expect(parsed.items[2].description).toBe('JUROS')
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

  it('respeita fechamento em dezembro e vencimento em janeiro do ano seguinte', () => {
    const rolloverCard: CreditCard = {
      ...card,
      closingDate: '2026-12-25',
      dueDate: '2027-01-01',
    }
    const projections = buildInstallmentTransactions(
      rolloverCard,
      [{ id: 'tv', description: 'TV', amountCents: 10_000, currentInstallment: 1, installmentCount: 3 }],
      '2026-12',
    )

    expect(cardDueDate(rolloverCard, '2026-12')).toBe('2027-01-01')
    expect(projections.map((item) => item.date)).toEqual(['2027-01-01', '2027-02-01', '2027-03-01'])
  })

  it('ajusta vencimento em fim de semana e dia inexistente no mês seguinte', () => {
    expect(cardDueDate({ ...card, dueDate: '2027-01-02' }, '2026-12')).toBe('2027-01-01')
    expect(cardDueDate({ ...card, dueDate: '2024-01-31' }, '2023-12', 1)).toBe('2024-02-29')
  })

  it('não usa lançamentos do fluxo para comprometer o limite do cartão', () => {
    const state = createInitialState(2026)
    state.cards = [{ ...card, limitCents: 60_000 }]
    state.cardInvoices = [invoiceFor(parceledItems)]
    state.transactions = [{
      id: 'fluxo',
      date: '2026-11-15',
      description: 'Gasto avulso',
      category: 'Outros',
      type: 'saida',
      amountCents: 999_999,
      cardId: 'c1',
    }]

    expect(cardCommitment(state, 'c1', new Date(2026, 10, 27)).committedCents).toBe(50_000)
  })

  it('compromete o limite com as parcelas futuras em aberto', () => {
    const state = createInitialState(2026)
    state.cards = [{ ...card, limitCents: 30_000 }]
    state.cardInvoices = [invoiceFor(parceledItems)]

    expect(cardCommitment(state, 'c1', new Date(2026, 10, 27))).toEqual({
      committedCents: 50_000,
      availableCents: 0,
      openInstallments: 5,
      futureInstallments: 4,
      exceeded: true,
    })
  })

  it('desconta créditos e pagamentos do comprometimento do limite', () => {
    const state = createInitialState(2026)
    state.cards = [{ ...card, limitCents: 30_000 }]
    state.cardInvoices = [invoiceFor([
      ...parceledItems,
      { id: 'credito', description: 'Crédito', amountCents: -20_000, currentInstallment: 1, installmentCount: 1 },
    ])]

    expect(cardCommitment(state, 'c1', new Date(2026, 10, 27))).toEqual({
      committedCents: 30_000,
      availableCents: 0,
      openInstallments: 6,
      futureInstallments: 4,
      exceeded: false,
    })
  })

  it('mantém o disponível no teto do limite quando os créditos superam a fatura', () => {
    const state = createInitialState(2026)
    state.cards = [{ ...card, limitCents: 50_000 }]
    state.cardInvoices = [invoiceFor([
      { id: 'credito', description: 'Pagamento', amountCents: -20_000, currentInstallment: 1, installmentCount: 1 },
    ])]

    expect(cardCommitment(state, 'c1', new Date(2026, 10, 27))).toEqual({
      committedCents: -20_000,
      availableCents: 50_000,
      openInstallments: 1,
      futureInstallments: 0,
      exceeded: false,
    })
  })
})
