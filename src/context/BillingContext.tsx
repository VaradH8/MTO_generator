"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { BillingState, BillingEntry, BillingCycle } from "@/types/support"

const EMPTY_STATE: BillingState = { currentEntries: [], history: [] }

/**
 * Pricing rules:
 * - First 100 supports = $190 flat
 * - After 100 = $1 per additional support
 * - Each revision = $50 flat
 * - Min supports per revision = 150, Max = 300
 */
export function calculateAmount(totalSupports: number, revisionCount: number): number {
  let amount = 0

  // Support charges
  if (totalSupports > 0) {
    amount += 190 // base rate for first 100
    if (totalSupports > 100) {
      amount += totalSupports - 100 // $1 per additional
    }
  }

  // Revision charges: $50 per revision
  amount += revisionCount * 50

  return amount
}

export const MIN_SUPPORTS_PER_REVISION = 150
export const MAX_SUPPORTS_PER_REVISION = 300

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

interface BillingContextType {
  state: BillingState
  currentTotalSupports: number
  currentUniqueKeys: string[]
  currentRevisionCount: number
  currentAmount: number
  addEntry: (entry: Omit<BillingEntry, "id" | "date">) => void
  markAsBilled: () => void
  clearAll: () => void
  allTimeTotalSupports: number
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BillingState>(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)

  // Fetch billing data from API on mount
  useEffect(() => {
    let cancelled = false
    async function fetchBilling() {
      try {
        const res = await fetch("/api/billing")
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setState({
              currentEntries: data.currentEntries ?? [],
              history: data.history ?? [],
            })
          }
        }
      } catch {
        // If API fails, start with empty state
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchBilling()
    return () => { cancelled = true }
  }, [])

  // Count unique supports and revisions
  const keyOccurrences: Record<string, number> = {}
  for (const entry of state.currentEntries) {
    for (const key of entry.supportKeys) {
      keyOccurrences[key] = (keyOccurrences[key] || 0) + 1
    }
  }
  const currentUniqueKeys = Object.keys(keyOccurrences)
  const currentTotalSupports = currentUniqueKeys.length
  const currentRevisionCount = Object.values(keyOccurrences).reduce(
    (sum, count) => sum + Math.max(0, count - 1), 0
  )
  const currentAmount = calculateAmount(currentTotalSupports, currentRevisionCount)

  const allTimeTotalSupports =
    state.history.reduce((s, c) => s + c.totalSupports, 0) + currentTotalSupports

  // Optimistic: update local state immediately, then POST to API
  const addEntry = useCallback((partial: Omit<BillingEntry, "id" | "date">) => {
    const entry: BillingEntry = {
      ...partial,
      id: generateId(),
      date: new Date().toISOString(),
    }

    // Optimistic update
    setState((prev) => ({
      ...prev,
      currentEntries: [...prev.currentEntries, entry],
    }))

    // Fire-and-forget POST to persist
    fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Rollback on failure
      setState((prev) => ({
        ...prev,
        currentEntries: prev.currentEntries.filter((e) => e.id !== entry.id),
      }))
    })
  }, [])

  // Optimistic: clear current entries and add a cycle, then POST to API
  const markAsBilled = useCallback(() => {
    setState((prev) => {
      if (prev.currentEntries.length === 0) return prev

      const keyOcc: Record<string, number> = {}
      for (const entry of prev.currentEntries) {
        for (const key of entry.supportKeys) {
          keyOcc[key] = (keyOcc[key] || 0) + 1
        }
      }
      const totalSupports = Object.keys(keyOcc).length
      const revisionCount = Object.values(keyOcc).reduce(
        (sum, count) => sum + Math.max(0, count - 1), 0
      )

      const cycle: BillingCycle = {
        id: generateId(),
        billedAt: new Date().toISOString(),
        entries: prev.currentEntries,
        totalSupports,
        amountDue: calculateAmount(totalSupports, revisionCount),
      }

      const optimisticState: BillingState = {
        currentEntries: [],
        history: [...prev.history, cycle],
      }

      // Fire-and-forget POST, reconcile with server response
      fetch("/api/billing/mark-billed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            // Reconcile with authoritative server state
            setState({
              currentEntries: data.currentEntries ?? [],
              history: data.history ?? [],
            })
          }
        })
        .catch(() => {
          // Rollback: restore the entries and remove the optimistic cycle
          setState((rollback) => ({
            currentEntries: cycle.entries,
            history: rollback.history.filter((c) => c.id !== cycle.id),
          }))
        })

      return optimisticState
    })
  }, [])

  const clearAll = useCallback(() => {
    setState(EMPTY_STATE)
  }, [])

  return (
    <BillingContext.Provider
      value={{
        state,
        currentTotalSupports,
        currentUniqueKeys,
        currentRevisionCount,
        currentAmount,
        addEntry,
        clearAll,
        markAsBilled,
        allTimeTotalSupports,
      }}
    >
      {children}
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const context = useContext(BillingContext)
  if (!context) {
    throw new Error("useBilling must be used within a BillingProvider")
  }
  return context
}
