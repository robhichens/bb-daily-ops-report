// src/lib/derive.ts
// Pure helpers for derived fields. Call withDerived() before every save so the
// dashboard can query/group without recomputation.

import type { DailyOpsReport } from './schema';
import { computeQualityScore } from './gamification';

export const totalAttendance = (preschool: number, subsidy: number): number =>
  (preschool || 0) + (subsidy || 0);

/** Sum of per-staff overtime hours (2 dp). */
export const totalOvertime = (entries?: { hours: number }[]): number =>
  Math.round((entries ?? []).reduce((s, e) => s + (e.hours || 0), 0) * 100) / 100;

/** Weekday name for an ISO date (parsed as local to avoid TZ drift). */
export function weekdayName(dateIso: string): string {
  if (!dateIso) return '';
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}

/** Monday of the week containing dateIso, as 'YYYY-MM-DD'. ISO week (Mon start). */
export function weekOf(dateIso: string): string {
  if (!dateIso) return '';
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7; // Sunday=0 -> 6, Monday=1 -> 0
  dt.setDate(dt.getDate() - offset);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns a copy of the report with derived fields recomputed. */
export function withDerived(r: DailyOpsReport): DailyOpsReport {
  const derived: DailyOpsReport = {
    ...r,
    day: weekdayName(r.date),
    weekOf: weekOf(r.date),
    attendance: {
      ...r.attendance,
      total: totalAttendance(r.attendance.preschool, r.attendance.subsidy),
    },
    labor: {
      ...r.labor,
      // Derive from the per-staff breakout; keep the stored value if there are
      // no entries (so legacy/seeded data isn't zeroed out).
      overtimeHours: r.labor.overtimeEntries?.length
        ? totalOvertime(r.labor.overtimeEntries)
        : r.labor.overtimeHours,
    },
  };
  derived.qualityScore = computeQualityScore(derived);
  return derived;
}
