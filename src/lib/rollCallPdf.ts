// src/lib/rollCallPdf.ts
// Browser side of the roll call upload: PDF file → positioned text per page
// (parsed by lib/rollCall.ts). PDF.js is loaded only when someone uploads, so
// it never weighs down the rest of the app. Nothing leaves the device here.

import type { PdfPage } from './rollCall'

export async function readPdfText(file: File): Promise<PdfPage[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: PdfPage[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    pages.push(
      content.items
        .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && !!it.str.trim())
        .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str }))
    )
  }
  await doc.destroy()
  return pages
}
