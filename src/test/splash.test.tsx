import { act } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FluxoLogo } from '../components/FluxoLogo'
import { SplashScreen } from '../components/SplashScreen'

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  })
}

describe('FluxoLogo', () => {
  it('usa o badge arredondado, gradiente e ondas com pathLength', () => {
    const { container } = render(<FluxoLogo size={64} className="minha-classe" />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('viewBox', '0 0 40 40')
    expect(svg).toHaveAttribute('width', '64')
    expect(svg).toHaveAttribute('height', '64')
    expect(svg).toHaveClass('minha-classe')
    expect(container.querySelector('linearGradient')).toBeInTheDocument()
    expect([...container.querySelectorAll('path')].map((path) => path.getAttribute('pathLength'))).toEqual(['1', '1'])
  })
})

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })
  })

  it('mostra logo e nome, inicia o fade-out e termina após 1,2s', () => {
    const onFinish = vi.fn()
    const { container } = render(<SplashScreen onFinish={onFinish} />)

    expect(screen.getByLabelText('Abrindo Fluxo')).toBeInTheDocument()
    expect(screen.getByText('Fluxo')).toBeInTheDocument()
    expect(container.querySelector('.splash-leave')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(950))
    expect(container.querySelector('.splash-leave')).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(250))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('reduz o tempo e as animações quando o sistema pede menos movimento', () => {
    mockReducedMotion(true)
    const onFinish = vi.fn()
    const { container } = render(<SplashScreen onFinish={onFinish} />)

    act(() => vi.advanceTimersByTime(600))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.splash-leave')).toBeInTheDocument()
  })
})
