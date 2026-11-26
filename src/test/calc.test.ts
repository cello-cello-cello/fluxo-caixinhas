import { describe, expect, it } from 'vitest'
import { calculateAnnualFlow, calculatePosition, getCurrentPosition } from '../lib/calc'
import { createInitialState } from '../lib/storage'
import type { Transaction } from '../types'

function transaction(partial: Partial<Transaction> & Pick<Transaction, 'date' | 'type' | 'amountCents'>): Transaction {
  return {
    id: partial.id ?? `${partial.date}-${partial.type}-${partial.amountCents}`,
    date: partial.date,
    type: partial.type,
    amountCents: partial.amountCents,
    description: partial.description ?? 'Teste',
    category: partial.category ?? 'Outros',
    boxId: partial.boxId,
  }
}

describe('fluxo de caixa encadeado', () => {
  it('propaga uma saída de janeiro até o fechamento de dezembro', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [transaction({ date: '2026-01-10', type: 'saida', amountCents: 1_000 })]

    const flow = calculateAnnualFlow(state, 2026)

    expect(flow.months[0].closingBalanceCents).toBe(99_000)
    expect(flow.months[1].openingBalanceCents).toBe(99_000)
    expect(flow.months[11].closingBalanceCents).toBe(99_000)
    expect(flow.closingBalanceCents).toBe(99_000)
  })

  it('separa transferências de caixinha das saídas de consumo', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.boxes = [
      { id: 'viagem', name: 'Viagem', color: '#FF385C', balanceCents: 50_000, goalCents: 200_000 },
    ]
    state.transactions = [
      transaction({ date: '2026-02-05', type: 'guardar', amountCents: 20_000, boxId: 'viagem' }),
      transaction({ date: '2026-04-05', type: 'resgatar', amountCents: 5_000, boxId: 'viagem' }),
      transaction({ date: '2026-03-05', type: 'saida', amountCents: 3_000 }),
    ]

    const flow = calculateAnnualFlow(state, 2026)
    const position = calculatePosition(state, '2026-12-31')

    expect(flow.totalExpenseCents).toBe(3_000)
    expect(flow.totalToBoxCents).toBe(20_000)
    expect(flow.totalFromBoxCents).toBe(5_000)
    expect(flow.closingBalanceCents).toBe(82_000)
    expect(position.freeBalanceCents).toBe(82_000)
    expect(position.boxBalances.viagem).toBe(65_000)
    expect(position.netWorthCents).toBe(147_000)
  })

  it('respeita a quantidade real de dias de cada mês', () => {
    const state = createInitialState(2024)
    const flow = calculateAnnualFlow(state, 2024)

    expect(flow.months[0].days).toHaveLength(31)
    expect(flow.months[1].days).toHaveLength(29)
    expect(flow.months[3].days).toHaveLength(30)
  })

  it('calcula a posição atual sem adiantar lançamentos futuros', () => {
    const state = createInitialState(new Date().getFullYear())
    state.initialBalanceCents = 50_000
    const year = new Date().getFullYear()
    state.transactions = [transaction({ date: `${year}-01-31`, type: 'entrada', amountCents: 10_000 })]

    const position = getCurrentPosition(state)

    expect(position.freeBalanceCents).toBe(60_000)
  })
})
