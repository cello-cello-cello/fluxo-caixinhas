import { createContext, useContext } from 'react'
import { formatBRL, formatBRLCompact } from './money'

const PRIVACY_KEY = 'fluxo-caixinhas:privacy'
export const PRIVACY_MASK = 'R$ ••••'

export interface PrivacyValue {
  hidden: boolean
  toggle: () => void
  formatBRL: (cents: number) => string
  formatBRLCompact: (cents: number) => string
}

export function loadPrivacyMode(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(PRIVACY_KEY) === 'true'
  } catch {
    return false
  }
}

export function savePrivacyMode(hidden: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PRIVACY_KEY, String(hidden))
  } catch {
    return
  }
}

export function privacyFormatter(hidden: boolean) {
  return {
    formatBRL: hidden ? () => PRIVACY_MASK : formatBRL,
    formatBRLCompact: hidden ? () => PRIVACY_MASK : formatBRLCompact,
  }
}

export const PrivacyContext = createContext<PrivacyValue>({
  hidden: false,
  toggle: () => undefined,
  ...privacyFormatter(false),
})

export function usePrivacy(): PrivacyValue {
  return useContext(PrivacyContext)
}
