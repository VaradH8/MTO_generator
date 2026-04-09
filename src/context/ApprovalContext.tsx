"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { PdfApproval } from "@/types/support"

const STORAGE_KEY = "spg_approvals"

interface ApprovalContextType {
  approvals: PdfApproval[]
  pendingCount: number
  submitForApproval: (approval: Omit<PdfApproval, "id" | "generatedAt" | "status">) => void
  approve: (id: string, reviewerName: string) => void
  reject: (id: string, reviewerName: string) => void
}

const ApprovalContext = createContext<ApprovalContextType | undefined>(undefined)

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const [approvals, setApprovals] = useState<PdfApproval[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setApprovals(JSON.parse(raw))
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(approvals))
  }, [approvals, loaded])

  const pendingCount = approvals.filter((a) => a.status === "pending").length

  const submitForApproval = useCallback((partial: Omit<PdfApproval, "id" | "generatedAt" | "status">) => {
    const approval: PdfApproval = {
      ...partial,
      id: generateId(),
      generatedAt: new Date().toISOString(),
      status: "pending",
    }
    setApprovals((prev) => [...prev, approval])
  }, [])

  const approve = useCallback((id: string, reviewerName: string) => {
    setApprovals((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: "approved" as const, reviewedBy: reviewerName, reviewedAt: new Date().toISOString() } : a)
    )
  }, [])

  const reject = useCallback((id: string, reviewerName: string) => {
    setApprovals((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: "rejected" as const, reviewedBy: reviewerName, reviewedAt: new Date().toISOString() } : a)
    )
  }, [])

  return (
    <ApprovalContext.Provider value={{ approvals, pendingCount, submitForApproval, approve, reject }}>
      {children}
    </ApprovalContext.Provider>
  )
}

export function useApprovals() {
  const context = useContext(ApprovalContext)
  if (!context) throw new Error("useApprovals must be used within ApprovalProvider")
  return context
}
