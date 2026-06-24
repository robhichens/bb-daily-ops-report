// src/lib/localMirror.ts
// Offline-fallback mirror of in-progress drafts in localStorage. We write the
// draft locally on every edit so an editor never loses work if the network
// blips, and reconcile against Firestore by comparing updatedAt on load.

import type { DailyOpsReport } from './schema'

const KEY = (id: string) => `bb-dor:draft:${id}`

export function readLocalDraft(id: string): DailyOpsReport | null {
  try {
    const raw = localStorage.getItem(KEY(id))
    return raw ? (JSON.parse(raw) as DailyOpsReport) : null
  } catch {
    return null
  }
}

export function writeLocalDraft(report: DailyOpsReport): void {
  try {
    localStorage.setItem(KEY(report.id), JSON.stringify(report))
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function clearLocalDraft(id: string): void {
  try {
    localStorage.removeItem(KEY(id))
  } catch {
    /* non-fatal */
  }
}

/** Pick the freshest of remote vs local by updatedAt (remote wins ties). */
export function reconcile(
  remote: DailyOpsReport | null,
  local: DailyOpsReport | null
): DailyOpsReport | null {
  if (!remote) return local
  if (!local) return remote
  // A submitted remote always wins over a local draft.
  if (remote.status === 'submitted') return remote
  return local.updatedAt > remote.updatedAt ? local : remote
}
