import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PrintBlock, PrintModel } from '@/lib/printModel'

const BLANK = ' '

/** A "Print / PDF" button — triggers the browser print dialog (Save as PDF). */
export function PrintButton({ className }: { className?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()} className={className}>
      <Printer className="size-3.5" /> Print / PDF
    </Button>
  )
}

/** Print-only sheet: hidden on screen, shown when printing. Simple single column,
 *  all sections expanded; blank values render as fillable lines. */
export function PrintableReport({ model }: { model: PrintModel }) {
  return (
    <div className="hidden text-black print:block">
      <header className="flex items-center gap-3 border-b-2 pb-2" style={{ borderColor: '#c45e59' }}>
        <img src="/brand/bb-tree.png" alt="" className="size-10 object-contain" />
        <div className="flex-1">
          <div className="text-lg font-extrabold">Bright Beginnings · {model.reportName}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Daily Ops Report</div>
        </div>
        <span className="rounded border border-black px-2 py-1 text-sm font-bold">{model.short}</span>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-4">
        {model.meta.map((m) => (
          <div key={m.label} className="flex items-end gap-1.5">
            <span className="whitespace-nowrap font-semibold">{m.label}:</span>
            <span className="min-w-0 flex-1 border-b border-neutral-400">{m.value || BLANK}</span>
          </div>
        ))}
      </div>

      {model.sections.map((sec, i) => (
        <section key={i} className="mt-4 break-inside-avoid">
          <h3 className="border-b border-black/70 pb-0.5 text-[11px] font-extrabold uppercase tracking-wider">{sec.title}</h3>
          {sec.hint && <p className="mt-0.5 text-[10px] text-neutral-600">{sec.hint}</p>}
          <div className="mt-2 space-y-2.5">
            {sec.blocks.map((b, j) => <Block key={j} block={b} />)}
          </div>
        </section>
      ))}

      <p className="mt-6 text-[10px] text-neutral-500">
        Bright Beginnings · Daily Ops Report · printed {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}

function Block({ block }: { block: PrintBlock }) {
  if (block.kind === 'fields') {
    return (
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {block.fields.map((f, i) => (
          <div key={i} className="flex items-end gap-1.5 text-[12px]">
            <span className="whitespace-nowrap font-semibold">{f.label}:</span>
            <span className="min-w-0 flex-1 border-b border-neutral-400 pb-0.5">{f.value || BLANK}</span>
          </div>
        ))}
      </div>
    )
  }

  if (block.kind === 'table') {
    const t = block.table
    const count = Math.max(t.rows.length, t.minRows ?? 0)
    const rows = Array.from({ length: count }, (_, i) => t.rows[i] ?? t.columns.map(() => ''))
    return (
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={i} className="border border-neutral-500 px-2 py-1 text-left font-semibold">{c || BLANK}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {t.columns.map((_, ci) => (
                <td key={ci} className="h-6 border border-neutral-400 px-2 py-1 align-top">{r[ci] || BLANK}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (block.kind === 'lines') {
    const count = Math.max(block.values.length, block.minRows ?? 0)
    const rows = Array.from({ length: count }, (_, i) => block.values[i] ?? '')
    return (
      <div className="space-y-1.5">
        {block.label && <div className="text-[12px] font-semibold">{block.label}</div>}
        {rows.map((v, i) => (
          <div key={i} className="flex items-end gap-2 text-[12px]">
            <span className="text-neutral-500">{i + 1}.</span>
            <span className="min-w-0 flex-1 border-b border-neutral-400 pb-0.5">{v || BLANK}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-1.5 text-[12px]">
      <span className="whitespace-nowrap font-semibold">{block.label}:</span>
      <span className="min-w-0 flex-1 border-b border-neutral-400 pb-0.5">{block.value || BLANK}</span>
    </div>
  )
}
