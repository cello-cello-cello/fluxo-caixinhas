import { useEffect, useState } from 'react'
import { FluxoLogo } from './FluxoLogo'

interface SplashScreenProps {
  onFinish: () => void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [reducedMotion] = useState(prefersReducedMotion)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), reducedMotion ? 450 : 950)
    const finishTimer = window.setTimeout(onFinish, reducedMotion ? 600 : 1200)

    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(finishTimer)
    }
  }, [onFinish, reducedMotion])

  return (
    <div
      role="status"
      aria-label="Abrindo Fluxo"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#FBFBFD] ${leaving ? 'splash-leave' : ''}`}
    >
      <div className="splash-badge flex flex-col items-center gap-4">
        <FluxoLogo size={88} className="splash-logo drop-shadow-[0_12px_24px_rgba(17,34,59,0.18)]" />
        <span className="splash-title text-2xl font-extrabold tracking-tight text-navy">Fluxo</span>
      </div>
    </div>
  )
}
