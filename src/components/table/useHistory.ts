import { useState, useCallback } from "react"
import type { HistoryEntry } from "./types"

const MAX_HISTORY = 100

export function useHistory() {
  const [past, setPast] = useState<HistoryEntry[]>([])
  const [future, setFuture] = useState<HistoryEntry[]>([])

  const push = useCallback((entry: HistoryEntry) => {
    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), entry])
    setFuture([])
  }, [])

  const undo = useCallback((): HistoryEntry | null => {
    let entry: HistoryEntry | null = null
    setPast((prev) => {
      if (prev.length === 0) return prev
      entry = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    if (entry) {
      const e = entry
      setFuture((prev) => [...prev, e])
    }
    return entry
  }, [])

  const redo = useCallback((): HistoryEntry | null => {
    let entry: HistoryEntry | null = null
    setFuture((prev) => {
      if (prev.length === 0) return prev
      entry = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    if (entry) {
      const e = entry
      setPast((prev) => [...prev, e])
    }
    return entry
  }, [])

  return { past, future, push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}
