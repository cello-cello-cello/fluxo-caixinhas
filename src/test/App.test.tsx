import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { formatDate, formatFriendlyDate, isoDate, MONTH_NAMES } from '../lib/dates'
import { buildInstallmentTransactions } from '../lib/invoices'
import { readPdfInvoiceLines } from '../lib/pdfInvoice'
import { formatBRL } from '../lib/money'
import { createInitialState } from '../lib/storage'

vi.mock('../lib/pdfInvoice', () => ({ readPdfInvoiceLines: vi.fn() }))

const STORAGE_KEY = 'fluxo-caixinhas:v1'
const readPdfMock = vi.mocked(readPdfInvoiceLines)

function passwordError(code: number): Error {
  return Object.assign(new Error('PDF protegido'), { name: 'PasswordException', code })
}

describe('aplicação', () => {
  beforeEach(() => {
    localStorage.clear()
    readPdfMock.mockReset()
  })

  it('permite vários lançamentos no mesmo dia e exclui um deles com recálculo', () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.initialBalanceCents = 10_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: `${year}-01-05` } })
    expect(within(dialog).getByRole('heading', { name: formatFriendlyDate(`${year}-01-05`) })).toBeInTheDocument()
    expect(within(dialog).queryByText('PAINEL DO DIA')).not.toBeInTheDocument()
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

  it('arrasta a faixa de meses sem disparar clique e mantém as setinhas', () => {
    render(<App />)

    const strip = screen.getByTestId('month-strip') as HTMLDivElement
    const currentMonth = new Date().getMonth()
    const otherMonth = (currentMonth + 1) % 12
    const otherMonthButton = screen.getByRole('button', { name: new RegExp(`^${MONTH_NAMES[otherMonth]}:`) })
    const currentHeading = screen.getByRole('heading', { name: new RegExp(MONTH_NAMES[currentMonth]) })

    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument()
    strip.scrollLeft = 0

    fireEvent.mouseDown(strip, { button: 0, clientX: 200 })
    expect(strip).toHaveClass('cursor-grabbing', 'select-none')
    fireEvent.mouseMove(strip, { clientX: 180 })
    expect(strip.scrollLeft).toBe(20)
    fireEvent.mouseUp(strip)
    expect(strip).toHaveClass('cursor-grab')

    fireEvent.click(otherMonthButton)
    expect(currentHeading).toBeInTheDocument()
  })

  it('mantém o clique simples na faixa de meses', () => {
    render(<App />)

    const otherMonth = (new Date().getMonth() + 1) % 12
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${MONTH_NAMES[otherMonth]}:`) }))

    expect(screen.getByRole('heading', { name: new RegExp(MONTH_NAMES[otherMonth]) })).toBeInTheDocument()
  })

  it('mostra o card Respiro com a folga até a próxima entrada', () => {
    const year = 2020
    const month = new Date().getMonth()
    const state = createInitialState(year)
    state.initialBalanceCents = 100_000
    state.transactions = [
      { id: 'conta', date: isoDate(year, month, 2), description: 'Conta', category: 'Outros', type: 'saida', amountCents: 10_000 },
      { id: 'salario', date: isoDate(year, month, 5), description: 'Salário', category: 'Salário', type: 'entrada', amountCents: 50_000 },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    const card = screen.getByLabelText('Respiro')
    expect(within(card).getByText('Respiro')).toBeInTheDocument()
    expect(within(card).getByText(`Próxima entrada · ${formatDate(isoDate(year, month, 5))}`)).toBeInTheDocument()
    expect(within(card).getByText(/900,00/)).toBeInTheDocument()
    expect(within(card).getByText('Tranquilo')).toBeInTheDocument()
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

  it('destaca em vermelho os dias com saldo livre negativo', () => {
    const year = new Date().getFullYear()
    const month = new Date().getMonth()
    const state = createInitialState(year)
    state.transactions = [
      { id: 'conta', date: isoDate(year, month, 1), description: 'Conta', category: 'Outros', type: 'saida', amountCents: 10_000 },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    const firstDay = screen.getByRole('button', { name: /^1 de .*: saldo/ })
    expect(firstDay).toHaveClass('bg-[#FFF3EF]')
    expect(firstDay).toHaveClass('ring-1')
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
    const repeat = within(dialog).getByLabelText('Repetir mensalmente')
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
    expect(within(februaryDialog).getByLabelText('Repetir mensalmente')).toBeChecked()
    fireEvent.change(within(februaryDialog).getByLabelText('Valor (R$)'), { target: { value: '20,00' } })
    fireEvent.click(within(februaryDialog).getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const edited = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(edited.transactions).toHaveLength(2)
    expect(edited.transactions[0].amountCents).toBe(1_000)
    expect(edited.transactions[0].recurrenceEnd).toBe('2026-01')
    expect(edited.transactions[1].amountCents).toBe(2_000)
    expect(edited.transactions[1].date).toBe('2026-02-28')
    expect(edited.transactions[1].recurrenceDay).toBe(31)
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
    fireEvent.click(within(dialog).getByLabelText('Repetir mensalmente'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1])

    fireEvent.click(screen.getByRole('button', { name: 'Próximo ano' }))
    fireEvent.click(screen.getByRole('button', { name: /Janeiro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /15 de Janeiro/ }))

    const januaryDialog = screen.getByRole('dialog')
    expect(within(januaryDialog).getByText('Aluguel')).toBeInTheDocument()

    fireEvent.click(within(januaryDialog).getByRole('button', { name: 'Editar Aluguel' }))
    expect(within(januaryDialog).getByLabelText('Repetir mensalmente')).toBeChecked()

    fireEvent.change(within(januaryDialog).getByLabelText('Valor (R$)'), { target: { value: '20,00' } })
    fireEvent.click(within(januaryDialog).getByRole('button', { name: 'Salvar alterações' }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.transactions).toHaveLength(2)
    expect(saved.transactions[0].date).toBe('2026-12-15')
    expect(saved.transactions[0].amountCents).toBe(1_000)
    expect(saved.transactions[0].recurrenceEnd).toBe('2026-12')
    expect(saved.transactions[1].date).toBe('2027-01-15')
    expect(saved.transactions[1].amountCents).toBe(2_000)
  })

  it('permite escolher o fim da recorrência e rejeita fim anterior ao início', () => {
    const state = createInitialState(2026)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: '2026-01-31' } })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Aluguel' } })
    fireEvent.click(within(dialog).getByLabelText('Repetir mensalmente'))
    fireEvent.change(within(dialog).getByLabelText('Mês final da recorrência'), { target: { value: '3' } })
    fireEvent.change(within(dialog).getByLabelText('Ano final da recorrência'), { target: { value: '2026' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1])

    const created = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(created.transactions[0].recurrenceEnd).toBe('2026-04')

    fireEvent.click(screen.getByRole('button', { name: /Fevereiro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /28 de Fevereiro/ }))
    expect(within(screen.getByRole('dialog')).getByText(/Mensal até 04\/2026/)).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Fechar' })[0])

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const invalidDialog = screen.getByRole('dialog')
    fireEvent.change(within(invalidDialog).getByLabelText('Data'), { target: { value: '2026-12-10' } })
    fireEvent.change(within(invalidDialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(invalidDialog).getByLabelText('Descrição'), { target: { value: 'Conta' } })
    fireEvent.click(within(invalidDialog).getByLabelText('Repetir mensalmente'))
    fireEvent.change(within(invalidDialog).getByLabelText('Mês final da recorrência'), { target: { value: '0' } })
    fireEvent.change(within(invalidDialog).getByLabelText('Ano final da recorrência'), { target: { value: '2026' } })
    fireEvent.click(within(invalidDialog).getByRole('button', { name: 'Adicionar ao dia' }))

    expect(within(invalidDialog).getByRole('alert')).toHaveTextContent('não pode ser anterior')
  })

  it('oferece escopo ao editar uma ocorrência da série', () => {
    const state = createInitialState(2026)
    state.transactions = [{
      id: 'aluguel',
      date: '2026-01-31',
      description: 'Aluguel',
      category: 'Moradia',
      type: 'saida',
      amountCents: 1_000,
      recurrenceDay: 31,
      recurrenceEnd: '2026-03',
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Fevereiro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /28 de Fevereiro/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Editar Aluguel' }))

    expect(within(dialog).getByRole('radio', { name: /Apenas este lançamento/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: /Este e os próximos até o fim/ })).toBeChecked()
    fireEvent.click(within(dialog).getByRole('radio', { name: /Apenas este lançamento/ }))
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '20,00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.transactions).toHaveLength(3)
    expect(saved.transactions[0].recurrenceEnd).toBe('2026-01')
    expect(saved.transactions[1].date).toBe('2026-02-28')
    expect(saved.transactions[1].amountCents).toBe(2_000)
    expect(saved.transactions[1].recurrenceDay).toBeUndefined()
    expect(saved.transactions[2].date).toBe('2026-03-31')
    expect(saved.transactions[2].amountCents).toBe(1_000)
  })

  it('aplica o escopo escolhido ao excluir uma ocorrência da série', () => {
    const state = createInitialState(2026)
    state.transactions = [{
      id: 'aluguel',
      date: '2026-01-31',
      description: 'Aluguel',
      category: 'Moradia',
      type: 'saida',
      amountCents: 1_000,
      recurrenceDay: 31,
      recurrenceEnd: '2026-03',
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Fevereiro:/ }))
    fireEvent.click(screen.getByRole('button', { name: /28 de Fevereiro/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir Aluguel' }))
    expect(within(dialog).getByRole('radio', { name: /Apenas este lançamento/ })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('radio', { name: /Apenas este lançamento/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão de Aluguel' }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.transactions).toHaveLength(2)
    expect(saved.transactions[0].recurrenceEnd).toBe('2026-01')
    expect(saved.transactions[1].date).toBe('2026-03-31')
    expect(saved.transactions[1].amountCents).toBe(1_000)
  })

  it('mantém aba e mês ao salvar e ao alternar entre abas', () => {
    const month = new Date().getMonth()
    render(<App />)

    expect(screen.getByRole('heading', { name: `${MONTH_NAMES[month]} · ${new Date().getFullYear()}` })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Fluxo' })[0])
    expect(screen.getByRole('heading', { name: `${MONTH_NAMES[month]} · ${new Date().getFullYear()}` })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Novo' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Café' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar ao dia' }))
    expect(within(dialog).getByText('Café')).toBeInTheDocument()
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: `${MONTH_NAMES[month]} · ${new Date().getFullYear()}` })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Fluxo' })[0]).toHaveAttribute('aria-current', 'page')
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

    expect(screen.getAllByRole('button', { name: 'Mês' })[0]).toHaveAttribute('aria-pressed', 'true')
    const monthSelect = screen.getAllByLabelText('Mês do gráfico')[1] as HTMLSelectElement
    expect(monthSelect.value).toBe(String(month))
    expect(screen.getByText('Salário')).toBeInTheDocument()
    expect(screen.queryByText('Lazer')).not.toBeInTheDocument()

    fireEvent.change(monthSelect, { target: { value: String(previousMonth) } })
    expect(screen.getByText('Lazer')).toBeInTheDocument()
    expect(screen.queryByText('Salário')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Anual' })[1])
    expect(screen.getByText('Salário')).toBeInTheDocument()
    expect(screen.getByText('Lazer')).toBeInTheDocument()
    expect(screen.queryByLabelText('Mês do gráfico')).not.toBeInTheDocument()
  })

  it('filtra livre x caixinhas por mês e por ano com saldo vindo do ano anterior', () => {
    const state = createInitialState(2026)
    state.initialBalanceCents = 100_000
    state.boxes = [{ id: 'b1', name: 'Viagem', color: '#4A6B53', balanceCents: 0, goalCents: 10_000 }]
    state.transactions = [
      { id: 'anterior', date: '2025-12-31', description: 'Saldo anterior', category: 'Outros', type: 'entrada', amountCents: 20_000 },
      { id: 'salario', date: '2026-01-10', description: 'Salário', category: 'Salário', type: 'entrada', amountCents: 10_000 },
      { id: 'guardar', date: '2026-02-20', description: 'Guardar', category: 'Caixinhas', type: 'guardar', amountCents: 5_000, boxId: 'b1' },
      { id: 'conta', date: '2026-12-15', description: 'Conta', category: 'Outros', type: 'saida', amountCents: 2_000 },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Gráficos' })[0])

    const card = screen.getByRole('img', { name: 'Livre × caixinhas' }).closest('.card') as HTMLElement
    const monthSelect = screen.getAllByLabelText('Mês do gráfico')[0] as HTMLSelectElement
    const hasMoney = (cents: number) => (_content: string, element: Element | null) =>
      element?.textContent?.replace(/\u00a0/g, ' ').trim() === formatBRL(cents).replace(/\u00a0/g, ' ')
    fireEvent.change(monthSelect, { target: { value: '0' } })

    expect(within(card).getByText('Janeiro de 2026')).toBeInTheDocument()
    expect(within(card).getAllByText(hasMoney(130_000)).length).toBeGreaterThan(0)
    expect(within(card).getByText(hasMoney(0))).toBeInTheDocument()

    fireEvent.change(monthSelect, { target: { value: '1' } })

    expect(within(card).getByText('Fevereiro de 2026')).toBeInTheDocument()
    expect(within(card).getByText(hasMoney(125_000))).toBeInTheDocument()
    expect(within(card).getByText(hasMoney(5_000))).toBeInTheDocument()
    expect(within(card).getAllByText(hasMoney(130_000)).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Anual' })[0])

    expect(within(card).getByText('Ano de 2026')).toBeInTheDocument()
    expect(within(card).getByText(hasMoney(123_000))).toBeInTheDocument()
    expect(within(card).getByText(hasMoney(5_000))).toBeInTheDocument()
    expect(within(card).getAllByText(hasMoney(128_000)).length).toBeGreaterThan(0)
    expect(screen.queryAllByLabelText('Mês do gráfico')).toHaveLength(0)
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
    fireEvent.click(within(dialog).getByLabelText('Antecipar se cair no fim de semana'))
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

  it('mostra aporte mensal e melhor dia de depósito no planejamento da caixinha', () => {
    const year = new Date().getFullYear()
    const month = new Date().getMonth()
    const state = createInitialState(year)
    state.initialBalanceCents = 100_000
    state.boxes = [
      { id: 'b1', name: 'Viagem', color: '#4A6B53', balanceCents: 20_000, goalCents: 80_000, targetDate: isoDate(year + 1, 5, 1) },
    ]
    state.transactions = [
      { id: 'salario', date: isoDate(year, month, 10), description: 'Salário', category: 'Salário', type: 'entrada', amountCents: 500_000 },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])

    const card = screen.getByRole('heading', { name: 'Viagem' }).closest('article') as HTMLElement
    expect(within(card).getByText('Planejamento da meta')).toBeInTheDocument()
    expect(within(card).getByText('Em andamento')).toBeInTheDocument()
    expect(within(card).getAllByText(/\/mês/).length).toBeGreaterThan(0)
    expect(within(card).getByText(/meses restantes/)).toBeInTheDocument()
    expect(within(card).getByText(/Melhor dia: 10/)).toBeInTheDocument()
    expect(within(card).getByText(/Mantém o saldo livre positivo até o fim do mês/)).toBeInTheDocument()
  })

  it('cria aporte automático com mês alvo e mostra o histórico da caixinha', () => {
    const nextYear = new Date().getFullYear() + 1
    const state = createInitialState(nextYear)
    state.initialBalanceCents = 100_000
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Nova caixinha' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Viagem' } })
    fireEvent.change(within(dialog).getByLabelText('Meta (R$)'), { target: { value: '1.000,00' } })
    fireEvent.change(within(dialog).getByLabelText('Mês alvo'), { target: { value: '11' } })
    fireEvent.change(within(dialog).getByLabelText('Ano alvo'), { target: { value: String(nextYear) } })
    fireEvent.change(within(dialog).getByLabelText('Aporte mensal automático (R$)'), { target: { value: '100,00' } })
    fireEvent.change(within(dialog).getByLabelText('Dia do aporte'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar caixinha' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      boxes: Array<{ id: string; name: string; targetMonth?: string; autoContributionCents?: number; autoContributionDay?: number }>
      transactions: Array<{
        type: string
        amountCents: number
        boxId?: string
        autoBoxId?: string
        recurrenceDay?: number
        recurrenceEnd?: string
      }>
    }
    expect(saved.boxes[0]).toMatchObject({
      name: 'Viagem',
      targetMonth: `${nextYear}-12`,
      autoContributionCents: 10_000,
      autoContributionDay: 5,
    })
    expect(saved.transactions).toHaveLength(1)
    expect(saved.transactions[0]).toMatchObject({
      type: 'guardar',
      amountCents: 10_000,
      boxId: saved.boxes[0].id,
      autoBoxId: saved.boxes[0].id,
      recurrenceDay: 5,
      recurrenceEnd: `${nextYear}-12`,
    })

    const card = screen.getByRole('heading', { name: 'Viagem' }).closest('article') as HTMLElement
    expect(within(card).getByText(`Alvo: ${MONTH_NAMES[11]} de ${nextYear}`)).toBeInTheDocument()
    expect(within(card).getByText(/Aporte automático: R\$ 100,00 · dia 5/)).toBeInTheDocument()
    expect(within(card).getAllByText(/Aporte automático · Viagem/).length).toBeGreaterThan(0)
  })

  it('oferece modo demonstração e volta aos dados reais', () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.boxes = [{ id: 'real', name: 'Minha reserva real', color: '#4A6B53', balanceCents: 1_000, goalCents: 2_000 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Dados' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Modo demonstração' }))

    expect(screen.getByText('Você está vendo dados fictícios. Seus valores reais ficaram guardados.')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Minha reserva real')
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Viagem 2027')

    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    expect(screen.getByRole('heading', { name: 'Viagem 2027' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Dados' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos meus dados' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Caixinhas' })[0])
    expect(screen.getByRole('heading', { name: 'Minha reserva real' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Viagem 2027' })).not.toBeInTheDocument()
  })

  it('cadastra um cartão com fechamento e vencimento em anos diferentes e permanece em Cartões', () => {
    const year = new Date().getFullYear()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createInitialState(year)))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartão' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome ou apelido'), { target: { value: 'Nubank' } })
    fireEvent.change(within(dialog).getByLabelText('Limite total (R$)'), { target: { value: '1.000,00' } })
    fireEvent.change(within(dialog).getByLabelText('Data de fechamento'), { target: { value: '2026-12-25' } })
    fireEvent.change(within(dialog).getByLabelText('Data de vencimento'), { target: { value: '2027-01-01' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar cartão' }))

    expect(screen.getByRole('heading', { name: 'Cartões' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nubank' })).toBeInTheDocument()
    expect(screen.getAllByText(/1\.000,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/25 dez 2026/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/01 jan 2027/).length).toBeGreaterThan(0)

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { cards: unknown[] }
    expect(saved.cards).toEqual([
      expect.objectContaining({
        name: 'Nubank',
        limitCents: 100_000,
        closingDay: 25,
        dueDay: 1,
        closingDate: '2026-12-25',
        dueDate: '2027-01-01',
      }),
    ])
  })

  it('edita as datas do cartão sem gerar lançamentos no fluxo', () => {
    const state = createInitialState(2026)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    state.cardInvoices = [{
      id: 'c1:2026-12',
      cardId: 'c1',
      invoiceMonth: '2026-12',
      items: [{ id: 'tv', description: 'TV', amountCents: 10_000, currentInstallment: 1, installmentCount: 2 }],
      rawText: '',
      sections: [],
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Data de fechamento'), { target: { value: '2026-12-25' } })
    fireEvent.change(within(dialog).getByLabelText('Data de vencimento'), { target: { value: '2027-01-01' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar cartão' }))

    expect(screen.getByRole('heading', { name: 'Cartões' })).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      transactions: unknown[]
      cards: Parameters<typeof buildInstallmentTransactions>[0][]
      cardInvoices: Array<{
        invoiceMonth: string
        items: Parameters<typeof buildInstallmentTransactions>[1]
      }>
    }
    expect(saved.transactions).toHaveLength(0)
    const projections = buildInstallmentTransactions(
      saved.cards[0],
      saved.cardInvoices[0].items,
      saved.cardInvoices[0].invoiceMonth,
    )
    expect(projections.map((item) => item.date)).toEqual(['2027-01-01', '2027-02-01'])
  })

  it('lança uma fatura manualmente sem alterar o fluxo de caixa', () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.initialBalanceCents = 100_000
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'Netflix' } })
    fireEvent.change(within(dialog).getByLabelText('Valor da parcela (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Total de parcelas'), { target: { value: '2' } })
    expect(within(dialog).getByText('Prévia: 2 lançamento(s)')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar fatura e parcelas' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cartões' })).toBeInTheDocument()
    expect(screen.getAllByText(/20,00/).length).toBeGreaterThan(0)

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      transactions: unknown[]
      cardInvoices: Array<{ cardId: string; invoiceMonth: string; items: Array<{ description: string }> }>
    }
    expect(saved.transactions).toHaveLength(0)
    expect(saved.cardInvoices).toHaveLength(1)
    expect(saved.cardInvoices[0]).toMatchObject({ cardId: 'c1' })
    expect(saved.cardInvoices[0].items[0].description).toBe('Netflix')

    fireEvent.click(screen.getAllByRole('button', { name: 'Fluxo' })[0])
    expect(screen.getAllByText(/1\.000,00/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/980,00/)).not.toBeInTheDocument()
  })

  it('projeta parcelas no vencimento configurado após a virada de ano', () => {
    const state = createInitialState(2026)
    state.cards = [{
      id: 'c1',
      name: 'Nubank',
      limitCents: 100_000,
      closingDay: 25,
      dueDay: 1,
      closingDate: '2026-12-25',
      dueDate: '2027-01-01',
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Vencimento')).toHaveValue('2027-01-01')
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'TV' } })
    fireEvent.change(within(dialog).getByLabelText('Valor da parcela (R$)'), { target: { value: '10,00' } })
    fireEvent.change(within(dialog).getByLabelText('Total de parcelas'), { target: { value: '2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar fatura e parcelas' }))

    expect(screen.getByRole('heading', { name: 'Cartões' })).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      cards: Parameters<typeof buildInstallmentTransactions>[0][]
      cardInvoices: Array<{
        invoiceMonth: string
        items: Parameters<typeof buildInstallmentTransactions>[1]
      }>
    }
    const projections = buildInstallmentTransactions(
      saved.cards[0],
      saved.cardInvoices[0].items,
      saved.cardInvoices[0].invoiceMonth,
    )
    expect(projections.map((item) => item.date)).toEqual(['2027-01-01', '2027-02-01'])
  })

  it('importa as linhas de um PDF e abre a conferência da fatura', async () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock.mockResolvedValue(['15/10 NETFLIX parc. 02/03 R$ 10,00'])

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.change(screen.getByLabelText('Importar fatura PDF de Nubank'), {
      target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] },
    })

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByDisplayValue('NETFLIX')).toBeInTheDocument())
    expect(within(dialog).getByDisplayValue('10,00')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('2')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('3')).toBeInTheDocument()
    expect(readPdfMock).toHaveBeenCalledTimes(1)
  })

  it('mostra a conferência com o total do PDF e salva a classificação editada', async () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock.mockResolvedValue([
      'Cartão final 8018',
      'CAFÉ @ DA ESQUINA',
      '15/10',
      'parc. 02/06',
      '30.50 ))',
      'VALOR TOTAL R$ 30,50',
    ])

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.change(screen.getByLabelText('Importar fatura PDF de Nubank'), {
      target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] },
    })

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByDisplayValue('CAFÉ DA ESQUINA')).toBeInTheDocument())
    expect(within(dialog).getByLabelText('Total da fatura (R$)')).toHaveValue('30,50')
    expect(within(dialog).getByText(/Conferência OK/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Classificação')).toHaveValue('parcela')

    fireEvent.change(within(dialog).getByLabelText('Classificação'), { target: { value: 'encargo' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar fatura e parcelas' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      transactions: unknown[]
      cardInvoices: Array<{
        totalCents?: number
        items: Array<{ kind?: string; source?: string }>
      }>
    }
    expect(saved.transactions).toHaveLength(0)
    expect(saved.cardInvoices[0].totalCents).toBe(3_050)
    expect(saved.cardInvoices[0].items[0]).toMatchObject({ kind: 'encargo', source: 'Final 8018' })
  })

  it('permite editar data da compra e salvar mesmo com total divergente', async () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock.mockResolvedValue([
      'Cartão final 8018',
      '15/10 LOJA 16,26',
      'VALOR TOTAL R$ 20,00',
    ])

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.change(screen.getByLabelText('Importar fatura PDF de Nubank'), {
      target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] },
    })

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByDisplayValue('LOJA')).toBeInTheDocument())
    expect(within(dialog).getByText(/Diferença de/)).toBeInTheDocument()
    expect(within(dialog).getByText(/salvar assim mesmo/)).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Data da compra'), { target: { value: `${year}-10-15` } })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'LOJA AJUSTADA' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar fatura e parcelas' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      cardInvoices: Array<{
        totalCents?: number
        items: Array<{ description: string; purchaseDate?: string; amountCents: number }>
      }>
    }
    expect(saved.cardInvoices[0].totalCents).toBe(2_000)
    expect(saved.cardInvoices[0].items[0]).toMatchObject({
      description: 'LOJA AJUSTADA',
      purchaseDate: `${year}-10-15`,
      amountCents: 1_626,
    })
  })

  it('aplica o filtro de mês inicial e permite conferir linhas e texto bruto', async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock.mockResolvedValue([
      'Cartão final 4761',
      '15/10 NETFLIX parc. 02/03 R$ 10,00',
      '15/10 LOJA R$ 20,00',
    ])

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.change(screen.getByLabelText('Importar fatura PDF de Nubank'), {
      target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] },
    })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Prévia: 3 lançamento(s)')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Origem: Final 4761').length).toBeGreaterThan(0)

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Incluir LOJA' }))
    expect(within(dialog).getByText('Prévia: 2 lançamento(s)')).toBeInTheDocument()

    const rawBlock = within(dialog).getByText(/Cartão final 4761/).closest('details') as HTMLElement
    expect(within(rawBlock).getByText('Ver texto bruto do PDF')).toBeInTheDocument()

    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    fireEvent.change(within(dialog).getByLabelText('Mês inicial'), { target: { value: String(nextMonth) } })
    fireEvent.change(within(dialog).getByLabelText('Ano inicial'), { target: { value: String(nextYear) } })
    expect(within(dialog).getByText('Prévia: 1 lançamento(s)')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar fatura e parcelas' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cartões' })).toBeInTheDocument()

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      transactions: unknown[]
      cards: Parameters<typeof buildInstallmentTransactions>[0][]
      cardInvoices: Array<{
        cardId: string
        invoiceMonth: string
        fromMonth?: string
        items: Parameters<typeof buildInstallmentTransactions>[1]
      }>
    }
    expect(saved.transactions).toHaveLength(0)
    expect(saved.cardInvoices).toHaveLength(1)
    expect(saved.cardInvoices[0]).toMatchObject({
      cardId: 'c1',
      fromMonth: `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
    })
    expect(saved.cardInvoices[0].items).toHaveLength(1)

    const projections = buildInstallmentTransactions(
      saved.cards[0],
      saved.cardInvoices[0].items,
      saved.cardInvoices[0].invoiceMonth,
      { fromMonth: saved.cardInvoices[0].fromMonth },
    )
    expect(projections).toHaveLength(1)
    expect(projections[0]).toMatchObject({ description: 'NETFLIX (3/3)', type: 'saida' })
    expect(projections[0].date).toMatch(new RegExp(`^${nextYear}-${String(nextMonth).padStart(2, '0')}`))
  })

  it('pede a senha quando o PDF exige e segue para a conferência após abrir', async () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock
      .mockRejectedValueOnce(passwordError(1))
      .mockResolvedValueOnce(['15/10 NETFLIX parc. 02/03 R$ 10,00'])

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.change(screen.getByLabelText('Importar fatura PDF de Nubank'), {
      target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] },
    })

    const passwordDialog = await screen.findByRole('dialog')
    const passwordField = within(passwordDialog).getByLabelText('Senha do PDF')
    expect(passwordField).toHaveAttribute('type', 'password')
    fireEvent.click(within(passwordDialog).getByRole('button', { name: 'Mostrar senha' }))
    expect(passwordField).toHaveAttribute('type', 'text')

    fireEvent.change(passwordField, { target: { value: '123456' } })
    fireEvent.click(within(passwordDialog).getByRole('button', { name: 'Tentar abrir' }))

    await waitFor(() => expect(screen.queryByLabelText('Senha do PDF')).not.toBeInTheDocument())
    const invoiceDialog = screen.getByRole('dialog')
    expect(within(invoiceDialog).getByDisplayValue('NETFLIX')).toBeInTheDocument()
    expect(readPdfMock).toHaveBeenCalledTimes(2)
    expect(readPdfMock.mock.calls[1][1]).toBe('123456')
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('123456')
  })

  it('avisa quando a senha do PDF estiver incorreta e permite tentar de novo', async () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock
      .mockRejectedValueOnce(passwordError(1))
      .mockRejectedValueOnce(passwordError(2))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    fireEvent.change(screen.getByLabelText('Importar fatura PDF de Nubank'), {
      target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] },
    })

    const passwordDialog = await screen.findByRole('dialog')
    fireEvent.change(within(passwordDialog).getByLabelText('Senha do PDF'), { target: { value: '654321' } })
    fireEvent.click(within(passwordDialog).getByRole('button', { name: 'Tentar abrir' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Senha incorreta. Confira os dígitos e tente novamente.')
    expect(within(passwordDialog).getByLabelText('Senha do PDF')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Tentar abrir' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('654321')
  })

  it('descarta a senha ao cancelar a importação protegida', async () => {
    const year = new Date().getFullYear()
    const state = createInitialState(year)
    state.cards = [{ id: 'c1', name: 'Nubank', limitCents: 100_000, closingDay: 10, dueDay: 15 }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    readPdfMock.mockRejectedValueOnce(passwordError(1))

    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cartões' })[0])
    const input = screen.getByLabelText('Importar fatura PDF de Nubank')
    const file = new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    const passwordDialog = await screen.findByRole('dialog')
    fireEvent.change(within(passwordDialog).getByLabelText('Senha do PDF'), { target: { value: '111222333' } })
    fireEvent.click(within(passwordDialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('111222333')

    readPdfMock.mockRejectedValueOnce(passwordError(1))
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })] } })
    const newPasswordDialog = await screen.findByRole('dialog')
    expect(within(newPasswordDialog).getByLabelText('Senha do PDF')).toHaveValue('')
  })
})
