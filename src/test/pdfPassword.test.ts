import { describe, expect, it } from 'vitest'
import { PdfPasswordError, pdfPasswordIssue } from '../lib/pdfPassword'

describe('detecção de senha de PDF', () => {
  it('reconhece NEED_PASSWORD pelo código 1 e pelo nome da exceção', () => {
    expect(pdfPasswordIssue({ name: 'PasswordException', code: 1 })).toBe('need_password')
    expect(pdfPasswordIssue(Object.assign(new Error('protegido'), { name: 'PasswordException' }))).toBe('need_password')
  })

  it('reconhece INCORRECT_PASSWORD pelo código 2', () => {
    expect(pdfPasswordIssue({ name: 'PasswordException', code: 2 })).toBe('incorrect_password')
  })

  it('reconhece o erro lançado pelo próprio leitor', () => {
    expect(pdfPasswordIssue(new PdfPasswordError('incorrect_password'))).toBe('incorrect_password')
  })

  it('ignora erros sem relação com senha', () => {
    expect(pdfPasswordIssue(new Error('PDF corrompido'))).toBeNull()
    expect(pdfPasswordIssue(null)).toBeNull()
  })
})
