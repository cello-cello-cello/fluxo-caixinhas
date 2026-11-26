import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { createInitialState } from '../lib/storage'

const STORAGE_KEY = 'fluxo-caixinhas:v1'

describe('aplicação', () => {
  beforeEach(() => localStorage.clear())

  it('adiciona um lançamento e recalcula o saldo exibido', () => {
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
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar lançamento' }))

    expect(screen.getByRole('status')).toHaveTextContent('Lançamento salvo')
    expect(screen.getAllByText(/90,00/).length).toBeGreaterThan(0)
  })

  it('navega entre as abas principais', () => {
    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    expect(screen.getByText('Sua primeira caixinha')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Gráficos' })[0])
    expect(screen.getByText('Livre × caixinhas')).toBeInTheDocument()
  })
})
