"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import TypeCard from "@/components/TypeCard"
import ActionButton from "@/components/ActionButton"
import EmptyState from "@/components/EmptyState"
import { useSupportContext } from "@/context/SupportContext"
import { useBilling } from "@/context/BillingContext"
import { generatePDF } from "@/lib/generatePDF"
import { generateZip } from "@/lib/generateZip"

export default function OutputPage() {
  const router = useRouter()
  const { groupedSupports, validationResult, setValidationResult, setGroupedSupports } = useSupportContext()
  const { addEntry } = useBilling()
  const [downloadStatus, setDownloadStatus] = useState<Record<string, "ready" | "downloading" | "error">>({})
  const billingRecorded = useRef(false)

  // Record supports to billing when page loads (PDFs generated)
  useEffect(() => {
    if (billingRecorded.current || !groupedSupports || !validationResult) return
    billingRecorded.current = true

    const types: Record<string, number> = {}
    const supportKeys: string[] = []
    let totalCount = 0

    for (const [type, rows] of Object.entries(groupedSupports)) {
      types[type] = rows.length
      totalCount += rows.length
      for (const row of rows) {
        if (row.supportTagName) supportKeys.push(row.supportTagName)
      }
    }

    addEntry({
      fileName: "Excel Upload",
      supportCount: totalCount,
      supportKeys,
      types,
    })
  }, [groupedSupports, validationResult, addEntry])
  const [zipping, setZipping] = useState(false)

  if (!groupedSupports || Object.keys(groupedSupports).length === 0) {
    return (
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-8)",
          }}
        >
          Download PDFs
        </h1>
        <EmptyState
          title="No PDFs available"
          message="Generate PDFs from the Review page first."
          action={{ label: "Go to Upload", onClick: () => router.push("/") }}
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
      const blob = generatePDF(type, rows)
      triggerDownload(blob, `${type}-supports.pdf`)
      setDownloadStatus((s) => ({ ...s, [type]: "ready" }))
    } catch {
      setDownloadStatus((s) => ({ ...s, [type]: "error" }))
    }
  }

  const handleDownloadAll = async () => {
    setZipping(true)
    try {
      const pdfs = types.map(([type, rows]) => ({
        name: `${type}-supports`,
        blob: generatePDF(type, rows),
      }))
      const zipBlob = await generateZip(pdfs)
      triggerDownload(zipBlob, "support-pdfs.zip")
    } catch {
      // Error handled silently for now
    } finally {
      setZipping(false)
    }
  }

  const handleStartOver = () => {
    setValidationResult(null)
    setGroupedSupports(null)
    router.push("/")
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: "var(--space-2)",
          letterSpacing: "-0.01em",
        }}
      >
        PDFs Ready
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          color: "var(--color-text-muted)",
          marginBottom: "var(--space-8)",
        }}
      >
        Download individual files or all at once.
      </p>

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
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          justifyContent: "flex-end",
          marginTop: "var(--space-8)",
          paddingTop: "var(--space-6)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <ActionButton variant="secondary" onClick={handleStartOver}>
          Start Over
        </ActionButton>
        <ActionButton
          variant="primary"
          loading={zipping}
          onClick={handleDownloadAll}
          iconLeft={
            !zipping ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M4 7l4 4 4-4M2 12h12v2H2v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : undefined
          }
        >
          {zipping ? "Preparing ZIP..." : "Download All as ZIP"}
        </ActionButton>
      </div>
    </div>
  )
}
