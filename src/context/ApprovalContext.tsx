"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import type { PdfApproval } from "@/types/support"

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

  // On mount, fetch approvals from the API
  useEffect(() => {
    fetch("/api/approvals")
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/approvals failed: ${res.status}`)
        return res.json()
      })
      .then((data: PdfApproval[]) => {
        setApprovals(data)
      })
      .catch((err) => {
        console.error("Failed to fetch approvals:", err)
      })
  }, [])

  const pendingCount = approvals.filter((a) => a.status === "pending").length

  const submitForApproval = useCallback((partial: Omit<PdfApproval, "id" | "generatedAt" | "status">) => {
    // Build an optimistic approval object
    const optimisticId = generateId()
    const optimistic: PdfApproval = {
      ...partial,
      id: optimisticId,
      generatedAt: new Date().toISOString(),
      status: "pending",
    }

    // Optimistic update
    setApprovals((prev) => [optimistic, ...prev])

    // Fire API call
    fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`POST /api/approvals failed: ${res.status}`)
        return res.json()
      })
      .then((created: PdfApproval) => {
        // Replace optimistic entry with server response
        setApprovals((prev) => prev.map((a) => (a.id === optimisticId ? created : a)))
      })
      .catch((err) => {
        console.error("Failed to submit approval:", err)
      })
  }, [])

  const approve = useCallback((id: string, reviewerName: string) => {
    // Optimistic update
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "approved" as const, reviewedBy: reviewerName, reviewedAt: new Date().toISOString() }
          : a
      )
    )

    // Fire API call
    fetch(`/api/approvals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", reviewerName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`PUT /api/approvals/${id} failed: ${res.status}`)
        return res.json()
      })
      .then((updated: PdfApproval) => {
        // Replace with server response
        setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)))
      })
      .catch((err) => {
        console.error("Failed to approve:", err)
      })
  }, [])

  const reject = useCallback((id: string, reviewerName: string) => {
    // Optimistic update
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "rejected" as const, reviewedBy: reviewerName, reviewedAt: new Date().toISOString() }
          : a
      )
    )

    // Fire API call
    fetch(`/api/approvals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", reviewerName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`PUT /api/approvals/${id} failed: ${res.status}`)
        return res.json()
      })
      .then((updated: PdfApproval) => {
        // Replace with server response
        setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)))
      })
      .catch((err) => {
        console.error("Failed to reject:", err)
      })
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
