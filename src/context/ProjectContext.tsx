"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { Project, SupportTypeConfig, UploadRecord, ActivityEntry } from "@/types/support"

const STORAGE_KEY = "spg_projects"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  setActiveProjectId: (id: string | null) => void
  createProject: (clientName: string, createdBy?: string) => Project
  updateProject: (id: string, updates: Partial<Pick<Project, "clientName" | "supportTypes">>) => void
  deleteProject: (id: string) => void
  /** Returns { newSupports, revisions } after detecting duplicates */
  addUploadRecord: (projectId: string, record: Omit<UploadRecord, "id" | "uploadedAt" | "newSupports" | "revisions">) => { newSupports: number; revisions: number }
  addActivity: (projectId: string, user: string, action: ActivityEntry["action"], detail: string) => void
  getTypeNames: (projectId: string) => string[]
  getTypeConfigs: (projectId: string) => SupportTypeConfig[]
  activeTypeNames: string[]
  activeTypeConfigs: SupportTypeConfig[]
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setProjects(data.projects || [])
        setActiveProjectId(data.activeProjectId || null)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, activeProjectId }))
  }, [projects, activeProjectId, loaded])

  const activeProject = projects.find((p) => p.id === activeProjectId) || null

  const createProject = useCallback((clientName: string, createdBy?: string): Project => {
    const project: Project = {
      id: generateId(), clientName, createdBy: createdBy || "unknown",
      createdAt: new Date().toISOString(), supportTypes: [], uploads: [],
      activityLog: [{ id: generateId(), timestamp: new Date().toISOString(), user: createdBy || "unknown", action: "create", detail: `Project "${clientName}" created` }],
    }
    setProjects((prev) => [...prev, project])
    setActiveProjectId(project.id)
    return project
  }, [])

  const updateProject = useCallback((id: string, updates: Partial<Pick<Project, "clientName" | "supportTypes">>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setActiveProjectId((prev) => (prev === id ? null : prev))
  }, [])

  const addUploadRecord = useCallback((projectId: string, record: Omit<UploadRecord, "id" | "uploadedAt" | "newSupports" | "revisions">) => {
    let newSupports = 0
    let revisions = 0

    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p

      // Get all previously uploaded support keys for this project
      const existingKeys = new Set<string>()
      for (const upload of (p.uploads || [])) {
        for (const key of (upload.supportKeys || [])) {
          existingKeys.add(key)
        }
      }

      // Count new vs revision
      for (const key of record.supportKeys) {
        if (existingKeys.has(key)) revisions++
        else newSupports++
      }

      const full: UploadRecord = {
        ...record, id: generateId(), uploadedAt: new Date().toISOString(),
        newSupports, revisions,
      }

      return {
        ...p,
        uploads: [...(p.uploads || []), full],
        activityLog: [...(p.activityLog || []), {
          id: generateId(), timestamp: new Date().toISOString(),
          user: "system", action: "upload" as const,
          detail: `Uploaded ${record.fileName}: ${newSupports} new, ${revisions} revisions`,
        }],
      }
    }))

    return { newSupports, revisions }
  }, [])

  const addActivity = useCallback((projectId: string, user: string, action: ActivityEntry["action"], detail: string) => {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        activityLog: [...(p.activityLog || []), { id: generateId(), timestamp: new Date().toISOString(), user, action, detail }],
      }
    }))
  }, [])

  const getTypeNames = useCallback((projectId: string): string[] => {
    return projects.find((p) => p.id === projectId)?.supportTypes.map((t) => t.typeName) || []
  }, [projects])

  const getTypeConfigs = useCallback((projectId: string): SupportTypeConfig[] => {
    return projects.find((p) => p.id === projectId)?.supportTypes || []
  }, [projects])

  const activeTypeNames = activeProject?.supportTypes.map((t) => t.typeName) || []
  const activeTypeConfigs = activeProject?.supportTypes || []

  return (
    <ProjectContext.Provider value={{
      projects, activeProject, setActiveProjectId, createProject, updateProject, deleteProject,
      addUploadRecord, addActivity, getTypeNames, getTypeConfigs, activeTypeNames, activeTypeConfigs,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectContext)
  if (!context) throw new Error("useProjects must be used within ProjectProvider")
  return context
}
