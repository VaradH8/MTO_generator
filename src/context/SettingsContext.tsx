"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { MasterItem, MasterTypeConfig, MasterTypeItem } from "@/types/support"

const STORAGE_KEY = "spg_settings"

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
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [masterItems, setMasterItems] = useState<MasterItem[]>(DEFAULT_ITEMS)
  const [masterTypes, setMasterTypes] = useState<MasterTypeConfig[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.masterItems?.length) setMasterItems(data.masterItems)
        if (data.masterTypes) setMasterTypes(data.masterTypes)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ masterItems, masterTypes }))
    }
  }, [masterItems, masterTypes, loaded])

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

  return (
    <SettingsContext.Provider value={{
      masterItems, addItem, removeItem, renameItem,
      masterTypes, addMasterType, updateMasterType, removeMasterType,
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
