import { describe, expect, it } from 'vitest'
import { findBestDepositDay, planBoxGoal } from '../lib/boxes'
import { calculateAnnualFlow } from '../lib/calc'
import { createInitialState } from '../lib/storage'
import type { Box, MonthFlow, Transaction } from '../types'

const box: Box = {
  id: 'viagem',
  name: 'Viagem',
  color: '#4A6B53',
  balanceCents: 20_000,
  goalCents: 80_000,
  targetDate: '2026-04-10',
}

function transaction(partial: Pick<Transaction, 'date' | 'type' | 'amountCents'> & Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? `${partial.date}-${partial.type}-${partial.amountCents}`,
    date: partial.date,
    type: partial.type,
    amountCents: partial.amountCents,
    description: partial.description ?? 'Teste',
    category: partial.category ?? 'Outros',
    boxId: partial.boxId,
    recurrenceDay: partial.recurrenceDay,
    adjustToBusinessDay: partial.adjustToBusinessDay,
    sourceId: partial.sourceId,
  }
}

function septemberFlow(transactions: Transaction[]): MonthFlow {
  const state = createInitialState(2026)
  state.initialBalanceCents = 100_000
  state.transactions = transactions
  return calculateAnnualFlow(state, 2026).months[8]
}

function dailyBalances(flow: MonthFlow): Record<number, number> {
  return Object.fromEntries(flow.days.map((day) => [day.day, day.balanceCents]))
}

describe('planejamento de meta da caixinha', () => {
  it('divide o valor restante pelos meses entre o mês atual e a data alvo', () => {
    expect(planBoxGoal(box, 20_000, '2026-01-15')).toEqual({
      remainingCents: 60_000,
      monthsRemaining: 3,
      monthlyContributionCents: 20_000,
      achieved: false,
      overdue: false,
      hasTargetDate: true,
    })
  })

  it('aceita o prazo em mês/ano sem depender do dia alvo', () => {
    expect(planBoxGoal({ ...box, targetDate: undefined, targetMonth: '2026-04' }, 20_000, '2026-01-15')).toEqual({
      remainingCents: 60_000,
      monthsRemaining: 3,
      monthlyContributionCents: 20_000,
      achieved: false,
      overdue: false,
      hasTargetDate: true,
    })
  })

  it('marca meta atingida e prazo vencido', () => {
    const achieved = planBoxGoal(box, 80_000, '2026-01-15')
    expect(achieved?.achieved).toBe(true)
    expect(achieved?.monthlyContributionCents).toBe(0)

    const overdue = planBoxGoal(box, 20_000, '2026-05-01')
    expect(overdue?.overdue).toBe(true)
    expect(overdue?.monthsRemaining).toBe(0)
    expect(overdue?.monthlyContributionCents).toBe(60_000)
  })

  it('usa o valor restante integral quando não há prazo', () => {
    const plan = planBoxGoal({ ...box, targetDate: undefined }, 20_000, '2026-01-15')

    expect(plan?.hasTargetDate).toBe(false)
    expect(plan?.monthsRemaining).toBe(0)
    expect(plan?.monthlyContributionCents).toBe(60_000)
  })
})

describe('melhor dia para depositar na caixinha', () => {
  it('não recomenda dia quando não há aporte necessário', () => {
    expect(findBestDepositDay(0, {}, 30)).toEqual({
      recommendedDay: null,
      projectedMinBalance: 0,
      hasNegativeRisk: false,
      reason: 'Meta já atingida ou sem aporte necessário.',
    })
  })

  it('escolhe o primeiro dia seguro após a entrada do mês', () => {
    const result = findBestDepositDay(
      50_000,
      dailyBalances(
        septemberFlow([
          transaction({ date: '2026-09-15', type: 'entrada', amountCents: 300_000 }),
          transaction({ date: '2026-09-20', type: 'saida', amountCents: 200_000 }),
        ]),
      ),
      30,
    )

    expect(result).toMatchObject({
      recommendedDay: 15,
      projectedMinBalance: 150_000,
      hasNegativeRisk: false,
    })
    expect(result.reason).toContain('Mantém o saldo livre positivo até o fim do mês')
  })

  it('considera entrada antecipada para o dia útil anterior', () => {
    const result = findBestDepositDay(
      50_000,
      dailyBalances(
        septemberFlow([transaction({ date: '2026-09-19', type: 'entrada', amountCents: 300_000, adjustToBusinessDay: true })]),
      ),
      30,
    )

    expect(result).toMatchObject({
      recommendedDay: 18,
      projectedMinBalance: 350_000,
      hasNegativeRisk: false,
    })
  })

  it('aponta o menor saldo negativo quando nenhum dia preserva o caixa livre', () => {
    const result = findBestDepositDay(200_000, dailyBalances(septemberFlow([])), 30)

    expect(result).toMatchObject({
      recommendedDay: 1,
      projectedMinBalance: -100_000,
      hasNegativeRisk: true,
    })
    expect(result.reason).toContain('Mesmo no melhor dia (1)')
  })
})
