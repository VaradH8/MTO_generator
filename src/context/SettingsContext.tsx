"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import type { MasterItem, MasterTypeConfig } from "@/types/support"

export interface PdfConfig {
  headerText: string
  footerText: string
  primaryColor: string
}

const DEFAULT_PDF_CONFIG: PdfConfig = {
  headerText: "Support MTO",
  footerText: "Support MTO Generator",
  primaryColor: "#1F3CA8",
}

const DEFAULT_ITEMS: MasterItem[] = [
  { id: "bracket", name: "Bracket" },
  { id: "nut", name: "Nut" },
  { id: "bolt", name: "Bolt" },
]

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

interface SettingsContextType {
  masterItems: MasterItem[]
  addItem: (name: string) => MasterItem
  removeItem: (id: string) => void
  renameItem: (id: string, name: string) => void
  masterTypes: MasterTypeConfig[]
  addMasterType: (config: Omit<MasterTypeConfig, "id">) => MasterTypeConfig
  updateMasterType: (id: string, updates: Partial<Omit<MasterTypeConfig, "id">>) => void
  removeMasterType: (id: string) => void
  pdfConfig: PdfConfig
  updatePdfConfig: (updates: Partial<PdfConfig>) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const SAVE_DEBOUNCE_MS = 500

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [masterItems, setMasterItems] = useState<MasterItem[]>(DEFAULT_ITEMS)
  const [masterTypes, setMasterTypes] = useState<MasterTypeConfig[]>([])
  const [pdfConfig, setPdfConfig] = useState<PdfConfig>(DEFAULT_PDF_CONFIG)
  const [loaded, setLoaded] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch settings from API on mount
  useEffect(() => {
    let cancelled = false
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          const data = await res.json()
          if (cancelled) return
          if (data.masterItems?.length) setMasterItems(data.masterItems)
          if (data.masterTypes) setMasterTypes(data.masterTypes)
          if (data.pdfConfig) setPdfConfig({ ...DEFAULT_PDF_CONFIG, ...data.pdfConfig })
        }
      } catch {
        /* use defaults on error */
      }
      if (!cancelled) setLoaded(true)
    }
    fetchSettings()
    return () => { cancelled = true }
  }, [])

  // Debounced save to API whenever settings change
  useEffect(() => {
    if (!loaded) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterItems, masterTypes, pdfConfig }),
      }).catch(() => { /* silent */ })
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [masterItems, masterTypes, pdfConfig, loaded])

  const addItem = useCallback((name: string): MasterItem => {
    const item: MasterItem = { id: generateId(), name: name.trim() }
    setMasterItems((prev) => [...prev, item])
    return item
  }, [])

  const removeItem = useCallback((id: string) => {
    setMasterItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const renameItem = useCallback((id: string, name: string) => {
    setMasterItems((prev) => prev.map((i) => i.id === id ? { ...i, name: name.trim() } : i))
  }, [])

  const addMasterType = useCallback((config: Omit<MasterTypeConfig, "id">): MasterTypeConfig => {
    const mt: MasterTypeConfig = { ...config, id: generateId() }
    setMasterTypes((prev) => [...prev, mt])
    return mt
  }, [])

  const updateMasterType = useCallback((id: string, updates: Partial<Omit<MasterTypeConfig, "id">>) => {
    setMasterTypes((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t))
  }, [])

  const removeMasterType = useCallback((id: string) => {
    setMasterTypes((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updatePdfConfig = useCallback((updates: Partial<PdfConfig>) => {
    setPdfConfig((prev) => ({ ...prev, ...updates }))
  }, [])

  return (
    <SettingsContext.Provider value={{
      masterItems, addItem, removeItem, renameItem,
      masterTypes, addMasterType, updateMasterType, removeMasterType,
      pdfConfig, updatePdfConfig,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error("useSettings must be used within SettingsProvider")
  return context
}
