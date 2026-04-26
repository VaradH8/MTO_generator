"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useProjects } from "@/context/ProjectContext"
import { useSupportContext } from "@/context/SupportContext"
import { useProjectTables } from "@/context/ProjectTableContext"
import { useAuth } from "@/context/AuthContext"
import { useSettings } from "@/context/SettingsContext"
import { generateCombinedPDF, generateSelectionPDF } from "@/lib/generatePDF"
import { parseMappingFile, computeMappedTotal } from "@/lib/parseMapping"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"
import SupportTable from "@/components/SupportTable"
import { LENGTH_KEYS } from "@/types/support"
import type { SupportRow, LengthKey, GroupedSupports, SupportTypeConfig, TypeMapping } from "@/types/support"

interface PdfVersion {
  id: string
  generatedAt: string
  generatedBy: string
  label: string
  rowCount: number
  typeCount: number
}

function groupByType(rows: SupportRow[]): GroupedSupports {
  const grouped: GroupedSupports = {}
  for (const r of rows) {
    const t = r.type || "Unknown"
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(r)
  }
  return grouped
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { projects, updateProject, getTypeConfigs } = useProjects()
  const { getProjectTable, saveProjectTable } = useProjectTables()
  const { user } = useAuth()
  const { pdfConfig } = useSettings()
  const pdfLogos = useMemo(() => ({
    left: pdfConfig.leftLogoDataUrl || undefined,
    right: pdfConfig.rightLogoDataUrl || undefined,
  }), [pdfConfig.leftLogoDataUrl, pdfConfig.rightLogoDataUrl])
  const mappingFileRef = useRef<HTMLInputElement>(null)
  const [mappingUploadMsg, setMappingUploadMsg] = useState("")

  const handleMappingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !params.id) return
    try {
      const mapping = await parseMappingFile(file)
      const count = Object.keys(mapping).length
      if (count === 0) {
        setMappingUploadMsg("No type mappings found in the file.")
        return
      }
      updateProject(String(params.id), { mapping })
      setMappingUploadMsg(`✓ Uploaded mapping for ${count} types.`)
      setTimeout(() => setMappingUploadMsg(""), 4000)
    } catch {
      setMappingUploadMsg("Failed to parse mapping file.")
    }
  }
  const { currentProjectName } = useSupportContext()

  const project = projects.find((p) => p.id === params.id)
  const projectId = String(params.id)
  const projectName = project?.clientName || currentProjectName || ""
  const typeConfigs = useMemo(() => (projectId ? getTypeConfigs(projectId) : []), [projectId, getTypeConfigs])
  const projectMapping = useMemo<Record<string, TypeMapping>>(
    () => (project?.mapping as Record<string, TypeMapping>) || {},
    [project?.mapping],
  )

  // Persisted table snapshot for this project — survives navigation / reload.
  const snapshot = getProjectTable(projectId)
  const tableRows = snapshot?.rows ?? []
  const groupedSupports = useMemo<GroupedSupports>(
    () => (snapshot ? groupByType(snapshot.rows) : {}),
    [snapshot],
  )
  const hasPdfs = tableRows.length > 0
  const pdfTypes = hasPdfs ? Object.entries(groupedSupports) : []

  const [combinedStatus, setCombinedStatus] = useState<"ready" | "downloading" | "error">("ready")
  const [selectionStatus, setSelectionStatus] = useState<"ready" | "downloading" | "error">("ready")
  const [showTable, setShowTable] = useState(true)

  // Classification filter for Combined PDF generation. Rows uploaded as
  // "internal" are included only under internal/all; external only under
  // external/all. Legacy rows without a classification tag fall back to
  // "internal" so they still appear in sensible places.
  type CombinedFilter = "all" | "internal" | "external"
  const [combinedFilter, setCombinedFilter] = useState<CombinedFilter>("all")

  const rowClassification = useCallback(
    (r: SupportRow) => (r.classification || "internal"),
    [],
  )
  const filterRows = useCallback((rows: SupportRow[], filter: CombinedFilter) => {
    if (filter === "all") return rows
    return rows.filter((r) => rowClassification(r) === filter)
  }, [rowClassification])
  const filterConfigs = useCallback((cfg: SupportTypeConfig[], filter: CombinedFilter) => {
    if (filter === "all") return cfg
    return cfg.filter((t) => (t.classification || "internal") === filter)
  }, [])

  // History of every Combined PDF generation, newest first. Fetched from the
  // server so it survives reloads and shows up for every user.
  const [pdfVersions, setPdfVersions] = useState<PdfVersion[]>([])
  const [versionDownloading, setVersionDownloading] = useState<string | null>(null)

  const refreshVersions = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/projects/${projectId}/pdf-versions`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data?.versions)) setPdfVersions(data.versions)
    } catch { /* offline — leave list as-is */ }
  }, [projectId])

  useEffect(() => { refreshVersions() }, [refreshVersions])

  // Row selection comes from two independent sources that are unioned:
  //   • checkboxes (`selectedRows`)
  //   • cell-range via shift-click / click-drag (`cellSelectionRows`)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [cellSelectionRows, setCellSelectionRows] = useState<Set<number>>(new Set())
  const effectiveSelection = useMemo(() => {
    const s = new Set<number>(selectedRows)
    for (const r of cellSelectionRows) s.add(r)
    return s
  }, [selectedRows, cellSelectionRows])

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadCombined = async () => {
    if (!hasPdfs) return
    setCombinedStatus("downloading")
    try {
      const filteredRows = filterRows(tableRows, combinedFilter)
      if (filteredRows.length === 0) {
        setCombinedStatus("error")
        return
      }
      const filteredConfigs = filterConfigs(typeConfigs, combinedFilter)
      const blob = await generateCombinedPDF(groupByType(filteredRows), projectName, filteredConfigs, pdfLogos, projectMapping)
      const base = (projectName || "project").replace(/[^a-zA-Z0-9]/g, "_")
      const suffix = combinedFilter === "all" ? "combined" : combinedFilter
      triggerDownload(blob, `${base}_${suffix}.pdf`)

      // Record this generation as a new version so it shows up in history.
      // Fire-and-forget: the download already succeeded — don't block on write.
      fetch(`/api/projects/${projectId}/pdf-versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: filteredRows,
          typeConfigs: filteredConfigs,
          generatedBy: user?.username || "unknown",
          label: combinedFilter === "all" ? "All" : combinedFilter === "internal" ? "Internal" : "External",
        }),
      })
        .then((res) => res.ok ? refreshVersions() : null)
        .catch(() => { /* best-effort */ })

      setCombinedStatus("ready")
    } catch {
      setCombinedStatus("error")
    }
  }

  const handleDownloadVersion = async (version: PdfVersion) => {
    setVersionDownloading(version.id)
    try {
      const res = await fetch(`/api/projects/${projectId}/pdf-versions/${version.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const rows: SupportRow[] = Array.isArray(data.rows) ? data.rows : []
      const cfg: SupportTypeConfig[] = Array.isArray(data.typeConfigs) ? data.typeConfigs : typeConfigs
      const blob = await generateCombinedPDF(groupByType(rows), projectName, cfg, pdfLogos, projectMapping)
      const base = (projectName || "project").replace(/[^a-zA-Z0-9]/g, "_")
      const ts = new Date(version.generatedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19)
      triggerDownload(blob, `${base}_combined_${ts}.pdf`)
    } catch (err) {
      console.error("Failed to regenerate version:", err)
    } finally {
      setVersionDownloading(null)
    }
  }

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pdf-versions/${versionId}`, { method: "DELETE" })
      if (res.ok) setPdfVersions((prev) => prev.filter((v) => v.id !== versionId))
    } catch { /* ignore */ }
  }

  const handleDownloadSelection = async () => {
    if (effectiveSelection.size === 0) return
    setSelectionStatus("downloading")
    try {
      const selRows = tableRows.filter((r) => effectiveSelection.has(r._rowIndex))
      const blob = await generateSelectionPDF(selRows, projectName, typeConfigs, pdfLogos, projectMapping)
      const base = (projectName || "project").replace(/[^a-zA-Z0-9]/g, "_")
      triggerDownload(blob, `${base}_selected_${selRows.length}.pdf`)
      setSelectionStatus("ready")
    } catch {
      setSelectionStatus("error")
    }
  }

  // Editing the persisted table — saved through ProjectTableContext (server
  // + localStorage cache). DB upload records are untouched.
  const handleCellEdit = useCallback((rowIndex: number, colKey: string, value: string | number) => {
    if (!snapshot) return
    const stringVal = String(value)
    const updated = snapshot.rows.map((row) => {
      if (row._rowIndex !== rowIndex) return row
      const next: SupportRow = {
        ...row,
        lengths: { ...row.lengths },
        itemQtys: { ...row.itemQtys },
      }
      if (colKey.startsWith("lengths.")) {
        const sub = colKey.slice("lengths.".length) as LengthKey
        next.lengths[sub] = stringVal
        next.total = computeMappedTotal(next.lengths, projectMapping[next.type])
      } else if (colKey.startsWith("item:")) {
        const rest = colKey.slice("item:".length)
        const [itemName, variantLabel = ""] = rest.split("::")
        const cur = { ...(next.itemQtys[itemName] || {}) }
        cur[variantLabel] = stringVal
        next.itemQtys[itemName] = cur
      } else {
        ;(next as unknown as Record<string, string>)[colKey] = stringVal
      }
      next._missingFields = next._missingFields.filter((f) => f !== colKey)
      next._hasErrors = next._missingFields.some((f) => ["tagNumber", "type"].includes(f))
      return next
    })
    saveProjectTable(projectId, updated)
  }, [snapshot, projectId, saveProjectTable])

  const handleRowsChange = useCallback((newRows: SupportRow[]) => {
    saveProjectTable(projectId, newRows)
  }, [projectId, saveProjectTable])

  const toggleRowSelect = useCallback((idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }, [])

  // AutoCAD Run popup state
  const [showRunPopup, setShowRunPopup] = useState(false)
  const [inputDwg, setInputDwg] = useState("")
  const [outputDwg, setOutputDwg] = useState("")
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ type: string; success: boolean; message: string }[]>([])
  const [bridgeStatus, setBridgeStatus] = useState<"unknown" | "connected" | "disconnected">("unknown")

  // Upload comparison state
  const [showComparison, setShowComparison] = useState(false)

  if (!project) {
    return <EmptyState title="Project not found" message="This project doesn't exist." action={{ label: "Go to Projects", onClick: () => router.push("/projects") }} />
  }

  const uploads = project.uploads || []
  const activity = (project.activityLog || []).slice().reverse()
  const types = project.supportTypes || []

  // Stats
  const allKeys = new Set<string>()
  const internalKeys = new Set<string>()
  const externalKeys = new Set<string>()
  let totalRevisions = 0
  for (const u of uploads) {
    for (const k of (u.supportKeys || [])) {
      allKeys.add(k)
      if (u.classification === "external") externalKeys.add(k)
      else internalKeys.add(k)
    }
    totalRevisions += u.revisions || 0
  }
  const internalCount = internalKeys.size
  const externalCount = externalKeys.size
  const typeCount: Record<string, number> = {}
  for (const u of uploads) { for (const t of u.types) { typeCount[t] = (typeCount[t] || 0) + 1 } }

  // Auto-detect types from uploaded Excel data (read-only, user can't change)
  const detectedTypes = Object.keys(typeCount)

  const checkBridgeHealth = async () => {
    try {
      const res = await fetch("/api/autocad?action=health")
      const data = await res.json()
      setBridgeStatus(data.connected ? "connected" : "disconnected")
    } catch {
      setBridgeStatus("disconnected")
    }
  }

  const handleRunConfirm = async () => {
    if (detectedTypes.length === 0 || !inputDwg.trim() || !outputDwg.trim()) return
    setRunning(true)
    setRunResult([])

    const results: typeof runResult = []

    for (const supportType of detectedTypes) {
      try {
        const res = await fetch("/api/autocad?action=extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceDwgPath: inputDwg,
            supportType,
            outputDirectory: outputDwg,
          }),
        })
        const data = await res.json()
        results.push({
          type: supportType,
          success: data.success ?? res.ok,
          message: data.message || (res.ok ? "Extracted successfully" : "Extraction failed"),
        })
      } catch (err) {
        results.push({
          type: supportType,
          success: false,
          message: err instanceof Error ? err.message : "Connection failed",
        })
      }
    }

    setRunResult(results)
    setRunning(false)
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-md)",
  }
  const statStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)",
    boxShadow: "var(--shadow-sm)", flex: "1 1 0", minWidth: 100,
  }
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 var(--space-3)",
    fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)",
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)", outline: "none",
  }
  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: "var(--font-display)", fontSize: "0.75rem",
    fontWeight: 500, color: "var(--color-text-muted)", textTransform: "uppercase",
    letterSpacing: "0.02em", marginBottom: "var(--space-1)",
  }

  return (
    <div>
      <button onClick={() => router.push("/projects")} style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Projects
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{project.clientName}</h1>
        <StatusBadge variant="info">{types.length} types</StatusBadge>
        <StatusBadge variant="info">{uploads.length} uploads</StatusBadge>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
        Created by {project.createdBy} on {new Date(project.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <ActionButton variant="primary" onClick={() => router.push(`/upload?project=${project.id}`)}>Upload Excel</ActionButton>
        <ActionButton variant="secondary" onClick={() => { setShowRunPopup(true); setRunResult([]); checkBridgeHealth() }}
          iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l8 5-8 5V3z" fill="currentColor" /></svg>}
        >
          Run AutoCAD
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push("/projects")}>Configure Types</ActionButton>
        <ActionButton variant="secondary" onClick={() => mappingFileRef.current?.click()}
          iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3h10v10H3V3zm2 2v2h6V5H5zm0 4v2h6V9H5z" fill="currentColor" /></svg>}
        >
          {project.mapping && Object.keys(project.mapping).length > 0 ? `Mapping (${Object.keys(project.mapping).length} types)` : "Upload Mapping"}
        </ActionButton>
        <input ref={mappingFileRef} type="file" accept=".xlsx,.xls" onChange={handleMappingUpload} style={{ display: "none" }} />
        <ActionButton variant="secondary" onClick={() => {
          const done = allKeys.size
          const range = project.supportRange || 0
          const remaining = range > 0 ? Math.max(0, range - done) : 0
          const lines: string[] = [
            "Project Report",
            `Project Name,${project.clientName}`,
            `Created By,${project.createdBy}`,
            `Created At,${new Date(project.createdAt).toLocaleDateString()}`,
            `Report Date,${new Date().toLocaleDateString()}`,
            "",
            "Summary",
            `Total Supports Done,${done}`,
            `Remaining,${remaining}`,
            `Total Range,${range}`,
            `Internal Supports,${internalCount}`,
            `External Supports,${externalCount}`,
            "",
            "Type Breakdown",
            "Type,Upload Count",
            ...Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t},${c}`),
            "",
            "Upload History",
            "Upload #,Date,File,Rows,New,Revisions",
            ...uploads.map((u, i) => [
              i + 1,
              new Date(u.uploadedAt).toLocaleDateString(),
              `"${u.fileName}"`,
              u.rowCount,
              u.newSupports ?? 0,
              u.revisions ?? 0,
            ].join(",")),
          ]
          const csv = lines.join("\n")
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `${project.clientName.replace(/[^a-zA-Z0-9]/g, "_")}_report.csv`
          link.click()
          URL.revokeObjectURL(url)
        }}
          iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        >Export Report</ActionButton>
      </div>

      {mappingUploadMsg && (
        <div className="animate-fade-in-down" style={{ padding: "var(--space-2) var(--space-4)", marginBottom: "var(--space-4)", background: mappingUploadMsg.startsWith("✓") ? "var(--color-success-soft)" : "var(--color-warning-soft)", borderLeft: `3px solid ${mappingUploadMsg.startsWith("✓") ? "var(--color-success)" : "var(--color-warning)"}`, borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text)" }}>
          {mappingUploadMsg}
        </div>
      )}

      {/* Generated PDF — pinned at the top so it is visible on every reopen. */}
      {(hasPdfs || pdfVersions.length > 0) && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)" }}>
              Generated PDFs
            </h2>
            {pdfVersions.length > 0 && (
              <StatusBadge variant="info">{pdfVersions.length} version{pdfVersions.length !== 1 ? "s" : ""}</StatusBadge>
            )}
          </div>

          {/* Action row — generates a new version from the current table. */}
          {hasPdfs && (() => {
            const filteredPreview = filterRows(tableRows, combinedFilter)
            const filteredTypes = new Set(filteredPreview.map((r) => r.type).filter(Boolean))
            const filterLabel = combinedFilter === "all" ? "All" : combinedFilter === "internal" ? "Internal" : "External"
            return (
              <div style={{
                padding: "var(--space-4)",
                background: "var(--color-primary-soft)",
                border: "1px solid var(--color-primary)",
                borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-4)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--color-primary)" }}>
                      Generate New Combined PDF
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                      {filterLabel} · {filteredTypes.size} type{filteredTypes.size !== 1 ? "s" : ""} · {filteredPreview.length} support{filteredPreview.length !== 1 ? "s" : ""}
                      {snapshot?.updatedAt && <> · Table last updated {new Date(snapshot.updatedAt).toLocaleString()}</>}
                    </div>
                  </div>
                  <StatusBadge variant="info">{filteredPreview.length} rows</StatusBadge>
                  <ActionButton
                    variant="primary"
                    size="sm"
                    loading={combinedStatus === "downloading"}
                    disabled={filteredPreview.length === 0}
                    onClick={handleDownloadCombined}
                  >
                    {combinedStatus === "downloading" ? "Generating..." : combinedStatus === "error" ? "Retry" : "Generate & Download"}
                  </ActionButton>
                </div>

                {/* Classification picker — decides which rows + configs the PDF includes. */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    Include
                  </span>
                  {(["all", "internal", "external"] as const).map((opt) => {
                    const active = combinedFilter === opt
                    const label = opt === "all" ? "All" : opt === "internal" ? "Internal only" : "External only"
                    return (
                      <label
                        key={opt}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 10px",
                          background: active ? "var(--color-primary)" : "var(--color-surface)",
                          color: active ? "#fff" : "var(--color-text)",
                          border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name={`combinedFilter-${projectId}`}
                          value={opt}
                          checked={active}
                          onChange={() => setCombinedFilter(opt)}
                          style={{ accentColor: "var(--color-primary)", margin: 0 }}
                        />
                        {label}
                      </label>
                    )
                  })}
                  {filteredPreview.length === 0 && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-warning)" }}>
                      No rows tagged as {combinedFilter}. Upload an Excel with this classification first.
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

          {/* History — every Combined PDF ever generated for this project. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              History
            </div>
            {pdfVersions.length === 0 ? (
              <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-faint)", padding: "var(--space-3) 0" }}>
                No combined PDFs generated yet. Click <strong>Generate & Download</strong> to create the first version.
              </div>
            ) : (
              pdfVersions.map((v, idx) => (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--color-surface-2)",
                  borderRadius: "var(--radius-md)",
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", minWidth: 28 }}>
                    #{pdfVersions.length - idx}
                  </span>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)" }}>
                        {new Date(v.generatedAt).toLocaleString()}
                      </span>
                      {v.label && (
                        <StatusBadge variant={v.label.toLowerCase().startsWith("ext") ? "warning" : "info"}>{v.label}</StatusBadge>
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                      by {v.generatedBy} · {v.rowCount} supports · {v.typeCount} type{v.typeCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    loading={versionDownloading === v.id}
                    onClick={() => handleDownloadVersion(v)}
                  >
                    {versionDownloading === v.id ? "Preparing..." : "Download"}
                  </ActionButton>
                  <ActionButton variant="ghost" size="sm" onClick={() => handleDeleteVersion(v.id)}>
                    Delete
                  </ActionButton>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      {(() => {
        const done = allKeys.size
        const range = project.supportRange || 0
        const remaining = range > 0 ? Math.max(0, range - done) : 0
        const pct = range > 0 ? Math.min(100, Math.round((done / range) * 100)) : 0
        return (
          <>
            <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-success)" }}>{done}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Done</div>
              </div>
              {internalCount > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>{internalCount}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Internal</div>
                </div>
              )}
              {externalCount > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-warning)" }}>{externalCount}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>External</div>
                </div>
              )}
              {range > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-warning)" }}>{remaining}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Remaining</div>
                </div>
              )}
              {range > 0 && (
                <div style={statStyle}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>{range}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Total Range</div>
                </div>
              )}
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{uploads.length}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Uploads</div>
              </div>
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-warning)" }}>{totalRevisions}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Revisions</div>
              </div>
              <div style={statStyle}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)" }}>{Object.keys(typeCount).length}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Types Used</div>
              </div>
            </div>
            {range > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
                <div style={{ flex: 1, height: 8, background: "var(--color-surface-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--color-success)" : "var(--color-primary)", borderRadius: 4, transition: "width 0.5s ease-out" }} />
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text)" }}>{pct}%</span>
              </div>
            )}
          </>
        )
      })()}

      {/* Type breakdown bar chart */}
      {Object.keys(typeCount).length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Support Types</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const maxCount = Math.max(...Object.values(typeCount))
              const pct = (count / maxCount) * 100
              return (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", minWidth: 50 }}>{type}</span>
                  <div style={{ flex: 1, height: 20, background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-primary)", borderRadius: "var(--radius-sm)", transition: "width 0.5s ease-out" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 20, textAlign: "right" }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Data Table — persistent per-project. Edits save locally; DB uploads are untouched. */}
      {hasPdfs && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)" }}>Data Table</h2>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                Edit cells, regenerate PDFs, or click + shift-click to select rows.
                {snapshot?.updatedAt && <> Last edited {new Date(snapshot.updatedAt).toLocaleString()}.</>}
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <ActionButton variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Hide Table" : "Show Table"}
              </ActionButton>
            </div>
          </div>

          {showTable && (
            <>
              {/* Selection bar — shown whenever any rows are selected via either method */}
              {effectiveSelection.size > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-3)",
                  background: "var(--color-primary-soft)",
                  borderLeft: "3px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-primary)" }}>
                    {effectiveSelection.size} row{effectiveSelection.size !== 1 ? "s" : ""} selected
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    Tip: click a cell then shift-click another cell in the same column to select everything between.
                  </span>
                  <div style={{ flex: 1 }} />
                  <ActionButton
                    variant="primary"
                    size="sm"
                    loading={selectionStatus === "downloading"}
                    onClick={handleDownloadSelection}
                  >
                    {selectionStatus === "downloading" ? "Generating..." : selectionStatus === "error" ? "Retry" : "Generate PDF from Selection"}
                  </ActionButton>
                  <ActionButton variant="ghost" size="sm" onClick={() => { setSelectedRows(new Set()); setCellSelectionRows(new Set()) }}>
                    Clear
                  </ActionButton>
                </div>
              )}

              <SupportTable
                rows={tableRows}
                typeConfigs={typeConfigs}
                projectMapping={projectMapping}
                onCellEdit={handleCellEdit}
                onRowsChange={handleRowsChange}
                selectedRows={selectedRows}
                onRowSelect={toggleRowSelect}
                onCellSelectionChange={setCellSelectionRows}
              />
            </>
          )}
        </div>
      )}

      {/* Upload History */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)" }}>Upload History</h2>
          {uploads.length >= 2 && (
            <ActionButton variant="secondary" size="sm" onClick={() => setShowComparison((v) => !v)}>
              {showComparison ? "Hide Comparison" : "Compare Last 2"}
            </ActionButton>
          )}
        </div>
        {uploads.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-4)" }}>No uploads yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {uploads.map((u, idx) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", minWidth: 25 }}>#{idx + 1}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 130 }}>{new Date(u.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", flex: 1 }}>{u.fileName}</span>
                <StatusBadge variant="info">{u.rowCount} rows</StatusBadge>
                {(u.newSupports ?? 0) > 0 && <StatusBadge variant="success">{u.newSupports} new</StatusBadge>}
                {(u.revisions ?? 0) > 0 && <StatusBadge variant="warning">{u.revisions} revisions</StatusBadge>}
              </div>
            ))}
          </div>
        )}
        {/* Upload Comparison */}
        {showComparison && uploads.length >= 2 && (() => {
          const prev = uploads[uploads.length - 2]
          const latest = uploads[uploads.length - 1]
          const prevKeys = new Set(prev.supportKeys || [])
          const latestKeys = new Set(latest.supportKeys || [])
          const newKeys = Array.from(latestKeys).filter((k) => !prevKeys.has(k))
          const commonKeys = Array.from(latestKeys).filter((k) => prevKeys.has(k))
          const removedKeys = Array.from(prevKeys).filter((k) => !latestKeys.has(k))
          return (
            <div style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-3)" }}>
                Comparison: Upload #{uploads.length - 1} vs #{uploads.length}
              </h3>
              <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
                <div>
                  <StatusBadge variant="success">{newKeys.length} new</StatusBadge>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginLeft: "var(--space-1)" }}>support keys added</span>
                </div>
                <div>
                  <StatusBadge variant="warning">{commonKeys.length} common</StatusBadge>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginLeft: "var(--space-1)" }}>support keys (revisions)</span>
                </div>
                <div>
                  <StatusBadge variant="error">{removedKeys.length} removed</StatusBadge>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginLeft: "var(--space-1)" }}>not in latest upload</span>
                </div>
              </div>
              {newKeys.length > 0 && (
                <div style={{ marginBottom: "var(--space-2)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-success)", textTransform: "uppercase" }}>New keys: </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{newKeys.slice(0, 20).join(", ")}{newKeys.length > 20 ? "..." : ""}</span>
                </div>
              )}
              {commonKeys.length > 0 && (
                <div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-warning)", textTransform: "uppercase" }}>Common keys: </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>{commonKeys.slice(0, 20).join(", ")}{commonKeys.length > 20 ? "..." : ""}</span>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Activity Log */}
      {activity.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)" }}>Activity Log</h2>
            <ActionButton variant="secondary" size="sm" onClick={() => {
              const csvHeader = "Date,Action,Detail,User"
              const csvRows = activity.map((a) => {
                const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
                return [
                  escape(new Date(a.timestamp).toLocaleString()),
                  escape(a.action),
                  escape(a.detail),
                  escape(a.user),
                ].join(",")
              })
              const csv = [csvHeader, ...csvRows].join("\n")
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `${project.clientName.replace(/[^a-zA-Z0-9]/g, "_")}_activity_log.csv`
              link.click()
              URL.revokeObjectURL(url)
            }}
              iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            >Download CSV</ActionButton>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {activity.slice(0, 20).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", fontSize: "0.8125rem" }}>
                <span style={{ fontFamily: "var(--font-body)", color: "var(--color-text-faint)", minWidth: 80 }}>{new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <StatusBadge variant={a.action === "approve" ? "success" : a.action === "reject" ? "error" : "info"}>{a.action}</StatusBadge>
                <span style={{ fontFamily: "var(--font-body)", color: "var(--color-text-muted)" }}>{a.detail}</span>
                <span style={{ fontFamily: "var(--font-body)", color: "var(--color-text-faint)", marginLeft: "auto" }}>{a.user}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── AutoCAD Run Popup ─── */}
      {showRunPopup && (
        <div
          className="animate-fade-in"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
          onClick={() => !running && setShowRunPopup(false)}
        >
          <div
            className="animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)", borderRadius: "var(--radius-lg)",
              padding: "var(--space-8)", boxShadow: "var(--shadow-xl)",
              maxWidth: 520, width: "90%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)" }}>
                Run AutoCAD Plugin
              </h2>
              <StatusBadge variant={bridgeStatus === "connected" ? "success" : bridgeStatus === "disconnected" ? "error" : "info"}>
                {bridgeStatus === "connected" ? "Connected" : bridgeStatus === "disconnected" ? "Disconnected" : "Unknown"}
              </StatusBadge>
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
              Extract support drawings from source DWG. Types are auto-detected from your Excel uploads.
            </p>

            {/* Input DWG file path */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={labelStyle}>Source DWG File Path (on AutoCAD server)</label>
              <input
                value={inputDwg}
                onChange={(e) => setInputDwg(e.target.value)}
                placeholder="e.g. D:\drawings\supports.dwg"
                style={inputStyle}
              />
            </div>

            {/* Output DWG folder path */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={labelStyle}>Output Folder Path (on AutoCAD server)</label>
              <input
                value={outputDwg}
                onChange={(e) => setOutputDwg(e.target.value)}
                placeholder="e.g. D:\output\extracted"
                style={inputStyle}
              />
            </div>

            {/* Detected types — read only */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label style={labelStyle}>Support Types (auto-detected from Excel)</label>
              {detectedTypes.length === 0 ? (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-warning)" }}>
                  No types detected. Upload an Excel file first.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {detectedTypes.map((t) => (
                    <span key={t} style={{
                      padding: "var(--space-1) var(--space-3)",
                      background: "var(--color-primary-soft)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: "var(--radius-md)",
                      fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600,
                      color: "var(--color-primary)",
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Results */}
            {runResult.length > 0 && (
              <div style={{ marginBottom: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {runResult.map((r) => (
                  <div key={r.type} style={{
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-3)",
                    background: r.success ? "var(--color-success-soft)" : "var(--color-error-soft)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${r.success ? "var(--color-success)" : "var(--color-error)"}`,
                    fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                  }}>
                    <StatusBadge variant={r.success ? "success" : "error"}>{r.type}</StatusBadge>
                    <span style={{ color: "var(--color-text-muted)" }}>{r.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <ActionButton variant="ghost" onClick={() => { setShowRunPopup(false); setRunResult([]) }} disabled={running}>
                {runResult.length > 0 ? "Close" : "Cancel"}
              </ActionButton>
              <ActionButton
                variant="primary"
                loading={running}
                disabled={!inputDwg.trim() || !outputDwg.trim() || detectedTypes.length === 0}
                onClick={handleRunConfirm}
                iconLeft={!running ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l8 5-8 5V3z" fill="currentColor" /></svg> : undefined}
              >
                {running ? `Extracting ${detectedTypes.length} types...` : `Run for ${detectedTypes.length} type${detectedTypes.length !== 1 ? "s" : ""}`}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
