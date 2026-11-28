import { useId } from 'react'

interface FluxoLogoProps {
  size?: number
  className?: string
}

export function FluxoLogo({ size = 40, className = '' }: FluxoLogoProps) {
  const gradientId = `fluxo-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1B365D" />
          <stop offset="100%" stopColor="#11223B" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
      <path
        className="fluxo-wave fluxo-wave-secondary"
        d="M6 24c4-4 8-4 12 0s8 4 12 0c2-2 3.8-3.2 5.5-3.5"
        pathLength={1}
        fill="none"
        stroke="#7FA882"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="fluxo-wave fluxo-wave-main"
        d="M6 16c4-4 8-4 12 0s8 4 12 0c2-2 3.8-3.2 5.5-3.5"
        pathLength={1}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
