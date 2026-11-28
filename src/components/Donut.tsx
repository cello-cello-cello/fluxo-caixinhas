import type { ReactNode } from 'react'
import { CHART_COLORS } from '../lib/constants'
import { usePrivacy } from '../lib/privacy'

interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutProps {
  segments: DonutSegment[]
  title: string
  subtitle?: string
  control?: ReactNode
  fullTotal?: boolean
}

export function Donut({ segments, title, subtitle, control, fullTotal = false }: DonutProps) {
  const { formatBRL: formatMoney, formatBRLCompact: formatMoneyCompact } = usePrivacy()
  const size = 176
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let offset = 0

  const arcs = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const length = total > 0 ? (segment.value / total) * circumference : 0
      const arc = { ...segment, length: Math.max(length - 3, 1), offset }
      offset += length
      return arc
    })

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <span className="chip shrink-0 bg-[#E9EFF5] text-[#1E3A5F]">{total > 0 ? '100%' : '—'}</span>
      </div>
      {control && <div className="mb-5">{control}</div>}

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" aria-label={title} role="img">
            <circle cx={size / 2} cy={size / 2} r={radius} stroke={CHART_COLORS.track} strokeWidth={stroke} fill="none" />
            {arcs.map((arc) => (
              <circle
                key={arc.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={arc.color}
                strokeWidth={stroke}
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-700"
              />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total</p>
              <p className="money mt-1 text-lg font-extrabold text-[#0F2942]">
                {fullTotal ? formatMoney(total) : formatMoneyCompact(total)}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          {segments.map((segment) => {
            const percent = total > 0 ? Math.round((segment.value / total) * 100) : 0
            return (
              <div key={segment.label} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{segment.label}</span>
                <span className="money text-sm font-bold text-[#0F2942]">{formatMoney(segment.value)}</span>
                <span className="money w-9 text-right text-xs font-semibold text-[#1E3A5F]">{percent}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
