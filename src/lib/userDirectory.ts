// src/lib/userDirectory.ts
// A live list of everyone with an account (name, role, schools), shared by the
// whole app through ONE subscription. Used to find who a notification is for.
// users/{uid} is readable by every signed-in DOR user (firestore.rules).

import { useEffect, useState } from 'react'
import { subscribeUsers, type UserProfile } from './users'

let current: UserProfile[] = []
let listeners = new Set<(u: UserProfile[]) => void>()
let stop: (() => void) | null = null

export function useUserDirectory(): UserProfile[] {
  const [users, setUsers] = useState<UserProfile[]>(current)
  useEffect(() => {
    listeners.add(setUsers)
    if (!stop) {
      stop = subscribeUsers((rows) => {
        current = rows
        listeners.forEach((l) => l(rows))
      })
    }
    setUsers(current)
    return () => {
      listeners.delete(setUsers)
      if (listeners.size === 0 && stop) {
        stop()
        stop = null
        listeners = new Set()
      }
    }
  }, [])
  return users
}
