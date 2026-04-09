"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { ValidationResult, GroupedSupports } from "@/types/support"

const STORAGE_KEY = "spg_support"

interface SupportContextType {
  validationResult: ValidationResult | null
  groupedSupports: GroupedSupports | null
  billingRecorded: boolean
  loaded: boolean
  setValidationResult: (result: ValidationResult | null) => void
  setGroupedSupports: (groups: GroupedSupports | null) => void
  setBillingRecorded: (recorded: boolean) => void
}

const SupportContext = createContext<SupportContextType | undefined>(undefined)

export function SupportProvider({ children }: { children: ReactNode }) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [groupedSupports, setGroupedSupports] = useState<GroupedSupports | null>(null)
  const [billingRecorded, setBillingRecorded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.validationResult) setValidationResult(parsed.validationResult)
        if (parsed.groupedSupports) setGroupedSupports(parsed.groupedSupports)
        if (parsed.billingRecorded) setBillingRecorded(parsed.billingRecorded)
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ validationResult, groupedSupports, billingRecorded }))
    }
  }, [validationResult, groupedSupports, billingRecorded, loaded])

  return (
    <SupportContext.Provider
      value={{
        validationResult,
        groupedSupports,
        billingRecorded,
        loaded,
        setValidationResult,
        setGroupedSupports,
        setBillingRecorded,
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
