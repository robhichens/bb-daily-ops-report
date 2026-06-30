// src/lib/settings.ts
// Admin-curated "Director view": which dashboard cards directors get to see.
// Stored at config/directorView. Readable by any signed-in DOR user, writable
// by admins (see firestore.rules).

import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'

export type DashboardSection =
  | 'kpis'
  | 'leaderboard'
  | 'teamGoal'
  | 'celebrations'
  | 'funnel'
  | 'staffWatch'
  | 'packet'
  | 'redFlags'

export interface DirectorViewConfig {
  sections: Record<DashboardSection, boolean>
}

/** Labels + the order they appear in the config editor / director view. */
export const SECTION_META: { key: DashboardSection; label: string; hint: string }[] = [
  { key: 'leaderboard', label: 'Leaderboard', hint: 'Friendly weekly ranking + streaks' },
  { key: 'teamGoal', label: 'Team goal', hint: 'Shared “everyone filed” progress bar' },
  { key: 'celebrations', label: 'Celebrations', hint: 'Wins: streaks, goals hit, growth' },
  { key: 'kpis', label: 'KPI cards', hint: 'Attendance, overtime, tours, reg fees' },
  { key: 'funnel', label: 'Enrollment pipeline', hint: 'Tours → enrollments, per site' },
  { key: 'staffWatch', label: 'Staff watch', hint: 'Call-outs, hires, recruiting' },
  { key: 'packet', label: 'Packet compliance', hint: 'Director-packet completion' },
  { key: 'redFlags', label: 'Red flags', hint: 'Operational issues (sensitive)' },
]

/** Default published view: the motivating stuff on, sensitive ops off. */
export const DEFAULT_DIRECTOR_VIEW: DirectorViewConfig = {
  sections: {
    leaderboard: true,
    teamGoal: true,
    celebrations: true,
    kpis: false,
    funnel: false,
    staffWatch: false,
    packet: false,
    redFlags: false,
  },
}

const ref = () => doc(db, 'config', 'directorView')

export function subscribeDirectorView(cb: (cfg: DirectorViewConfig) => void): Unsubscribe {
  return onSnapshot(
    ref(),
    (snap) => {
      if (!snap.exists()) return cb(DEFAULT_DIRECTOR_VIEW)
      const data = snap.data() as Partial<DirectorViewConfig>
      cb({ sections: { ...DEFAULT_DIRECTOR_VIEW.sections, ...(data.sections ?? {}) } })
    },
    () => cb(DEFAULT_DIRECTOR_VIEW)
  )
}

export async function updateDirectorView(cfg: DirectorViewConfig): Promise<void> {
  await setDoc(ref(), cfg, { merge: true })
}
