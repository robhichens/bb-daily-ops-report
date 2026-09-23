import type { ReactNode } from 'react'
import { Briefcase, ChevronDown, CalendarCheck, DollarSign, Megaphone, Phone, Receipt, Ticket, UserPlus, Users, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatShort } from '@/lib/dates'
import type { AdrSummary, CdrSummary, FdrSummary } from '@/lib/dashboardReports'
import { cn } from '@/lib/utils'
import { usePersistentOpen } from '@/lib/usePersistentOpen'

// Dashboard sections for the CDR, ADR and FDR. Each renders only for people
// with access to that report (the page decides); numbers cover the chosen
// period and compare against the prior equal-length period.

type Accent = 'coral' | 'yellow' | 'sky' | 'gray'

const money = (n: number) => `$${Math.round(n).toLocaleString()}`

/**
 * A titled dashboard section. When the page shows more than one section it
 * folds away behind its heading (chevron); collapsed, the heading carries a
 * one-line summary. Open/closed is remembered per device.
 */
export function ReportSection({
  title,
  sub,
  summary,
  storageKey,
  collapsible = true,
  children,
}: {
  title: string
  sub?: string
  /** Shown next to the title only while collapsed, e.g. "$21,904 net deposits". */
  summary?: string
  storageKey: string
  collapsible?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = usePersistentOpen(`section:${storageKey}`, true)
  const isOpen = !collapsible || open
  const detail = [sub, !isOpen && summary].filter(Boolean).join(' · ')
  const heading = (
    <>
      <h2 className="text-lg font-extrabold text-[var(--color-charcoal)]">{title}</h2>
      {detail && <span className="text-sm text-[var(--color-dk-gray)]">{detail}</span>}
    </>
  )

  return (
    <section className="space-y-4">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={isOpen}
          className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[var(--color-border)] pb-2 text-left"
        >
          {heading}
          <ChevronDown
            className={cn('ml-auto size-5 shrink-0 self-center text-[var(--color-mid-gray)] transition-transform', !isOpen && '-rotate-90')}
          />
        </button>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[var(--color-border)] pb-2">{heading}</div>
      )}
      {isOpen && children}
    </section>
  )
}

const daysFiled = (n: number) => `${n} day${n === 1 ? '' : 's'} filed`

/** "+3 vs prior period" (green up / red down); nothing when unchanged. */
function Change({ now, before, format = (n: number) => String(n), invert = false }: { now: number; before: number; format?: (n: number) => string; invert?: boolean }) {
  const d = now - before
  if (!d) return <span className="text-[var(--color-mid-gray)]">same as prior period</span>
  const good = invert ? d < 0 : d > 0
  return (
    <span className={good ? 'text-[var(--color-good)]' : 'text-[var(--color-critical)]'}>
      {d > 0 ? '+' : '−'}{format(Math.abs(d))} vs prior period
    </span>
  )
}

function Stat({ accent, icon, label, value, sub }: { accent: Accent; icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card accent={accent} className="p-4">
      <div className="flex items-center gap-2 text-[var(--color-dk-gray)]">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-brand text-3xl font-medium text-[var(--color-charcoal)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold">{sub}</p>}
    </Card>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="p-6 text-center">
      <p className="text-sm text-[var(--color-dk-gray)]">{children}</p>
    </Card>
  )
}

/** Small labeled number used inside panels. */
function Figure({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--color-dk-gray)]">{label}</span>
      <span className={cn('font-bold text-[var(--color-charcoal)]', strong && 'text-lg')}>{value}</span>
    </div>
  )
}

// --- CDR ----------------------------------------------------------------------

export function CdrSection({ summary, title, collapsible }: { summary: CdrSummary; title: string; collapsible?: boolean }) {
  const t = summary.total
  const p = summary.prevTotal
  const multi = summary.bySite.length > 1

  return (
    <ReportSection title={title} sub={daysFiled(t.filed)} summary={`${t.newLeads} new leads · ${t.toursDone} tours`} storageKey="cdr" collapsible={collapsible}>
      {t.filed === 0 ? (
        <Empty>No Co-Director reports submitted for this period yet.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat accent="coral" icon={<UserPlus className="size-4" />} label="New leads" value={t.newLeads} sub={<Change now={t.newLeads} before={p.newLeads} />} />
            <Stat accent="sky" icon={<Phone className="size-4" />} label="IKS calls · texts" value={`${t.iksCalls} · ${t.textsSent}`} sub={<Change now={t.iksCalls + t.textsSent} before={p.iksCalls + p.textsSent} />} />
            <Stat accent="yellow" icon={<CalendarCheck className="size-4" />} label="Tours completed" value={t.toursDone} sub={<span className="text-[var(--color-dk-gray)]">{t.toursScheduled} newly scheduled</span>} />
            <Stat
              accent={t.closingDone < t.filed ? 'coral' : 'gray'}
              icon={<Briefcase className="size-4" />}
              label="Closing checklist"
              value={`${t.closingDone}/${t.filed}`}
              sub={<span className={t.closingDone < t.filed ? 'text-[var(--color-critical)]' : 'text-[var(--color-good)]'}>{t.closingDone < t.filed ? `${t.filed - t.closingDone} day(s) not complete` : 'complete every day'}</span>}
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-dk-gray)]">Hiring pipeline</p>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ['Applicants', t.applicants],
                  ['Phone screens', t.phoneScreens],
                  ['Interviews', t.interviews],
                  ['Onboarded', t.onboarded],
                ].map(([label, n]) => (
                  <div key={label} className="rounded-lg bg-[var(--color-secondary)] px-1 py-2.5">
                    <div className="text-2xl font-extrabold text-[var(--color-charcoal)]">{n}</div>
                    <div className="text-[11px] font-semibold text-[var(--color-dk-gray)]">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                <Figure label="Emails answered" value={t.emails} />
                <Figure label="Voicemails returned" value={t.voicemails} />
                <Figure label="Facebook posts & events" value={t.socialPosts} />
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-critical)]">Closing checklist — missed days</p>
              {summary.closingMisses.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-dk-gray)]">The closing checklist was completed every day filed.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--color-border)]">
                  {summary.closingMisses.slice(0, 8).map((m, i) => (
                    <li key={i} className="py-2">
                      <div className="text-sm font-semibold text-[var(--color-charcoal)]">{formatShort(m.date)}{multi && ` · ${m.site}`}</div>
                      <div className="text-xs text-[var(--color-dk-gray)]">{m.reason || 'No reason given'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {multi && (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-secondary)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">
                  <tr>
                    {['Campus', 'Days filed', 'Leads', 'IKS calls', 'Texts', 'Tours', 'Applicants', 'Onboarded', 'Closing'].map((h) => (
                      <th key={h} className="px-4 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.bySite.map((s) => (
                    <tr key={s.siteId} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-semibold text-[var(--color-charcoal)]">{s.name}</td>
                      <td className="px-4 py-2">{s.filed}</td>
                      <td className="px-4 py-2">{s.newLeads}</td>
                      <td className="px-4 py-2">{s.iksCalls}</td>
                      <td className="px-4 py-2">{s.textsSent}</td>
                      <td className="px-4 py-2">{s.toursDone}</td>
                      <td className="px-4 py-2">{s.applicants}</td>
                      <td className="px-4 py-2">{s.onboarded}</td>
                      <td className="px-4 py-2">{s.filed ? `${s.closingDone}/${s.filed}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </ReportSection>
  )
}

// --- ADR ----------------------------------------------------------------------

export function AdrSection({ summary, collapsible }: { summary: AdrSummary; collapsible?: boolean }) {
  const t = summary.total
  const p = summary.prevTotal
  const pipe = summary.pipeline

  return (
    <ReportSection title="Admissions Daily Report" sub={daysFiled(t.filed)} summary={`${t.inquiries} inquiries · ${t.newEnrollments} new enrollments`} storageKey="adr" collapsible={collapsible}>
      {t.filed === 0 ? (
        <Empty>No Admissions reports submitted for this period yet.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat accent="yellow" icon={<Ticket className="size-4" />} label="Inquiries" value={t.inquiries} sub={<Change now={t.inquiries} before={p.inquiries} />} />
            <Stat accent="sky" icon={<CalendarCheck className="size-4" />} label="Tours given" value={t.toursGiven} sub={<span className="text-[var(--color-dk-gray)]">{t.toursScheduled} scheduled</span>} />
            <Stat accent="coral" icon={<DollarSign className="size-4" />} label="Reg fees paid" value={t.regFees} sub={<span className="text-[var(--color-good)]">{money(t.regFeesAmt)} collected</span>} />
            <Stat accent="gray" icon={<UserPlus className="size-4" />} label="New enrollments" value={t.newEnrollments} sub={<Change now={t.newEnrollments} before={p.newEnrollments} />} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-dk-gray)]">
                Pipeline right now{pipe && ` · as of ${formatShort(pipe.asOf)}`}
              </p>
              {pipe && (
                <div className="mt-2">
                  <Figure label="Active leads" value={pipe.activeLeads} strong />
                  <Figure label="Tours pending" value={pipe.toursPending} />
                  <Figure label="Waitlist" value={pipe.waitlist} />
                  <Figure label="Follow-ups outstanding" value={pipe.followUps} />
                </div>
              )}
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-dk-gray)]">
                <Megaphone className="size-3.5" /> Outreach & attrition
              </p>
              <div className="mt-2">
                <Figure label="Locations visited" value={t.locationsVisited} />
                <Figure label="Flyers distributed" value={t.flyers} />
                <Figure label="Withdrawals logged" value={t.withdrawals} />
              </div>
            </Card>
          </div>
        </>
      )}
    </ReportSection>
  )
}

// --- FDR ----------------------------------------------------------------------

export function FdrSection({ summary, collapsible }: { summary: FdrSummary; collapsible?: boolean }) {
  const t = summary.total
  const multi = summary.bySite.length > 1
  const outstanding = t.outstandingCurrent + t.outstandingFormer

  return (
    <ReportSection title="Finance Daily Report" sub={daysFiled(summary.filed)} summary={`${money(t.deposits)} net deposits`} storageKey="fdr" collapsible={collapsible}>
      {summary.filed === 0 ? (
        <Empty>No Finance reports submitted for this period yet.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat accent="coral" icon={<Wallet className="size-4" />} label="Net deposits" value={money(t.deposits)} sub={<Change now={t.deposits} before={summary.prevDeposits} format={money} />} />
            <Stat accent="sky" icon={<Receipt className="size-4" />} label="Charges" value={money(t.charges)} sub={<span className="text-[var(--color-dk-gray)]">{money(t.credits)} in credits</span>} />
            <Stat
              accent={outstanding > 0 ? 'yellow' : 'gray'}
              icon={<Users className="size-4" />}
              label="Outstanding"
              value={money(outstanding)}
              sub={<span className="text-[var(--color-dk-gray)]">{summary.outstandingAsOf ? `as of ${formatShort(summary.outstandingAsOf)}` : ''}</span>}
            />
            <Stat
              accent={t.declinesRefunds > 0 ? 'coral' : 'gray'}
              icon={<DollarSign className="size-4" />}
              label="Declines & refunds"
              value={money(t.declinesRefunds)}
              sub={<span className="text-[var(--color-dk-gray)]">{summary.declines.length} item{summary.declines.length === 1 ? '' : 's'}</span>}
            />
          </div>

          {/* Full-width table from tablet up; stacked cards per location on phones. */}
          <Card className="hidden overflow-hidden p-0 sm:block">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-secondary)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">
                  <tr>
                    {['Location', 'Checks', 'Agency', 'Tuition Express', 'Declines', 'Net deposits', 'Outstanding'].map((h) => (
                      <th key={h} className="px-4 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.bySite.map((s) => (
                    <tr key={s.siteId} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-semibold whitespace-nowrap text-[var(--color-charcoal)]">{s.name}</td>
                      <td className="px-4 py-2">{money(s.checks)}</td>
                      <td className="px-4 py-2">{money(s.agency)}</td>
                      <td className="px-4 py-2">{money(s.tuitionExpress)}</td>
                      <td className="px-4 py-2">{s.declinesRefunds ? `−${money(s.declinesRefunds)}` : '—'}</td>
                      <td className="px-4 py-2 font-bold text-[var(--color-charcoal)]">{money(s.deposits)}</td>
                      <td className="px-4 py-2">{money(s.outstandingCurrent + s.outstandingFormer)}</td>
                    </tr>
                  ))}
                  {multi && (
                    <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-secondary)]/50 font-bold text-[var(--color-charcoal)]">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2">{money(t.checks)}</td>
                      <td className="px-4 py-2">{money(t.agency)}</td>
                      <td className="px-4 py-2">{money(t.tuitionExpress)}</td>
                      <td className="px-4 py-2">{t.declinesRefunds ? `−${money(t.declinesRefunds)}` : '—'}</td>
                      <td className="px-4 py-2">{money(t.deposits)}</td>
                      <td className="px-4 py-2">{money(outstanding)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
          </Card>

          <div className="grid gap-3 sm:hidden">
            {summary.bySite.map((s) => (
              <Card key={s.siteId} className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-[var(--color-charcoal)]">{s.name}</span>
                  <span className="text-lg font-extrabold text-[var(--color-charcoal)]">{money(s.deposits)}</span>
                </div>
                <div className="mt-1 border-t border-[var(--color-border)] pt-1">
                  <Figure label="Checks" value={money(s.checks)} />
                  <Figure label="Agency" value={money(s.agency)} />
                  <Figure label="Tuition Express" value={money(s.tuitionExpress)} />
                  {s.declinesRefunds > 0 && <Figure label="Declines & refunds" value={`−${money(s.declinesRefunds)}`} />}
                  <Figure label="Outstanding" value={money(s.outstandingCurrent + s.outstandingFormer)} />
                </div>
              </Card>
            ))}
          </div>

            <Card className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-critical)]">Declines & refunds</p>
              {summary.declines.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-dk-gray)]">None this period.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--color-border)]">
                  {summary.declines.slice(0, 10).map((d, i) => (
                    <li key={i} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--color-charcoal)]">{d.parent || 'Unnamed'}</div>
                        <div className="text-xs text-[var(--color-dk-gray)]">{[d.type, multi && d.site, formatShort(d.date)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span className="shrink-0 font-bold text-[var(--color-critical)]">−{money(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
        </>
      )}
    </ReportSection>
  )
}
