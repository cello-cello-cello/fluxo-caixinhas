import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
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

  it('navega pela barra de meses até dezembro', () => {
    render(<App />)

    const nextMonth = screen.getByRole('button', { name: 'Próximo mês' }) as HTMLButtonElement
    for (let index = 0; index < 12 && !nextMonth.disabled; index += 1) {
      fireEvent.click(nextMonth)
    }

    expect(screen.getByRole('heading', { name: /Dezembro/ })).toBeInTheDocument()
    expect(nextMonth).toBeDisabled()
  })

  it('navega entre as abas principais', () => {
    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    expect(screen.getByText('Sua primeira caixinha')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Gráficos' })[0])
    expect(screen.getByText('Livre × caixinhas')).toBeInTheDocument()
  })
})
