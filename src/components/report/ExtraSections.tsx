import { EXTRA_DEFS } from '@/lib/reportRegistry'
import type { OrgFieldValue, OrgReport } from '@/lib/schema'
import { SectionCard } from '@/pages/OrgReport'

/** A report's answers to its Customize-page sections: data[section][field]. */
export type ExtraData = Record<string, Record<string, OrgFieldValue>>

/** The sections an admin added to the hand-built DDR or FDR on the Customize page,
 *  drawn with the same cards as the ADR/CDR. Renders nothing when there are none. */
export function ExtraSections({
  report, date, data, locked, onChange,
}: {
  report: 'ddr' | 'fdr'
  date: string
  data: ExtraData | undefined
  locked: boolean
  /** Gets a function of the latest answers, so quick typing never drops a keystroke. */
  onChange: (fn: (prev: ExtraData) => ExtraData) => void
}) {
  const def = EXTRA_DEFS[report]
  const live = def.sections.filter((s) => !s.retired)
  if (!live.length) return null
  // SectionCard reads only `data` and `date` from the report it's given.
  const shell = { data: data ?? {}, date } as OrgReport
  const setField = (section: string, field: string, value: OrgFieldValue) =>
    onChange((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
  const patchSection = (section: string, patch: Record<string, OrgFieldValue>) =>
    onChange((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }))
  return (
    <>
      {live.map((s) => (
        <SectionCard key={s.key} def={def} section={s} draft={shell} locked={locked} setField={setField} patchSection={patchSection} />
      ))}
    </>
  )
}
