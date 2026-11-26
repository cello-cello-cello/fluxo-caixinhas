import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { isoDate } from '../lib/dates'
import { createInitialState } from '../lib/storage'

const STORAGE_KEY = 'fluxo-caixinhas:v1'

describe('aplicação', () => {
  beforeEach(() => localStorage.clear())

  it('permite vários lançamentos no mesmo dia e exclui um deles com recálculo', () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.initialBalanceCents = 10_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: `${year}-01-05` } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Café' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))

    expect(within(dialog).getByText('Café')).toBeInTheDocument()
    expect(screen.getAllByText(/90,00/).length).toBeGreaterThan(0)

    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '5,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Transporte' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))

    expect(within(dialog).getByText('Transporte')).toBeInTheDocument()
    expect(screen.getAllByText(/85,00/).length).toBeGreaterThan(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir Café' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão de Café' }))

    expect(within(dialog).queryByText('Café')).not.toBeInTheDocument()
    expect(screen.getAllByText(/95,00/).length).toBeGreaterThan(0)
  })

  it('edita um lançamento e recalcula os saldos seguintes', () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.initialBalanceCents = 10_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: `${year}-01-05` } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Café' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))

    fireEvent.click(within(dialog).getByRole('button', { name: 'Editar Café' }))
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Almoço' } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '25,00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText(/75,00/).length).toBeGreaterThan(0)
  })

  it('navega pela barra de meses até dezembro', () => {
    render(<App />)

    const nextMonth = screen.getByRole('button', { name: 'Próximo mês' }) as HTMLButtonElement
    for (let index = 0; index < 12 && !nextMonth.disabled; index += 1) {
      fireEvent.click(nextMonth)
    }

    expect(screen.getByRole('heading', { name: /Dezembro/ })).toBeInTheDocument()
    expect(nextMonth).toBeDisabled()
  })

  it('mostra o dia da semana em português abaixo dos dias', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createInitialState(2026)))
    render(<App />)

    const previousMonth = screen.getByRole('button', { name: 'Mês anterior' }) as HTMLButtonElement
    for (let index = 0; index < 12 && !previousMonth.disabled; index += 1) {
      fireEvent.click(previousMonth)
    }

    expect(screen.getAllByText('qui.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('sáb.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('dom.').length).toBeGreaterThan(0)
  })

  it('navega entre as abas principais', () => {
    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    expect(screen.getByText('Sua primeira caixinha')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Gráficos' })[0])
    expect(screen.getByText('Livre × caixinhas')).toBeInTheDocument()
  })

  it('mostra o fechamento de 2026 como abertura de 2027', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 10_000
    state.transactions = [
      { id: 'fechamento', date: '2026-12-31', description: 'Conta', category: 'Outros', type: 'saida', amountCents: 2_500 },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    expect(screen.getAllByText(/75,00/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo ano' }))

    expect(screen.getByText('2027')).toBeInTheDocument()
    expect(screen.getByText(/Aberto com R\$ 75,00/)).toBeInTheDocument()
  })

  it('oferece repetição mensal e replica a ocorrência em meses curtos', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 10_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')
    const repeat = within(dialog).getByLabelText('Repetir todo mês no dia selecionado')
    expect(repeat).not.toBeChecked()

    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: '2026-01-31' } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Aluguel' } })
    fireEvent.click(repeat)
    expect(repeat).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1])

    const created = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(created.transactions).toHaveLength(1)
    expect(created.transactions[0].recurrenceDay).toBe(31)

    fireEvent.click(screen.getByRole('button', { name: /Fevereiro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /28 de Fevereiro/ }))
    const februaryDialog = screen.getByRole('dialog')
    expect(within(februaryDialog).getByText('Aluguel')).toBeInTheDocument()

    fireEvent.click(within(februaryDialog).getByRole('button', { name: 'Editar Aluguel' }))
    expect(within(februaryDialog).getByLabelText('Repetir todo mês no dia selecionado')).toBeChecked()
    fireEvent.change(within(februaryDialog).getByLabelText('Valor (R$)'), { target: { value: '20,00' } })
    fireEvent.click(within(februaryDialog).getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText(/80,00/).length).toBeGreaterThan(0)

    const edited = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(edited.transactions).toHaveLength(1)
    expect(edited.transactions[0].amountCents).toBe(2_000)
    expect(edited.transactions[0].date).toBe('2026-01-31')
  })

  it('exibe em 2027 a recorrência criada em dezembro de 2026', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 10_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: '2026-12-15' } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Aluguel' } })
    fireEvent.click(within(dialog).getByLabelText('Repetir todo mês no dia selecionado'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1])

    fireEvent.click(screen.getByRole('button', { name: 'Próximo ano' }))
    fireEvent.click(screen.getByRole('button', { name: /Janeiro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /15 de Janeiro/ }))

    const januaryDialog = screen.getByRole('dialog')
    expect(within(januaryDialog).getByText('Aluguel')).toBeInTheDocument()

    fireEvent.click(within(januaryDialog).getByRole('button', { name: 'Editar Aluguel' }))
    expect(within(januaryDialog).getByLabelText('Repetir todo mês no dia selecionado')).toBeChecked()

    fireEvent.change(within(januaryDialog).getByLabelText('Valor (R$)'), { target: { value: '20,00' } })
    fireEvent.click(within(januaryDialog).getByRole('button', { name: 'Salvar alterações' }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.transactions).toHaveLength(1)
    expect(saved.transactions[0].amountCents).toBe(2_000)
    expect(saved.transactions[0].date).toBe('2026-12-15')
  })

  it('filtra entradas e saídas por categoria entre mês e ano', () => {
    const year = new Date().getFullYear()
    const month = new Date().getMonth()
    const previousMonth = (month + 11) % 12
    const state = createInitialState(year)
    state.transactions = [
      {
        id: 'atual',
        date: isoDate(year, month, 10),
        description: 'Salário',
        category: 'Salário',
        type: 'entrada',
        amountCents: 10_000,
      },
      {
        id: 'anterior',
        date: isoDate(year, previousMonth, 10),
        description: 'Lazer',
        category: 'Lazer',
        type: 'saida',
        amountCents: 2_000,
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Gráficos' })[0])

    expect(screen.getByRole('button', { name: 'Mês' })).toHaveAttribute('aria-pressed', 'true')
    const monthSelect = screen.getByLabelText('Mês do gráfico') as HTMLSelectElement
    expect(monthSelect.value).toBe(String(month))
    expect(screen.getByText('Salário')).toBeInTheDocument()
    expect(screen.queryByText('Lazer')).not.toBeInTheDocument()

    fireEvent.change(monthSelect, { target: { value: String(previousMonth) } })
    expect(screen.getByText('Lazer')).toBeInTheDocument()
    expect(screen.queryByText('Salário')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Anual' }))
    expect(screen.getByText('Salário')).toBeInTheDocument()
    expect(screen.getByText('Lazer')).toBeInTheDocument()
    expect(screen.queryByLabelText('Mês do gráfico')).not.toBeInTheDocument()
  })

  it('antecipa sábado para sexta e mostra o lançamento no dia útil', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 10_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: '2026-09-19' } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Café' } })
    fireEvent.click(within(dialog).getByLabelText('Antecipar se cair em sábado ou domingo'))
    expect(within(dialog).getByText('Data efetiva: 18 set 2026')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1])

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.transactions[0].date).toBe('2026-09-19')
    expect(saved.transactions[0].adjustToBusinessDay).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Setembro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /18 de Setembro/ }))
    expect(within(screen.getByRole('dialog')).getByText('Café')).toBeInTheDocument()
    expect(screen.getAllByText(/90,00/).length).toBeGreaterThan(0)
  })
})
