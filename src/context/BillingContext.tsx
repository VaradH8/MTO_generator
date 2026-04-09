"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { BillingState, BillingEntry, BillingCycle } from "@/types/support"

const STORAGE_KEY = "spg_billing"

const EMPTY_STATE: BillingState = { currentEntries: [], history: [] }

/**
 * Pricing rules:
 * - First 100 supports = $200 flat
 * - After 100 = $1 per additional support
 * - Each revision = $50 flat
 * - Min supports per revision = 150, Max = 300
 */
export function calculateAmount(totalSupports: number, revisionCount: number): number {
  let amount = 0

  // Support charges
  if (totalSupports > 0) {
    amount += 200 // base rate for first 100
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setState(JSON.parse(raw))
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state, loaded])

  // Count unique supports and revisions
  // A revision = a support key that appears more than once across entries
  const keyOccurrences: Record<string, number> = {}
  for (const entry of state.currentEntries) {
    for (const key of entry.supportKeys) {
      keyOccurrences[key] = (keyOccurrences[key] || 0) + 1
    }
  }
  const currentUniqueKeys = Object.keys(keyOccurrences)
  const currentTotalSupports = currentUniqueKeys.length
  // Revision count = total times a support was repeated (occurrences - 1 for each key that appeared more than once)
  const currentRevisionCount = Object.values(keyOccurrences).reduce(
    (sum, count) => sum + Math.max(0, count - 1), 0
  )
  const currentAmount = calculateAmount(currentTotalSupports, currentRevisionCount)

  const allTimeTotalSupports =
    state.history.reduce((s, c) => s + c.totalSupports, 0) + currentTotalSupports

  const addEntry = useCallback((partial: Omit<BillingEntry, "id" | "date">) => {
    const entry: BillingEntry = {
      ...partial,
      id: generateId(),
      date: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      currentEntries: [...prev.currentEntries, entry],
    }))
  }, [])

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

      return {
        currentEntries: [],
        history: [...prev.history, cycle],
      }
    })
  }, [])

  const clearAll = useCallback(() => {
    setState(EMPTY_STATE)
    localStorage.removeItem(STORAGE_KEY)
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
