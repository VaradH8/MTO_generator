"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import type { ValidationResult, GroupedSupports } from "@/types/support"

interface SupportContextType {
  validationResult: ValidationResult | null
  groupedSupports: GroupedSupports | null
  /** Project ID and name carried through upload → review → output */
  currentProjectId: string
  currentProjectName: string
  setValidationResult: (result: ValidationResult | null) => void
  setGroupedSupports: (groups: GroupedSupports | null) => void
  setCurrentProject: (id: string, name: string) => void
}

const SupportContext = createContext<SupportContextType | undefined>(undefined)

export function SupportProvider({ children }: { children: ReactNode }) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [groupedSupports, setGroupedSupports] = useState<GroupedSupports | null>(null)
  const [currentProjectId, setCurrentProjectId] = useState("")
  const [currentProjectName, setCurrentProjectName] = useState("")

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
        setValidationResult,
        setGroupedSupports,
        setCurrentProject,
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
