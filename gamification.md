# BB DOR — Gamification & Engagement Design (addendum to `bb-dor.md`)

**Status:** Design agreed 2026-06-23 with Rob. This is the engagement layer the original
`bb-dor.md` spec did not cover. `bb-dor.md` remains authoritative for the form fields and
core data model; this doc is authoritative for points, streaks, badges, leaderboard, and
the celebration/red-flag surfaces.

## Guiding principles

1. **Reward what directors control.** Points come from *consistency and quality of the
   report* — showing up daily and doing it thoroughly — never from business outcomes
   (enrollments, attendance, comms volume). Outcomes are surfaced as **insights and
   red-flags**, never as a personal score. This prevents metric-gaming (e.g. padding
   "Enrollment Comms Out" to hit the 15 goal).
2. **Friendly, not cutthroat.** A visible weekly leaderboard of the three directors PLUS a
   shared team goal everyone wins together. Competition for spark, collaboration for morale.
3. **A slip shouldn't kill motivation.** Comeback mechanics so one missed day doesn't erase
   weeks of effort.
4. **Derived, not stored.** Streaks/points/quality are computed from the reports themselves
   (the source of truth) in `src/lib/gamification.ts`, mirroring how `derive.ts` works. The
   only persisted addition is a derived `qualityScore` written onto each report at save time.

## Workdays

Streaks count **Monday–Friday only**. Weekends and configured holidays are skipped — they
neither extend nor break a streak. (Confirmed: sites do not operate Saturdays.)
Holiday list lives in `gamification.ts` as a config array.

## Quality score (0–100, derived per report)

Rewards thoroughness, not big numbers:

| Component | Weight | Rule |
|---|---|---|
| Sections engaged | 30 | Attendance + Labor have non-default values entered |
| Notes where counted | 30 | For every count > 0, the matching notes field is non-empty |
| Director Packet | 15 | `completed === true`, OR `incompleteReason` filled when "No" |
| Director Report | 15 | ≥ 1 substantive (non-empty, trimmed) line |
| Comms goal context | 10 | `enrollmentCommsOut` notes filled (process, not the count itself) |

Written as `qualityScore` on the report via the `withDerived` pipeline so the dashboard can
aggregate without recompute. Additive to the `schema.ts` contract.

## Streaks

- A **submitted** report on a workday extends the director's streak (+1).
- A missed workday breaks it — softened by:
  - **Streak freeze:** one auto-applied "freeze" token per calendar month covers a single
    missed workday so the streak survives.
  - **Comeback badge:** filing the day after a break earns a "Back on Track" badge.
- Tracked **per director** (their `uid`/site). Current streak + longest streak (personal best).

## Points (weekly + all-time, derived)

Per submitted report: `base 10 (on-time submit) + round(qualityScore / 10)` →
roughly 10–20 pts/day. On-time = submitted same calendar day as the report `date`
(late submit still earns base/2). No points for business metrics.

## Badges / milestones

- Streak: **7 / 30 / 100** workday streaks.
- **Personal best** (new longest streak, new best quality week).
- **Perfect week** (filed every workday, all on-time).
- **Back on Track** (comeback after a break).
- **Thorough** (quality ≥ 90 for a full week).

## Leaderboard (friendly + team)

- **Weekly individual board** ranking the three on a **consistency score** =
  completion % + on-time % + average quality (all process metrics). Ties broken by streak.
- **Shared team goal bar:** e.g. "All three filed every workday this week" → team
  celebration animation. Configurable weekly team goal.
- Weekly callouts: **🏆 Top of the week** and **📈 Most improved** (biggest consistency gain
  vs prior week).

## Celebrations (Framer Motion)

- On submit: confetti + streak-up toast ("🔥 12-day streak!").
- Badge unlock modal.
- Dashboard celebration feed: milestones hit, comms-goal met, net-positive enrollment,
  perfect weeks.

## Red flags (dashboard — operations, NOT tied to director scores)

Missed report today · OT% > 5% · Director Packet "No" (with reason) · termination spike ·
call-out/late spike · enrollment comms trending below the daily 15 goal. These inform
leadership; they never subtract from a director's points.

## Where it lives

- `src/lib/gamification.ts` — pure functions: `qualityScore`, `computeStreak`,
  `weeklyPoints`, `consistencyScore`, `badgesFor`, `teamGoalProgress`, workday/holiday config.
- `qualityScore` folded into `withDerived` (derive.ts) so it persists on every save.
- Dashboard components: `Leaderboard`, `StreakRail`, `BadgeShelf`, `TeamGoal`,
  `CelebrationFeed`, plus red-flags woven into existing KPI/Staff/Packet panels.
