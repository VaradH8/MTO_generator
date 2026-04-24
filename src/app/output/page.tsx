"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import TypeCard from "@/components/TypeCard"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"
import { useSupportContext } from "@/context/SupportContext"
import { useAuth } from "@/context/AuthContext"
import { useApprovals } from "@/context/ApprovalContext"
import { useProjects } from "@/context/ProjectContext"
import { useSettings } from "@/context/SettingsContext"
import { generatePDF } from "@/lib/generatePDF"
import { generateZip } from "@/lib/generateZip"

export default function OutputPage() {
  const router = useRouter()
  const {
    groupedSupports,
    validationResult,
    currentProjectId,
    currentProjectName,
    approvalSubmitted,
    loaded,
    setValidationResult,
    setGroupedSupports,
    setApprovalSubmitted,
  } = useSupportContext()
  const { user } = useAuth()
  const { submitForApproval } = useApprovals()
  const { getTypeConfigs } = useProjects()
  const { pdfConfig } = useSettings()
  const typeConfigs = currentProjectId ? getTypeConfigs(currentProjectId) : []
  const pdfLogos = { left: pdfConfig.leftLogoDataUrl || undefined, right: pdfConfig.rightLogoDataUrl || undefined }
  const [downloadStatus, setDownloadStatus] = useState<Record<string, "ready" | "downloading" | "error">>({})
  const [zipping, setZipping] = useState(false)

  // Submit for admin approval when page loads — gate on `loaded` so we don't
  // fire before localStorage is hydrated (which would cause duplicate submissions).
  useEffect(() => {
    if (!loaded || approvalSubmitted || !groupedSupports || !validationResult) return
    setApprovalSubmitted(true)

    const types: Record<string, number> = {}
    const supportKeys: string[] = []
    let totalCount = 0

    for (const [type, rows] of Object.entries(groupedSupports)) {
      types[type] = rows.length
      totalCount += rows.length
      for (const row of rows) {
        if (row.tagNumber) supportKeys.push(row.tagNumber)
      }
    }

    submitForApproval({
      projectId: currentProjectId,
      projectName: currentProjectName,
      generatedBy: user?.username || "unknown",
      supportCount: totalCount,
      types,
      supportKeys,
    })
  }, [loaded, approvalSubmitted, groupedSupports, validationResult, submitForApproval, user, currentProjectId, currentProjectName, setApprovalSubmitted])

  if (!groupedSupports || Object.keys(groupedSupports).length === 0) {
    return (
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-8)" }}>
          Download PDFs
        </h1>
        <EmptyState
          title="No PDFs available"
          message="Generate PDFs from the Review page first."
          action={{ label: "Go to Upload", onClick: () => router.push("/upload") }}
        />
      </div>
    )
  }

  const types = Object.entries(groupedSupports)

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = async (type: string) => {
    setDownloadStatus((s) => ({ ...s, [type]: "downloading" }))
    try {
      const rows = groupedSupports[type]
      const blob = await generatePDF(type, rows, currentProjectName, typeConfigs, pdfLogos)
      triggerDownload(blob, `${type}-supports.pdf`)
      setDownloadStatus((s) => ({ ...s, [type]: "ready" }))
    } catch {
      setDownloadStatus((s) => ({ ...s, [type]: "error" }))
    }
  }

  const handleDownloadAll = async () => {
    setZipping(true)
    try {
      const pdfs = await Promise.all(
        types.map(async ([type, rows]) => ({
          name: `${type}-supports`,
          blob: await generatePDF(type, rows, currentProjectName, typeConfigs, pdfLogos),
        }))
      )
      const zipBlob = await generateZip(pdfs)
      triggerDownload(zipBlob, "support-pdfs.zip")
    } catch { /* silently */ }
    finally { setZipping(false) }
  }

  const handleStartOver = () => {
    setValidationResult(null)
    setGroupedSupports(null)
    setApprovalSubmitted(false)
    router.push("/upload")
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)", letterSpacing: "-0.01em" }}>
        PDFs Ready
      </h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
        {currentProjectName && <>Project: <strong>{currentProjectName}</strong> — </>}
        Download individual files or all at once.
      </p>

      {/* Approval status banner */}
      {approvalSubmitted && (
        <div className="animate-fade-in-down" style={{
          padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-6)",
          background: "var(--color-primary-soft)", borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--color-primary)",
          fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)",
          display: "flex", alignItems: "center", gap: "var(--space-3)",
        }}>
          <StatusBadge variant="warning">Pending Approval</StatusBadge>
          Submitted for admin review. Once approved, supports will be added to billing.
        </div>
      )}

      {/* Type Cards */}
      {types.map(([type, rows]) => (
        <TypeCard
          key={type}
          typeName={type}
          count={rows.length}
          status={downloadStatus[type] || "ready"}
          onDownload={() => handleDownloadPDF(type)}
        />
      ))}

      {/* Action Bar */}
      <div style={{
        display: "flex", gap: "var(--space-4)", justifyContent: "flex-end",
        marginTop: "var(--space-8)", paddingTop: "var(--space-6)",
        borderTop: "1px solid var(--color-border)", flexWrap: "wrap",
      }}>
        <ActionButton variant="secondary" onClick={handleStartOver}>Start Over</ActionButton>
        <ActionButton variant="primary" loading={zipping} onClick={handleDownloadAll}
          iconLeft={!zipping ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 7l4 4 4-4M2 12h12v2H2v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : undefined}
        >
          {zipping ? "Preparing ZIP..." : "Download All as ZIP"}
        </ActionButton>
      </div>
    </div>
  )
}
