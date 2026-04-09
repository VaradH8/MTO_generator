"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { ValidationResult, GroupedSupports } from "@/types/support"

const STORAGE_KEY = "spg_support"

interface SupportContextType {
  validationResult: ValidationResult | null
  groupedSupports: GroupedSupports | null
  /** Project ID and name carried through upload → review → output */
  currentProjectId: string
  currentProjectName: string
  approvalSubmitted: boolean
  loaded: boolean
  setValidationResult: (result: ValidationResult | null) => void
  setGroupedSupports: (groups: GroupedSupports | null) => void
  setCurrentProject: (id: string, name: string) => void
  setApprovalSubmitted: (submitted: boolean) => void
}

const SupportContext = createContext<SupportContextType | undefined>(undefined)

export function SupportProvider({ children }: { children: ReactNode }) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [groupedSupports, setGroupedSupports] = useState<GroupedSupports | null>(null)
  const [currentProjectId, setCurrentProjectId] = useState("")
  const [currentProjectName, setCurrentProjectName] = useState("")
  const [approvalSubmitted, setApprovalSubmitted] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.validationResult) setValidationResult(parsed.validationResult)
        if (parsed.groupedSupports) setGroupedSupports(parsed.groupedSupports)
        if (parsed.currentProjectId) setCurrentProjectId(parsed.currentProjectId)
        if (parsed.currentProjectName) setCurrentProjectName(parsed.currentProjectName)
        if (parsed.approvalSubmitted) setApprovalSubmitted(parsed.approvalSubmitted)
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        validationResult,
        groupedSupports,
        currentProjectId,
        currentProjectName,
        approvalSubmitted,
      }))
    }
  }, [validationResult, groupedSupports, currentProjectId, currentProjectName, approvalSubmitted, loaded])

  const setCurrentProject = (id: string, name: string) => {
    setCurrentProjectId(id)
    setCurrentProjectName(name)
  }

  return (
    <SupportContext.Provider
      value={{
        validationResult,
        groupedSupports,
        currentProjectId,
        currentProjectName,
        approvalSubmitted,
        loaded,
        setValidationResult,
        setGroupedSupports,
        setCurrentProject,
        setApprovalSubmitted,
      }}
    >
      {children}
    </SupportContext.Provider>
  )
}

export function useSupportContext() {
  const context = useContext(SupportContext)
  if (!context) {
    throw new Error("useSupportContext must be used within a SupportProvider")
  }
  return context
}
