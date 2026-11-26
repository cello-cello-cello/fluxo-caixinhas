import { describe, expect, it } from 'vitest'
import { createInitialState, parseJsonImport, parseTransactionsCsv, sanitizeState } from '../lib/storage'

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
})
