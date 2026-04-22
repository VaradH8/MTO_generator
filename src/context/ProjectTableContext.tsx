"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { SupportRow, GroupedSupports } from "@/types/support"

const STORAGE_KEY = "spg_project_tables"

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
  // Lazy init — reads localStorage once on first render (client) so we never
  // trigger a cascading render from setState-in-effect.
  const [tables, setTables] = useState<Record<string, ProjectTableSnapshot>>(readFromStorage)
  const [loaded, setLoaded] = useState(typeof window !== "undefined")

  useEffect(() => {
    if (!loaded) setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
    } catch { /* quota — skip */ }
  }, [tables, loaded])

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
