import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfPasswordError, pdfPasswordIssue } from './pdfPassword'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function readPdfInvoiceLines(file: File, password?: string): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument(password ? { data, password } : { data })
  const lines: string[] = []

  try {
    const document = await task.promise

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      let currentY: number | null = null
      let currentLine = ''

      const flush = () => {
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = ''
      }

      for (const item of content.items) {
        if (!('str' in item) || typeof item.str !== 'string') continue
        const y = item.transform[5]
        if (currentY === null || Math.abs(y - currentY) > 3) {
          flush()
          currentY = y
        }
        currentLine += item.str
      }
      flush()
    }

    return lines
  } catch (error) {
    const issue = pdfPasswordIssue(error)
    if (issue) throw new PdfPasswordError(issue)
    throw error
  } finally {
    await task.destroy().catch(() => undefined)
  }
}
