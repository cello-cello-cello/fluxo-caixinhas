import { describe, expect, it } from 'vitest'
import {
  applyRecurrenceChange,
  availableFor,
  calculateAnnualFlow,
  calculateBreathingRoom,
  calculatePosition,
  expandTransactions,
  getCurrentPosition,
  resolveBaseId,
} from '../lib/calc'
import { CATEGORIES, categoryColor, CHART_COLORS } from '../lib/constants'
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
    recurrenceDay: partial.recurrenceDay,
    recurrenceEnd: partial.recurrenceEnd,
    adjustToBusinessDay: partial.adjustToBusinessDay,
    sourceId: partial.sourceId,
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

  it('soma várias entradas e saídas no mesmo dia e recalcula após exclusão', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({ id: 'e1', date: '2026-01-10', type: 'entrada', amountCents: 5_000 }),
      transaction({ id: 'e2', date: '2026-01-10', type: 'entrada', amountCents: 2_000 }),
      transaction({ id: 's1', date: '2026-01-10', type: 'saida', amountCents: 1_000 }),
      transaction({ id: 's2', date: '2026-01-10', type: 'saida', amountCents: 500 }),
    ]

    const flow = calculateAnnualFlow(state, 2026)
    const januaryDay = flow.months[0].days[9]

    expect(januaryDay.transactions).toHaveLength(4)
    expect(januaryDay.incomeCents).toBe(7_000)
    expect(januaryDay.expenseCents).toBe(1_500)
    expect(flow.months[11].closingBalanceCents).toBe(105_500)

    const afterDeletion = {
      ...state,
      transactions: state.transactions.filter((item) => item.id !== 'e2'),
    }
    const recalculated = calculateAnnualFlow(afterDeletion, 2026)

    expect(recalculated.months[0].days[9].incomeCents).toBe(5_000)
    expect(recalculated.months[11].closingBalanceCents).toBe(103_500)
  })

  it('separa transferências de caixinha das saídas de consumo', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.boxes = [
      { id: 'viagem', name: 'Viagem', color: '#4A6B53', balanceCents: 50_000, goalCents: 200_000 },
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

  it('usa o fechamento de dezembro como abertura do ano seguinte', () => {
    const state = createInitialState(2027)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({ id: 'fechamento', date: '2026-12-31', type: 'saida', amountCents: 1_000 }),
      transaction({ id: 'atual', date: '2027-01-10', type: 'saida', amountCents: 500 }),
    ]

    const flow = calculateAnnualFlow(state, 2027)

    expect(flow.openingBalanceCents).toBe(99_000)
    expect(flow.months[0].days[0].balanceCents).toBe(99_000)
    expect(flow.months[0].days[9].balanceCents).toBe(98_500)
    expect(flow.closingBalanceCents).toBe(98_500)

    const afterDeletion = {
      ...state,
      transactions: state.transactions.filter((item) => item.id !== 'fechamento'),
    }

    expect(calculateAnnualFlow(afterDeletion, 2027).openingBalanceCents).toBe(100_000)
  })

  it('propaga saldo livre e caixinhas para janeiro do ano seguinte', () => {
    const state = createInitialState(2027)
    state.initialBalanceCents = 100_000
    state.boxes = [{ id: 'b1', name: 'Viagem', color: '#4A6B53', balanceCents: 5_000, goalCents: 50_000 }]
    state.transactions = [
      transaction({ id: 'g1', date: '2026-06-01', type: 'guardar', amountCents: 20_000, boxId: 'b1' }),
      transaction({ id: 'r1', date: '2026-07-01', type: 'resgatar', amountCents: 3_000, boxId: 'b1' }),
    ]

    const position = calculatePosition(state, '2027-01-01')
    const available = availableFor(state, '2027-01-05', 'b1')

    expect(position.freeBalanceCents).toBe(83_000)
    expect(position.boxBalances.b1).toBe(22_000)
    expect(position.netWorthCents).toBe(105_000)
    expect(available).toEqual({ freeCents: 83_000, boxCents: 22_000 })
  })

  it('calcula a posição no fechamento do mês com saldo vindo do ano anterior', () => {
    const state = createInitialState(2027)
    state.initialBalanceCents = 100_000
    state.boxes = [{ id: 'b1', name: 'Viagem', color: '#4A6B53', balanceCents: 0, goalCents: 50_000 }]
    state.transactions = [
      transaction({ id: 'fechamento', date: '2026-12-31', type: 'saida', amountCents: 1_000 }),
      transaction({ id: 'salario', date: '2027-01-10', type: 'entrada', amountCents: 500 }),
      transaction({ id: 'guardar', date: '2027-02-10', type: 'guardar', amountCents: 2_000, boxId: 'b1' }),
    ]

    const january = calculatePosition(state, '2027-01-31')
    const february = calculatePosition(state, '2027-02-28')
    const december = calculatePosition(state, '2027-12-31')

    expect(january.freeBalanceCents).toBe(99_500)
    expect(january.totalBoxCents).toBe(0)
    expect(february.freeBalanceCents).toBe(97_500)
    expect(february.totalBoxCents).toBe(2_000)
    expect(february.netWorthCents).toBe(99_500)
    expect(december.freeBalanceCents).toBe(97_500)
    expect(december.totalBoxCents).toBe(2_000)
  })

  it('repete um lançamento mensalmente e ajusta meses curtos', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({ id: 'aluguel', date: '2026-01-31', type: 'saida', amountCents: 1_000, recurrenceDay: 31 }),
    ]

    const occurrences = expandTransactions(state.transactions)
    const flow = calculateAnnualFlow(state, 2026)

    expect(occurrences).toHaveLength(24)
    expect(occurrences.filter((item) => item.date.startsWith('2026-'))).toHaveLength(12)
    expect(occurrences.map((item) => item.date)).toEqual(
      expect.arrayContaining(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']),
    )
    expect(new Set(occurrences.map((item) => item.id)).size).toBe(24)
    expect(occurrences[1].sourceId).toBe('aluguel')
    expect(flow.months[1].days[27].expenseCents).toBe(1_000)
    expect(flow.totalExpenseCents).toBe(12_000)
    expect(flow.closingBalanceCents).toBe(88_000)
  })

  it('limita a recorrência ao mês e ao ano escolhidos', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({
        id: 'aluguel',
        date: '2026-01-31',
        type: 'saida',
        amountCents: 1_000,
        recurrenceDay: 31,
        recurrenceEnd: '2026-04',
      }),
    ]

    const occurrences = expandTransactions(state.transactions)
    const flow = calculateAnnualFlow(state, 2026)

    expect(occurrences.map((item) => item.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
    expect(flow.totalExpenseCents).toBe(4_000)
    expect(flow.closingBalanceCents).toBe(96_000)
  })

  it('edita apenas uma ocorrência e mantém o restante da série original', () => {
    const base = transaction({
      id: 'aluguel',
      date: '2026-01-31',
      type: 'saida',
      amountCents: 1_000,
      recurrenceDay: 31,
      recurrenceEnd: '2026-12',
    })
    const result = applyRecurrenceChange(
      [base],
      {
        baseId: base.id,
        occurrenceId: 'aluguel:2026-02',
        occurrenceMonth: '2026-02',
        scope: 'single',
      },
      transaction({
        id: 'aluguel:2026-02',
        date: '2026-02-28',
        type: 'saida',
        amountCents: 2_000,
      }),
    )

    expect(result).toHaveLength(3)
    expect(result[0].recurrenceEnd).toBe('2026-01')
    expect(result[1]).toMatchObject({
      id: 'aluguel:2026-02',
      date: '2026-02-28',
      amountCents: 2_000,
      recurrenceDay: undefined,
      recurrenceEnd: undefined,
    })
    expect(result[2].date).toBe('2026-03-31')
    expect(result[2].amountCents).toBe(1_000)
    expect(result[2].recurrenceEnd).toBe('2026-12')

    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = result
    expect(calculateAnnualFlow(state, 2026).closingBalanceCents).toBe(87_000)
  })

  it('remove somente as ocorrências a partir do mês escolhido', () => {
    const base = transaction({
      id: 'aluguel',
      date: '2026-01-31',
      type: 'saida',
      amountCents: 1_000,
      recurrenceDay: 31,
      recurrenceEnd: '2026-12',
    })
    const result = applyRecurrenceChange([base], {
      baseId: base.id,
      occurrenceId: 'aluguel:2026-02',
      occurrenceMonth: '2026-02',
      scope: 'series',
    })

    expect(result).toHaveLength(1)
    expect(result[0].recurrenceEnd).toBe('2026-01')
  })

  it('resolve a ocorrência até o lançamento base da série', () => {
    const state = createInitialState(2026)
    state.transactions = [
      transaction({ id: 'aluguel', date: '2026-01-31', type: 'saida', amountCents: 1_000, recurrenceDay: 31 }),
    ]
    const occurrences = expandTransactions(state.transactions)

    expect(resolveBaseId(occurrences, occurrences[1].id)).toBe('aluguel')

    const afterDeletion = {
      ...state,
      transactions: state.transactions.filter((item) => item.id !== resolveBaseId(occurrences, occurrences[1].id)),
    }

    expect(calculateAnnualFlow(afterDeletion, 2026).totalExpenseCents).toBe(0)
  })

  it('antecipa um lançamento único de fim de semana e recalcula o fluxo', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({
        id: 'cafe',
        date: '2026-09-19',
        type: 'saida',
        amountCents: 1_000,
        adjustToBusinessDay: true,
      }),
    ]

    const flow = calculateAnnualFlow(state, 2026)

    expect(expandTransactions(state.transactions)[0].date).toBe('2026-09-18')
    expect(flow.months[8].days[17].expenseCents).toBe(1_000)
    expect(flow.months[8].days[18].expenseCents).toBe(0)
    expect(flow.totalExpenseCents).toBe(1_000)
    expect(flow.closingBalanceCents).toBe(99_000)
  })

  it('aplica a antecipação em cada ocorrência da recorrência mensal', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({
        id: 'assinatura',
        date: '2026-08-15',
        type: 'saida',
        amountCents: 1_000,
        recurrenceDay: 15,
        adjustToBusinessDay: true,
      }),
    ]

    const occurrences = expandTransactions(state.transactions)
    const flow = calculateAnnualFlow(state, 2026)

    expect(occurrences.map((item) => item.date)).toEqual(
      expect.arrayContaining(['2026-08-14', '2026-09-15', '2026-10-15', '2026-11-13', '2026-12-15']),
    )
    expect(flow.months[7].days[13].expenseCents).toBe(1_000)
    expect(flow.months[8].days[14].expenseCents).toBe(1_000)
    expect(flow.months[10].days[12].expenseCents).toBe(1_000)
    expect(flow.totalExpenseCents).toBe(5_000)
    expect(flow.closingBalanceCents).toBe(95_000)
  })

  it('continua a recorrência mensal em janeiro do ano seguinte', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({
        id: 'aluguel',
        date: '2026-12-15',
        type: 'saida',
        amountCents: 1_000,
        recurrenceDay: 15,
      }),
    ]

    const occurrences = expandTransactions(state.transactions)
    const nextFlow = calculateAnnualFlow(state, 2027)

    expect(occurrences.map((item) => item.date)).toEqual(
      expect.arrayContaining(['2026-12-15', '2027-01-15', '2027-02-15', '2027-12-15']),
    )
    expect(occurrences.filter((item) => item.date.startsWith('2027-'))).toHaveLength(12)
    expect(new Set(occurrences.map((item) => item.id)).size).toBe(13)
    expect(nextFlow.openingBalanceCents).toBe(99_000)
    expect(nextFlow.months[0].days[14].expenseCents).toBe(1_000)
    expect(nextFlow.totalExpenseCents).toBe(12_000)
    expect(nextFlow.closingBalanceCents).toBe(87_000)
  })

  it('ajusta o último dia do mês sem sair do mês corrente', () => {
    const state = createInitialState(2027)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({
        id: 'conta',
        date: '2027-01-31',
        type: 'saida',
        amountCents: 1_000,
        recurrenceDay: 31,
        adjustToBusinessDay: true,
      }),
    ]

    const occurrences = expandTransactions(state.transactions)
    const flow = calculateAnnualFlow(state, 2027)

    expect(occurrences.map((item) => item.date)).toEqual(
      expect.arrayContaining(['2027-01-29', '2027-02-26', '2027-03-31']),
    )
    expect(flow.months[0].days[28].expenseCents).toBe(1_000)
    expect(flow.months[1].days[25].expenseCents).toBe(1_000)
    expect(flow.totalExpenseCents).toBe(12_000)
  })
})

describe('respiro', () => {
  it('calcula a folga imediatamente antes da próxima entrada', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({ id: 'a-conta', date: '2026-01-03', type: 'saida', amountCents: 20_000 }),
      transaction({ id: 'b-salario', date: '2026-01-05', type: 'entrada', amountCents: 50_000 }),
      transaction({ id: 'a-taxa', date: '2026-01-05', type: 'saida', amountCents: 5_000 }),
    ]

    const flow = calculateAnnualFlow(state, 2026)

    expect(calculateBreathingRoom(flow, 0, '2026-02-01')).toEqual({
      date: '2026-01-05',
      amountCents: 75_000,
      hasIncome: true,
    })
  })

  it('começa do dia atual quando o mês selecionado é o atual', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [
      transaction({ date: '2026-01-02', type: 'entrada', amountCents: 50_000 }),
      transaction({ date: '2026-01-06', type: 'saida', amountCents: 10_000 }),
      transaction({ date: '2026-01-10', type: 'entrada', amountCents: 50_000 }),
    ]

    const flow = calculateAnnualFlow(state, 2026)

    expect(calculateBreathingRoom(flow, 0, '2026-01-06')).toEqual({
      date: '2026-01-10',
      amountCents: 140_000,
      hasIncome: true,
    })
  })

  it('usa o fechamento do mês quando não há próxima entrada', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.transactions = [transaction({ date: '2026-01-10', type: 'saida', amountCents: 15_000 })]

    const flow = calculateAnnualFlow(state, 2026)

    expect(calculateBreathingRoom(flow, 0, '2026-02-01')).toEqual({
      date: '2026-01-31',
      amountCents: 85_000,
      hasIncome: false,
    })
  })
})

describe('cores por categoria', () => {
  it('atribui uma cor diferente a cada categoria conhecida', () => {
    const colors = CATEGORIES.map((category) => category.color)

    expect(new Set(colors).size).toBe(CATEGORIES.length)
    expect(categoryColor('Salário')).toBe(CHART_COLORS.moss)
    expect(categoryColor('Dívida')).toBe(CHART_COLORS.terracotta)
    expect(categoryColor('Rotativo')).not.toBe(categoryColor('Cartão'))
    expect(categoryColor('Telefone')).not.toBe(categoryColor('Salário'))
  })

  it('mantém uma cor estável para categorias criadas pelo usuário', () => {
    const first = categoryColor('Categoria personalizada')
    const second = categoryColor('Categoria personalizada')

    expect(first).toBe(second)
    expect(first).not.toBe(CHART_COLORS.slate)
  })
})
