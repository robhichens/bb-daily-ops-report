import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, PenLine, Send } from 'lucide-react'
import { SITES, type SiteId } from '@/lib/schema'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { inputClass } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type State = 'idle' | 'saving' | 'added' | 'error'

/** "Add a note" box for the admin Day Notes board: an admin writes a note that
 *  isn't part of any report, and it lands on the board for every admin like any
 *  other Flags & Notes entry (check off, flag, comment, Buy/Fix). Pure UI — the
 *  page passes the save in as `onAdd`; a rejection shows a retry message and keeps
 *  the text so nothing typed is lost. */
export function AddNoteCard({
  onAdd,
}: {
  onAdd: (text: string, siteId: SiteId | null) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [campus, setCampus] = useState<SiteId | ''>('')
  const [state, setState] = useState<State>('idle')
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(clearTimer.current), [])

  const saving = state === 'saving'
  const canAdd = text.trim() !== '' && !saving

  async function add() {
    if (!canAdd) return
    clearTimeout(clearTimer.current)
    setState('saving')
    try {
      await onAdd(text.trim(), campus || null)
      // Back to "HQ / general" each time: a forgotten campus is harmless, a stale
      // one would quietly tag the next note to the wrong school.
      setText('')
      setCampus('')
      setState('added')
      clearTimer.current = setTimeout(() => setState('idle'), 3500)
    } catch {
      setState('error')
    }
  }

  return (
    <Card accent="gray" className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-dk-gray)]">
          <PenLine className="size-3.5" /> Add a note
        </p>
        <span className="text-xs text-[var(--color-mid-gray)]">Every admin sees it on this board</span>
      </div>

      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (state === 'error') setState('idle')
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void add()
        }}
        disabled={saving}
        aria-label="Add a note"
        placeholder="Something the team should know — not tied to a report…"
        className="mt-2.5"
      />

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-dk-gray)]">
          <span className="uppercase tracking-wide">Campus</span>
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value as SiteId | '')}
            disabled={saving}
            className={cn(inputClass, 'h-9 w-auto')}
          >
            <option value="">HQ / general</option>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3">
          <span role="status" aria-live="polite" className="text-xs font-semibold">
            {state === 'added' && (
              <span className="inline-flex items-center gap-1 text-[var(--color-good)]">
                <Check className="size-3.5" strokeWidth={3} /> Note added
              </span>
            )}
            {state === 'error' && <span className="text-[var(--color-coral-dark)]">Couldn’t save — try again</span>}
          </span>
          <Button disabled={!canAdd} onClick={() => void add()}>
            {saving ? <Loader2 className="animate-spin" /> : <Send />} Add note
          </Button>
        </div>
      </div>
    </Card>
  )
}
