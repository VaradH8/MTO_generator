"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { Project, SupportTypeConfig, UploadRecord, ActivityEntry } from "@/types/support"

const ACTIVE_PROJECT_KEY = "spg_active_project_id"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  setActiveProjectId: (id: string | null) => void
  createProject: (clientName: string, createdBy?: string, supportRange?: number) => Project
  updateProject: (id: string, updates: Partial<Pick<Project, "clientName" | "supportTypes" | "supportRange">>) => void
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

  // On mount: restore activeProjectId from localStorage, fetch projects from API
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY)
      if (savedId) setActiveProjectId(savedId)
    } catch { /* ignore */ }

    fetch("/api/projects")
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/projects failed: ${res.status}`)
        return res.json()
      })
      .then((data: Project[]) => {
        setProjects(data)
      })
      .catch((err) => {
        console.error("Failed to fetch projects:", err)
      })
      .finally(() => {
        setLoaded(true)
      })
  }, [])

  // Persist activeProjectId to localStorage whenever it changes
  useEffect(() => {
    if (!loaded) return
    try {
      if (activeProjectId) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId)
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY)
      }
    } catch { /* ignore */ }
  }, [activeProjectId, loaded])

  const activeProject = projects.find((p) => p.id === activeProjectId) || null

  const createProject = useCallback((clientName: string, createdBy?: string, supportRange?: number): Project => {
    // Build an optimistic project object
    const optimisticId = generateId()
    const project: Project = {
      id: optimisticId,
      clientName,
      createdBy: createdBy || "unknown",
      createdAt: new Date().toISOString(),
      supportRange: supportRange || 0,
      supportTypes: [],
      uploads: [],
      activityLog: [],
    }

    // Optimistic update
    setProjects((prev) => [...prev, project])
    setActiveProjectId(optimisticId)

    // Fire API call
    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName, createdBy: createdBy || "unknown", supportRange: supportRange ?? 0 }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`POST /api/projects failed: ${res.status}`)
        return res.json()
      })
      .then((created: Project) => {
        // Replace the optimistic project with the server response
        setProjects((prev) => prev.map((p) => (p.id === optimisticId ? created : p)))
        setActiveProjectId(created.id)
      })
      .catch((err) => {
        console.error("Failed to create project:", err)
      })

    return project
  }, [])

  const updateProject = useCallback((id: string, updates: Partial<Pick<Project, "clientName" | "supportTypes" | "supportRange">>) => {
    // Optimistic update
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))

    // Fire API call
    fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`PUT /api/projects/${id} failed: ${res.status}`)
      })
      .catch((err) => {
        console.error("Failed to update project:", err)
      })
  }, [])

  const deleteProject = useCallback((id: string) => {
    // Optimistic update
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setActiveProjectId((prev) => (prev === id ? null : prev))

    // Fire API call
    fetch(`/api/projects/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error(`DELETE /api/projects/${id} failed: ${res.status}`)
      })
      .catch((err) => {
        console.error("Failed to delete project:", err)
      })
  }, [])

  const addUploadRecord = useCallback((projectId: string, record: Omit<UploadRecord, "id" | "uploadedAt" | "newSupports" | "revisions">) => {
    // Compute optimistic newSupports/revisions from local state
    let newSupports = 0
    let revisions = 0

    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p

      const existingKeys = new Set<string>()
      for (const upload of (p.uploads || [])) {
        for (const key of (upload.supportKeys || [])) {
          existingKeys.add(key)
        }
      }

      for (const key of record.supportKeys) {
        if (existingKeys.has(key)) revisions++
        else newSupports++
      }

      const optimisticUpload: UploadRecord = {
        ...record,
        id: generateId(),
        uploadedAt: new Date().toISOString(),
        newSupports,
        revisions,
      }

      return {
        ...p,
        uploads: [...(p.uploads || []), optimisticUpload],
        activityLog: [...(p.activityLog || []), {
          id: generateId(),
          timestamp: new Date().toISOString(),
          user: "system",
          action: "upload" as const,
          detail: `Uploaded ${record.fileName}: ${newSupports} new, ${revisions} revisions`,
        }],
      }
    }))

    // Fire API call — server recomputes newSupports/revisions authoritatively
    fetch(`/api/projects/${projectId}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: record.fileName,
        rowCount: record.rowCount,
        types: record.types,
        supportKeys: record.supportKeys,
        classification: record.classification,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`POST /api/projects/${projectId}/uploads failed: ${res.status}`)
        return res.json()
      })
      .then((serverUpload: UploadRecord) => {
        // Replace the optimistic upload with the server response
        setProjects((prev) => prev.map((p) => {
          if (p.id !== projectId) return p
          // Replace the last upload (the optimistic one) with server data
          const uploads = [...(p.uploads || [])]
          const optimisticIdx = uploads.findIndex(
            (u) => u.fileName === serverUpload.fileName && u.newSupports === newSupports && u.revisions === revisions
          )
          if (optimisticIdx >= 0) {
            uploads[optimisticIdx] = serverUpload
          }
          return { ...p, uploads }
        }))
      })
      .catch((err) => {
        console.error("Failed to add upload record:", err)
      })

    return { newSupports, revisions }
  }, [])

  const addActivity = useCallback((projectId: string, user: string, action: ActivityEntry["action"], detail: string) => {
    // Optimistic update
    const optimisticEntry: ActivityEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      user,
      action,
      detail,
    }

    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        activityLog: [...(p.activityLog || []), optimisticEntry],
      }
    }))

    // Fire API call
    fetch(`/api/projects/${projectId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, action, detail }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`POST /api/projects/${projectId}/activity failed: ${res.status}`)
      })
      .catch((err) => {
        console.error("Failed to add activity:", err)
      })
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
