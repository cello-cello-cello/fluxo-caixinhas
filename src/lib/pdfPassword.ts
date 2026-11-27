export type PdfPasswordIssue = 'need_password' | 'incorrect_password'

const NEED_PASSWORD = 1
const INCORRECT_PASSWORD = 2

export class PdfPasswordError extends Error {
  readonly issue: PdfPasswordIssue

  constructor(issue: PdfPasswordIssue) {
    super(issue === 'incorrect_password' ? 'Senha incorreta.' : 'O PDF exige senha.')
    this.name = 'PdfPasswordError'
    this.issue = issue
  }
}

export function pdfPasswordIssue(error: unknown): PdfPasswordIssue | null {
  if (error instanceof PdfPasswordError) return error.issue
  if (!error || typeof error !== 'object') return null

  const code = 'code' in error ? Number((error as { code?: unknown }).code) : NaN
  const name = 'name' in error ? String((error as { name?: unknown }).name) : ''

  if (code === INCORRECT_PASSWORD) return 'incorrect_password'
  if (code === NEED_PASSWORD || name === 'PasswordException') return 'need_password'
  return null
}
