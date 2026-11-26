import { describe, expect, it } from 'vitest'
import { previousBusinessDayInMonthIso, previousBusinessDayIso } from '../lib/dates'

describe('antecipação para dia útil anterior', () => {
  it('antecipa sábado para sexta', () => {
    expect(previousBusinessDayIso('2026-09-19')).toBe('2026-09-18')
  })

  it('antecipa domingo para sexta', () => {
    expect(previousBusinessDayIso('2026-09-20')).toBe('2026-09-18')
  })

  it('mantém um dia útil normal', () => {
    expect(previousBusinessDayIso('2026-09-18')).toBe('2026-09-18')
  })

  it('antecipa o primeiro dia do mês quando cai no fim de semana', () => {
    expect(previousBusinessDayIso('2026-02-01')).toBe('2026-01-30')
  })

  it('mantém o último dia útil dentro do próprio mês', () => {
    expect(previousBusinessDayInMonthIso(2026, 4, 31)).toBe('2026-05-29')
    expect(previousBusinessDayInMonthIso(2027, 1, 31)).toBe('2027-02-26')
  })
})
