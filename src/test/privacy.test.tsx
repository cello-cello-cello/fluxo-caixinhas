import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { isoDate } from '../lib/dates'
import { createInitialState } from '../lib/storage'

const STORAGE_KEY = 'fluxo-caixinhas:v1'
const PRIVACY_KEY = 'fluxo-caixinhas:privacy'
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

function normalize(text: string): string {
  return text.replace(/\u00a0/g, ' ').trim()
}

function hasValue(value: string): boolean {
  return screen.queryAllByText((_, element) => normalize(element?.textContent ?? '').includes(value)).length > 0
}

describe('Modo Privacidade', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  })

  it('oculta valores, lembra a preferência e permite mostrar novamente', () => {
    const state = createInitialState()
    state.initialBalanceCents = 12_345
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    const { unmount } = render(<App />)
    expect(hasValue('123,45')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar valores' }))
    expect(screen.getAllByText('R$ ••••').length).toBeGreaterThan(0)
    expect(hasValue('123,45')).toBe(false)
    expect(localStorage.getItem(PRIVACY_KEY)).toBe('true')

    unmount()
    render(<App />)
    expect(screen.getAllByText('R$ ••••').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Mostrar valores' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar valores' }))
    expect(hasValue('123,45')).toBe(true)
    expect(localStorage.getItem(PRIVACY_KEY)).toBe('false')
  })

  it('mantém a máscara ao navegar pelas abas', () => {
    const state = createInitialState()
    state.initialBalanceCents = 12_345
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar valores' }))

    for (const tab of ['Fluxo', 'Caixinhas', 'Cartões', 'Gráficos', 'Dados']) {
      fireEvent.click(screen.getAllByRole('button', { name: tab })[0])
      expect(screen.getAllByText('R$ ••••').length).toBeGreaterThan(0)
    }
  })

  it('copia o backup, mostra confirmação e registra o último backup', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const state = createInitialState()
    state.initialBalanceCents = 12_345
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Dados' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Copiar backup' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('"initialBalanceCents": 12345')
    expect(await screen.findByText(/Backup copiado!/)).toBeInTheDocument()
    expect(await screen.findByText(/Último backup copiado em/)).toBeInTheDocument()
  })

  it('restaura todos os dados a partir do texto colado', async () => {
    const original = createInitialState()
    original.initialBalanceCents = 12_345
    localStorage.setItem(STORAGE_KEY, JSON.stringify(original))

    const restored = createInitialState()
    restored.initialBalanceCents = 999_999
    restored.transactions = [{
      id: 'colado',
      date: `${new Date().getFullYear()}-01-05`,
      description: 'Importado por texto',
      category: 'Outros',
      type: 'saida',
      amountCents: 1_000,
    }]

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Dados' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Colar backup' }))
    fireEvent.change(screen.getByLabelText('Texto do backup'), { target: { value: JSON.stringify(restored) } })
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar dados' }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { initialBalanceCents: number }
      expect(saved.initialBalanceCents).toBe(999_999)
    })
    expect(screen.getByText('Backup restaurado com sucesso.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Texto do backup')).not.toBeInTheDocument()
  })

  it('mantém o valor do Respiro mascarado', () => {
    const year = 2020
    const month = new Date().getMonth()
    const state = createInitialState(year)
    state.initialBalanceCents = 100_000
    state.transactions = [{
      id: 'salario',
      date: isoDate(year, month, 5),
      description: 'Salário',
      category: 'Salário',
      type: 'entrada',
      amountCents: 50_000,
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    localStorage.setItem(PRIVACY_KEY, 'true')

    render(<App />)

    expect(within(screen.getByLabelText('Respiro')).getByText('R$ ••••')).toBeInTheDocument()
  })
})
