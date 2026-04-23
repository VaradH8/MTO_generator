"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import type { SupportRow, GroupedSupports } from "@/types/support"

const STORAGE_KEY = "spg_project_tables"
const SAVE_DEBOUNCE_MS = 500

export interface ProjectTableSnapshot {
  rows: SupportRow[]
  groupedSupports: GroupedSupports
  updatedAt: string
}

interface ProjectTableContextType {
  loaded: boolean
  getProjectTable: (projectId: string) => ProjectTableSnapshot | null
  saveProjectTable: (projectId: string, rows: SupportRow[]) => void
  clearProjectTable: (projectId: string) => void
}

const ProjectTableContext = createContext<ProjectTableContextType | undefined>(undefined)

function groupByType(rows: SupportRow[]): GroupedSupports {
  const grouped: GroupedSupports = {}
  for (const r of rows) {
    const t = r.type || "Unknown"
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(r)
  }
  return grouped
}

function readFromStorage(): Record<string, ProjectTableSnapshot> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, ProjectTableSnapshot>
  } catch { /* ignore */ }
  return {}
}

export function ProjectTableProvider({ children }: { children: ReactNode }) {
  // Seed from localStorage for instant UI, then merge in server-side snapshots
  // once they arrive. Server is the source of truth going forward.
  const [tables, setTables] = useState<Record<string, ProjectTableSnapshot>>(readFromStorage)
  const [loaded, setLoaded] = useState(false)
  const pendingSaves = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Hydrate from server on mount.
  useEffect(() => {
    let cancelled = false
    fetch("/api/projects/tables")
      .then((res) => res.ok ? res.json() : {})
      .then((data: Record<string, SupportRow[]>) => {
        if (cancelled || !data || typeof data !== "object") return
        setTables((prev) => {
          const next = { ...prev }
          for (const [pid, rows] of Object.entries(data)) {
            if (!Array.isArray(rows) || rows.length === 0) continue
            next[pid] = {
              rows,
              groupedSupports: groupByType(rows),
              updatedAt: new Date().toISOString(),
            }
          }
          return next
        })
      })
      .catch(() => { /* offline → fall back to localStorage */ })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // Mirror to localStorage for fast reloads.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
    } catch { /* quota — skip */ }
  }, [tables])

  const saveProjectTable = useCallback((projectId: string, rows: SupportRow[]) => {
    if (!projectId) return
    setTables((prev) => ({
      ...prev,
      [projectId]: {
        rows,
        groupedSupports: groupByType(rows),
        updatedAt: new Date().toISOString(),
      },
    }))

    // Debounce server writes — a fast typing session on the table shouldn't
    // fire one PUT per keystroke.
    const existing = pendingSaves.current.get(projectId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      pendingSaves.current.delete(projectId)
      fetch(`/api/projects/${projectId}/table`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      }).catch((err) => console.error("Failed to save project table:", err))
    }, SAVE_DEBOUNCE_MS)
    pendingSaves.current.set(projectId, timer)
  }, [])

  const getProjectTable = useCallback(
    (projectId: string) => tables[projectId] || null,
    [tables],
  )

  const clearProjectTable = useCallback((projectId: string) => {
    setTables((prev) => {
      const n = { ...prev }
      delete n[projectId]
      return n
    })
    fetch(`/api/projects/${projectId}/table`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [] }),
    }).catch(() => { /* best effort */ })
  }, [])

  return (
    <ProjectTableContext.Provider value={{ loaded, getProjectTable, saveProjectTable, clearProjectTable }}>
      {children}
    </ProjectTableContext.Provider>
  )
}

export function useProjectTables() {
  const ctx = useContext(ProjectTableContext)
  if (!ctx) throw new Error("useProjectTables must be used within ProjectTableProvider")
  return ctx
}
