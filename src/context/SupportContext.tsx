"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import type { ValidationResult, GroupedSupports } from "@/types/support"

interface SupportContextType {
  validationResult: ValidationResult | null
  groupedSupports: GroupedSupports | null
  setValidationResult: (result: ValidationResult | null) => void
  setGroupedSupports: (groups: GroupedSupports | null) => void
}

const SupportContext = createContext<SupportContextType | undefined>(undefined)

export function SupportProvider({ children }: { children: ReactNode }) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [groupedSupports, setGroupedSupports] = useState<GroupedSupports | null>(null)

  return (
    <SupportContext.Provider
      value={{
        validationResult,
        groupedSupports,
        setValidationResult,
        setGroupedSupports,
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
