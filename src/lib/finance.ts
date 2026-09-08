// src/lib/finance.ts
// Firestore layer for the Finance Daily Ops Report (FDR) — one doc per DAY in
// `financeReports/{date}`, Billing & Deposits captured per location. Flags &
// Notes live in the central `orgDayNotes` ledger (see orgReports.ts, source 'fdr').

import {
  doc, getDoc, limit, onSnapshot, orderBy, query, collection, setDoc,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from './firebase'
import { weekOf as weekOfFn, weekdayName } from './derive'
import { financeDocId, type FinanceReport } from './schema'

const COL = 'financeReports'
const reportRef = (date: string) => doc(db, COL, financeDocId(date))
const reportsCol = () => collection(db, COL)

function withDerived(r: FinanceReport): FinanceReport {
  return { ...r, day: weekdayName(r.date), weekOf: weekOfFn(r.date) }
}

export function subscribeFinanceReport(date: string, cb: (report: FinanceReport | null) => void): Unsubscribe {
  return onSnapshot(reportRef(date), (snap) => cb(snap.exists() ? (snap.data() as FinanceReport) : null))
}

export async function getFinanceReport(date: string): Promise<FinanceReport | null> {
  const snap = await getDoc(reportRef(date))
  return snap.exists() ? (snap.data() as FinanceReport) : null
}

export async function upsertFinanceDraft(report: FinanceReport): Promise<void> {
  const payload: FinanceReport = {
    ...withDerived(report),
    status: report.status === 'submitted' ? 'submitted' : 'draft',
    updatedAt: new Date().toISOString(),
  }
  await setDoc(reportRef(payload.date), payload, { merge: true })
}

export async function submitFinanceReport(report: FinanceReport, uid: string): Promise<void> {
  const now = new Date().toISOString()
  const payload: FinanceReport = {
    ...withDerived(report),
    status: 'submitted', submittedAt: now, updatedAt: now,
    createdByUid: report.createdByUid || uid,
  }
  await setDoc(reportRef(payload.date), payload, { merge: true })
}

export function subscribeRecentFinanceReports(max: number, cb: (rows: FinanceReport[]) => void): Unsubscribe {
  return onSnapshot(query(reportsCol(), orderBy('date', 'desc'), limit(max)), (snap) =>
    cb(snap.docs.map((d) => d.data() as FinanceReport))
  )
}
