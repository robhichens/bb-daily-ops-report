// src/lib/appConfigStore.ts
// Loads and saves the Customize page settings (lib/appConfig.ts).
//   appConfig/current              → { config, version, savedAt, savedBy, changes }
//   appConfig/current/versions/{n} → the same, one doc per save (history + roll back)
// Every DOR user can read them (the forms and dashboard need them); only admins
// (Kathe, Molly, Rob) can write — see firestore.rules.

import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction,
} from 'firebase/firestore'
import { db } from './firebase'
import { normalizeConfig, type DorConfig } from './appConfig'

export interface ConfigVersion {
  version: number
  config: DorConfig
  savedAt: string
  savedBy: string
  changes: string[]
}

const currentRef = () => doc(db, 'appConfig', 'current')
const versionsCol = () => collection(db, 'appConfig', 'current', 'versions')
const CACHE_KEY = 'dor.appConfig.v1'

/** Firestore drops `undefined`; a cleared built-in hint must be saved as ''. */
function serialize(c: DorConfig): DorConfig {
  const out = JSON.parse(JSON.stringify(c)) as DorConfig
  for (const r of Object.values(out.reports)) for (const s of r.sections) s.hint = s.hint ?? ''
  return out
}

function toVersion(data: Record<string, unknown> | undefined): ConfigVersion | null {
  if (!data) return null
  return {
    version: typeof data.version === 'number' ? data.version : 0,
    config: normalizeConfig(data.config),
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    savedBy: typeof data.savedBy === 'string' ? data.savedBy : '',
    changes: Array.isArray(data.changes) ? data.changes.filter((x): x is string => typeof x === 'string') : [],
  }
}

/** The saved settings, or null when nothing has been saved (or it can't be read). */
export async function loadConfig(): Promise<ConfigVersion | null> {
  const snap = await getDoc(currentRef())
  const v = snap.exists() ? toVersion(snap.data()) : null
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)) } catch { /* private mode */ }
  return v
}

/** Last settings this device saw — used when Firestore can't be reached at sign-in. */
export function cachedConfig(): ConfigVersion | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? toVersion(JSON.parse(raw) as Record<string, unknown>) : null
  } catch { return null }
}

export class ConfigConflictError extends Error {
  by: string
  constructor(by: string) { super('conflict'); this.by = by }
}

/** Saves a new version. `baseVersion` is the one the editor started from: if
 *  someone else saved since, nothing is written and ConfigConflictError says who. */
export async function saveConfig(config: DorConfig, baseVersion: number, savedBy: string, changes: string[]): Promise<ConfigVersion> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(currentRef())
    const cur = snap.exists() ? toVersion(snap.data()) : null
    if ((cur?.version ?? 0) !== baseVersion) throw new ConfigConflictError(cur?.savedBy || 'someone')
    const v: ConfigVersion = { version: baseVersion + 1, config: serialize(config), savedAt: new Date().toISOString(), savedBy, changes }
    tx.set(currentRef(), v)
    tx.set(doc(versionsCol(), String(v.version).padStart(5, '0')), v)
    return v
  })
}

/** Newest first. */
export async function listVersions(max = 30): Promise<ConfigVersion[]> {
  const snap = await getDocs(query(versionsCol(), orderBy('version', 'desc'), limit(max)))
  return snap.docs.map((d) => toVersion(d.data())).filter((v): v is ConfigVersion => !!v)
}
