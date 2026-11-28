import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  exportBoxesCsv,
  exportTransactionsCsv,
  parseJsonImport,
  parseTransactionsCsv,
  sanitizeState,
} from '../lib/storage'

describe('importação e validação', () => {
  it('aceita um JSON completo válido', () => {
    const original = createInitialState(2026)
    original.initialBalanceCents = 10_000
    original.boxes = [{ id: 'b1', name: 'Reserva', color: '#1E3A5F', balanceCents: 2_000, goalCents: 9_000 }]
    original.transactions = [
      { id: 't1', date: '2026-01-02', description: 'Salário', category: 'Outros', type: 'entrada', amountCents: 5_000 },
    ]

    const imported = parseJsonImport(JSON.stringify(original))

    expect(imported).toEqual(original)
  })

  it('descarta registros inválidos sem quebrar o estado', () => {
    const imported = sanitizeState({
      version: 1,
      year: 2026,
      initialBalanceCents: 1_000,
      boxes: [{ id: 'b1', name: 'Caixinha', color: 'verde', balanceCents: -50, goalCents: 500 }],
      transactions: [
        { id: 'ok', date: '2026-03-01', description: 'Mercado', category: 'Alimentação', type: 'saida', amountCents: 100 },
        { id: 'bad-date', date: '31/03/2026', description: 'Inválida', type: 'saida', amountCents: 100 },
        { id: 'orphan', date: '2026-03-02', description: 'Órfã', type: 'guardar', amountCents: 100, boxId: 'inexistente' },
      ],
    })

    expect(imported?.boxes).toHaveLength(1)
    expect(imported?.boxes[0].balanceCents).toBe(0)
    expect(imported?.boxes[0].color).toBe('#4A6B53')
    expect(imported?.transactions).toHaveLength(1)
    expect(imported?.transactions[0].id).toBe('ok')
  })

  it('lê CSV em pt-BR e resolve caixinha por nome', () => {
    const state = createInitialState(2026)
    state.boxes = [{ id: 'b1', name: 'Viagem', color: '#4A6B53', balanceCents: 0, goalCents: 1_000 }]

    const csv = [
      'data;descricao;categoria;tipo;valor;caixinha_id;caixinha_nome',
      '2026-01-10;Mercado;Alimentação;saida;123,45;;',
      '2026-02-10;Guardar;Caixinhas;guardar;200,00;;Viagem',
    ].join('\r\n')

    const parsed = parseTransactionsCsv(csv, state)

    expect(parsed?.skipped).toBe(0)
    expect(parsed?.transactions).toHaveLength(2)
    expect(parsed?.transactions[0].amountCents).toBe(12_345)
    expect(parsed?.transactions[1].boxId).toBe('b1')
  })

  it('migra a categoria antiga Casa para Moradia', () => {
    const imported = sanitizeState({
      version: 1,
      year: 2026,
      initialBalanceCents: 1_000,
      boxes: [],
      transactions: [
        { id: 'casa', date: '2026-03-01', description: 'Aluguel', category: 'Casa', type: 'saida', amountCents: 100 },
      ],
    })

    expect(imported?.transactions[0].category).toBe('Moradia')
  })

  it('exporta o saldo da caixinha já propagado para o ano selecionado', () => {
    const state = createInitialState(2027)
    state.boxes = [{ id: 'b1', name: 'Viagem', color: '#4A6B53', balanceCents: 1_000, goalCents: 10_000 }]
    state.transactions = [
      { id: 'g1', date: '2026-05-01', description: 'Guardar', category: 'Caixinhas', type: 'guardar', amountCents: 2_000, boxId: 'b1' },
    ]

    expect(exportBoxesCsv(state)).toContain('30,00')
  })

  it('preserva a recorrência e descarta marcadores de ocorrência na sanitização', () => {
    const imported = sanitizeState({
      version: 1,
      year: 2026,
      initialBalanceCents: 0,
      boxes: [],
      transactions: [
        {
          id: 'aluguel',
          date: '2026-01-31',
          description: 'Aluguel',
          category: 'Moradia',
          type: 'saida',
          amountCents: 1_000,
          recurrenceDay: 31,
          recurrenceEnd: '2026-04',
          sourceId: 'origem',
        },
        {
          id: 'invalida',
          date: '2026-05-31',
          description: 'Inválida',
          category: 'Outros',
          type: 'saida',
          amountCents: 500,
          recurrenceDay: 31,
          recurrenceEnd: '2026-01',
        },
      ],
    })

    expect(imported?.transactions[0].recurrenceDay).toBe(31)
    expect(imported?.transactions[0].recurrenceEnd).toBe('2026-04')
    expect(imported?.transactions[0].sourceId).toBeUndefined()
    expect(imported?.transactions[1].recurrenceEnd).toBeUndefined()
  })

  it('exporta todas as ocorrências recorrentes do ano', () => {
    const state = createInitialState(2026)
    state.transactions = [
      {
        id: 'aluguel',
        date: '2026-01-31',
        description: 'Aluguel',
        category: 'Moradia',
        type: 'saida',
        amountCents: 1_000,
        recurrenceDay: 31,
      },
    ]

    const csv = exportTransactionsCsv(state)

    expect(csv).toContain('2026-02-28')
    expect(csv).toContain('2026-04-30')
  })

  it('preserva a antecipação para dia útil na sanitização', () => {
    const imported = sanitizeState({
      version: 1,
      year: 2026,
      initialBalanceCents: 0,
      boxes: [],
      transactions: [
        {
          id: 'cafe',
          date: '2026-09-19',
          description: 'Café',
          category: 'Alimentação',
          type: 'saida',
          amountCents: 1_000,
          adjustToBusinessDay: true,
        },
      ],
    })

    expect(imported?.transactions[0].adjustToBusinessDay).toBe(true)
  })

  it('preserva cartões e metadados de parcelas na sanitização', () => {
    const state = createInitialState(2026)
    state.cards = [{ id: 'c1', name: 'Cartão', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    state.transactions = [
      {
        id: 'netflix:0:2',
        date: '2026-11-13',
        description: 'NETFLIX (2/6)',
        category: 'Cartão',
        type: 'saida',
        amountCents: 3_990,
        cardId: 'c1',
        installmentGroupId: 'c1:netflix',
        installmentIndex: 2,
        installmentCount: 6,
        invoiceMonth: '2026-11',
      },
    ]

    expect(parseJsonImport(JSON.stringify(state))).toEqual(state)
  })

  it('exporta a data já antecipada para o dia útil anterior', () => {
    const state = createInitialState(2026)
    state.transactions = [
      {
        id: 'cafe',
        date: '2026-09-20',
        description: 'Café',
        category: 'Alimentação',
        type: 'saida',
        amountCents: 1_000,
        adjustToBusinessDay: true,
      },
    ]

    expect(exportTransactionsCsv(state)).toContain('2026-09-18')
  })

  it('exporta a recorrência iniciada em dezembro nos meses do ano seguinte', () => {
    const state = createInitialState(2027)
    state.transactions = [
      {
        id: 'aluguel',
        date: '2026-12-15',
        description: 'Aluguel',
        category: 'Moradia',
        type: 'saida',
        amountCents: 1_000,
        recurrenceDay: 15,
      },
    ]

    const csv = exportTransactionsCsv(state)

    expect(csv).toContain('2027-01-15')
    expect(csv).toContain('2027-12-15')
    expect(csv).not.toContain('2026-12-15')
  })
})
