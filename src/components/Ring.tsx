import type { ReactNode } from 'react'
import { CHART_COLORS } from '../lib/constants'

interface RingProps {
  progress: number
  color: string
  size?: number
  stroke?: number
  label?: string
  children?: ReactNode
}

export function Ring({ progress, color, size = 92, stroke = 9, label, children }: RingProps) {
  const bounded = Math.min(1, Math.max(0, progress))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? 'Progresso'}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={CHART_COLORS.track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - bounded)}
          fill="none"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
