import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PrintModel } from '@/lib/printModel'
import { PrintableReport } from './PrintableReport'

/**
 * Print one sheet from a busy page (e.g. a dashboard list) without the rest of
 * the page. `print(model)` renders the sheet beside the app root, hides the app
 * for printing only (`body.print-sheet-active`, see index.css), opens the print
 * dialog (Print or Save as PDF), and cleans up afterwards. Render `sheet`
 * anywhere in the component.
 */
export function usePrintSheet() {
  const [model, setModel] = useState<PrintModel | null>(null)

  useEffect(() => {
    if (!model) return
    document.body.classList.add('print-sheet-active')
    const done = () => setModel(null)
    window.addEventListener('afterprint', done)
    // Let the sheet render before the dialog snapshots the page.
    const t = window.setTimeout(() => window.print(), 60)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('print-sheet-active')
    }
  }, [model])

  const sheet = model ? createPortal(<div className="print-sheet"><PrintableReport model={model} /></div>, document.body) : null
  return { print: setModel, sheet }
}
