"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import FileUploadZone from "@/components/FileUploadZone"
import ActionButton from "@/components/ActionButton"
import { parseExcelFile } from "@/lib/parseExcel"
import { useSupportContext } from "@/context/SupportContext"
import { useProjects } from "@/context/ProjectContext"
import * as XLSX from "xlsx"
import type { ParseResult, SupportRow, SupportTypeConfig } from "@/types/support"

type FileStatus = "idle" | "validating" | "valid" | "invalid"

const FIELD_LABELS: Record<string, string> = {
  supportTagName: "Support Tag Name",
  discipline: "Discipline", type: "Type",
  a: "A", b: "B", c: "C", d: "D",
  item01Name: "Item-01 Name", item02Name: "Item-02 Name", item03Name: "Item-03 Name",
  xGrid: "X-Grid", yGrid: "Y-Grid",
}

function calcTotal(row: SupportRow): string {
  const sum = (parseFloat(row.a) || 0) + (parseFloat(row.b) || 0) + (parseFloat(row.c) || 0) + (parseFloat(row.d) || 0)
  return sum % 1 === 0 ? String(sum) : sum.toFixed(2)
}

export default function UploadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setValidationResult, setGroupedSupports, setCurrentProject } = useSupportContext()
  const { projects, getTypeNames, getTypeConfigs, addUploadRecord } = useProjects()

  // Project from URL param or dropdown
  const urlProjectId = searchParams.get("project")
  const [dropdownProjectId, setDropdownProjectId] = useState("")
  const projectId = urlProjectId || dropdownProjectId
  const project = projects.find((p) => p.id === projectId) || null
  const fromProject = !!urlProjectId // came from project detail page

  const typeNames = projectId ? getTypeNames(projectId) : []
  const typeConfigs = projectId ? getTypeConfigs(projectId) : []
  const hasProjectTypes = typeNames.length > 0

  // File + parsing state
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<FileStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [missingValues, setMissingValues] = useState<Record<string, string>>({})
  const [selectedType, setSelectedType] = useState("")
  const [classification, setClassification] = useState<"internal" | "external">("internal")

  // Additional files for batch upload
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [additionalParseResults, setAdditionalParseResults] = useState<ParseResult[]>([])
  const [parsingAdditional, setParsingAdditional] = useState(false)

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<{ count: number; names: string[] } | null>(null)

  // Confirmation popup
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const handleDownloadTemplate = useCallback(() => {
    if (!project) return
    const baseColsBefore = ["Support Tag Name", "Discipline", "Type", "A", "B", "C", "D"]
    const itemCols: string[] = []
    for (const tc of typeConfigs) {
      for (const item of tc.items) {
        const nameCol = `${item.itemName} Name`
        const qtyCol = `${item.itemName} Qty`
        if (!itemCols.includes(nameCol)) itemCols.push(nameCol)
        if (!itemCols.includes(qtyCol)) itemCols.push(qtyCol)
      }
    }
    const baseColsAfter = ["X", "Y", "Z", "X-Grid", "Y-Grid", "Remarks"]
    const headers = [...baseColsBefore, ...itemCols, ...baseColsAfter]
    const ws = XLSX.utils.aoa_to_sheet([headers])
    // Set column widths
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    XLSX.writeFile(wb, `${project.clientName.replace(/[^a-zA-Z0-9]/g, "_")}_template.xlsx`)
  }, [project, typeConfigs])

  const handleFileSelect = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase()
    if (!ext || !["xlsx", "xls"].includes(ext)) {
      setFile(f)
      setStatus("invalid")
      setError("Invalid file type. Please upload .xlsx or .xls")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setFile(f)
      setStatus("invalid")
      setError("File exceeds 10 MB limit.")
      return
    }

    // Show confirmation popup
    setPendingFile(f)
    setShowConfirm(true)
  }

  const confirmUpload = () => {
    if (!pendingFile) return
    setFile(pendingFile)
    setStatus("valid")
    setError(null)
    setParseResult(null)
    setMissingValues({})
    setSelectedType("")
    setShowConfirm(false)
    setPendingFile(null)
  }

  const cancelUpload = () => {
    setShowConfirm(false)
    setPendingFile(null)
  }

  const handleFileRemove = () => {
    setFile(null)
    setStatus("idle")
    setError(null)
    setParseResult(null)
    setMissingValues({})
    setSelectedType("")
  }

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    try {
      const result = await parseExcelFile(file)
      setParseResult(result)
      const initial: Record<string, string> = {}
      for (const col of result.missingColumns) {
        if (col === "type" || col.startsWith("item0")) continue
        initial[col] = ""
      }
      setMissingValues(initial)

      // Check for duplicates against existing project uploads
      if (project) {
        const existingKeys = new Set<string>()
        for (const u of (project.uploads || [])) {
          for (const k of (u.supportKeys || [])) existingKeys.add(k)
        }
        const parsedKeys = result.validation.rows.map((r) => r.supportTagName).filter(Boolean)
        const dupes = parsedKeys.filter((k) => existingKeys.has(k))
        if (dupes.length > 0) {
          setDuplicateWarning({ count: dupes.length, names: dupes.slice(0, 10) })
        } else {
          setDuplicateWarning(null)
        }
      }

      // Parse additional files if any
      if (additionalFiles.length > 0) {
        setParsingAdditional(true)
        const extraResults: ParseResult[] = []
        for (const af of additionalFiles) {
          try {
            const extraResult = await parseExcelFile(af)
            extraResults.push(extraResult)
          } catch {
            // skip files that fail to parse
          }
        }
        setAdditionalParseResults(extraResults)
        setParsingAdditional(false)
      }
    } catch {
      setStatus("invalid")
      setError("Failed to parse file. Check that the sheet contains valid support data.")
    } finally {
      setParsing(false)
    }
  }

  const typeMissing = parseResult?.missingColumns.includes("type") ?? false

  const excelTypes = useMemo(() => {
    if (!parseResult) return []
    const types = new Set<string>()
    for (const row of parseResult.validation.rows) {
      if (row.type) types.add(row.type)
    }
    return Array.from(types).sort()
  }, [parseResult])

  const finalize = () => {
    if (!parseResult || !projectId) return
    const overrides: Record<string, string> = { ...missingValues }
    if (typeMissing && selectedType) overrides["type"] = selectedType

    // Merge rows from main file and additional files
    const allRawRows = [
      ...parseResult.validation.rows,
      ...additionalParseResults.flatMap((r) => r.validation.rows),
    ]

    const rows: SupportRow[] = allRawRows.map((row) => {
      const updated = { ...row }
      const rowType = updated.type || overrides["type"] || ""
      const remainingMissing: string[] = []
      for (const field of row._missingFields) {
        if (overrides[field]?.trim()) {
          ;(updated as unknown as Record<string, string>)[field] = overrides[field].trim()
        } else {
          remainingMissing.push(field)
        }
      }
      if (!updated.type && overrides["type"]) {
        updated.type = overrides["type"]
        const idx = remainingMissing.indexOf("type")
        if (idx !== -1) remainingMissing.splice(idx, 1)
      }
      // Populate dynamic items array from project type config
      const normalizedType = (updated.type || rowType).trim().toLowerCase()
      const typeConfig = typeConfigs.find((t: SupportTypeConfig) => t.typeName.trim().toLowerCase() === normalizedType)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legacyConfig = typeConfig as any
      if (typeConfig?.items && typeConfig.items.length > 0) {
        // New structure: items[] with itemName, qty, make, model
        updated.items = typeConfig.items.map((item) => ({
          name: item.itemName,
          qty: item.qty || "",
        }))
        typeConfig.items.forEach((item, i) => {
          const prefix = `item0${i + 1}`
          if (i < 3) {
            ;(updated as unknown as Record<string, string>)[`${prefix}Name`] = item.itemName
            ;(updated as unknown as Record<string, string>)[`${prefix}Qty`] = item.qty || ""
          }
        })
      } else if (legacyConfig?.item01 || legacyConfig?.item02 || legacyConfig?.item03) {
        // Legacy structure: item01/item02/item03 objects with name/qty
        const legacyItems = []
        for (let i = 1; i <= 3; i++) {
          const key = `item0${i}`
          if (legacyConfig[key]?.name) {
            legacyItems.push({ name: legacyConfig[key].name, qty: legacyConfig[key].qty || "" })
          }
        }
        updated.items = legacyItems
        legacyItems.forEach((item, i) => {
          const prefix = `item0${i + 1}`
          ;(updated as unknown as Record<string, string>)[`${prefix}Name`] = item.name
          ;(updated as unknown as Record<string, string>)[`${prefix}Qty`] = item.qty
        })
      } else {
        updated.items = []
      }
      // Remove item fields from missing list when populated from project config
      if (updated.items.length > 0) {
        for (let i = 0; i < updated.items.length && i < 3; i++) {
          const prefix = `item0${i + 1}`
          for (const suffix of ["Name", "Qty"]) {
            const idx = remainingMissing.indexOf(`${prefix}${suffix}`)
            if (idx !== -1) remainingMissing.splice(idx, 1)
          }
        }
      }
      updated.total = calcTotal(updated)
      const ti = remainingMissing.indexOf("total"); if (ti !== -1) remainingMissing.splice(ti, 1)
      updated._missingFields = remainingMissing
      updated._hasErrors = remainingMissing.some((f) => ["supportTagName", "type"].includes(f))
      return updated
    })

    const types = new Set(rows.map((r) => r.type).filter(Boolean))
    setValidationResult({
      isValid: true, totalRows: rows.length, totalTypes: types.size,
      missingFieldsCount: rows.reduce((s, r) => s + r._missingFields.length, 0),
      requiredMissingCount: 0, rows,
    })
    const grouped: Record<string, SupportRow[]> = {}
    for (const row of rows) { const t = row.type || "Unknown"; if (!grouped[t]) grouped[t] = []; grouped[t].push(row) }
    setGroupedSupports(grouped)
    setCurrentProject(projectId, project?.clientName || "")
    const supportKeys = rows.map((r) => r.supportTagName).filter(Boolean)

    // Duplicate detection: compare against existing uploads in the project
    const existingKeys = new Set<string>()
    for (const u of (project?.uploads || [])) {
      for (const k of (u.supportKeys || [])) existingKeys.add(k)
    }
    const duplicates = supportKeys.filter((k) => existingKeys.has(k))
    if (duplicates.length > 0) {
      setDuplicateWarning({ count: duplicates.length, names: duplicates.slice(0, 10) })
      // Non-blocking: still proceed after showing warning
    } else {
      setDuplicateWarning(null)
    }

    const fileNames = [file?.name || "Excel Upload", ...additionalFiles.map((f) => f.name)].join(", ")
    addUploadRecord(projectId, { fileName: fileNames, rowCount: rows.length, types: Array.from(types), supportKeys, classification })
    router.push("/review")
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
  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-md)",
  }

  const showConfigForm = !!parseResult

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
        Upload Support Schedule
      </h1>

      {/* Show project name if from project detail */}
      {fromProject && project && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
          Uploading to <strong>{project.clientName}</strong>
          {hasProjectTypes && <span> — {typeNames.join(", ")}</span>}
        </p>
      )}

      {/* Project dropdown — only if NOT coming from project detail */}
      {!fromProject && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <label style={labelStyle}>Project</label>
          {projects.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)" }}>No projects yet.</span>
              <ActionButton variant="primary" size="sm" onClick={() => router.push("/projects")}>Create Project</ActionButton>
            </div>
          ) : (
            <select value={dropdownProjectId} onChange={(e) => { setDropdownProjectId(e.target.value); handleFileRemove() }} style={{ ...inputStyle, maxWidth: 400, cursor: "pointer" }}>
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.clientName} ({p.supportTypes.length} types)</option>)}
            </select>
          )}
        </div>
      )}

      {/* Upload area */}
      {project && (
        <>
          <FileUploadZone file={file} status={status} errorMessage={error} onFileSelect={handleFileSelect} onFileRemove={handleFileRemove} />

          {hasProjectTypes && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "var(--space-4)" }}>
              <ActionButton variant="secondary" size="sm" onClick={handleDownloadTemplate}
                iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              >Download Template</ActionButton>
            </div>
          )}

          {!showConfigForm && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-6)" }}>
              <ActionButton variant="primary" disabled={status !== "valid"} loading={parsing} onClick={handleParse}
                iconRight={!parsing ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : undefined}
              >{parsing ? "Parsing..." : "Parse File"}</ActionButton>
            </div>
          )}

          {showConfigForm && (
            <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-primary-soft)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--color-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)" }}>
                Parsed <strong>{parseResult!.validation.totalRows + additionalParseResults.reduce((s, r) => s + r.validation.totalRows, 0)} rows</strong>
                {additionalParseResults.length > 0 && <> from <strong>{1 + additionalParseResults.length} files</strong></>}
                {excelTypes.length > 0 && <> with types: <strong>{excelTypes.join(", ")}</strong></>}.
              </div>

              {/* Duplicate detection warning */}
              {duplicateWarning && (
                <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-warning-soft)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--color-warning)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)" }}>
                  <strong>{duplicateWarning.count} duplicate support tag{duplicateWarning.count !== 1 ? "s" : ""}</strong> found against existing uploads in this project
                  {duplicateWarning.names.length > 0 && (
                    <span>: {duplicateWarning.names.join(", ")}{duplicateWarning.count > 10 ? "..." : ""}</span>
                  )}
                  <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                    These will be counted as revisions. You can still proceed.
                  </span>
                </div>
              )}

              {/* Additional Files for batch upload */}
              <div style={cardStyle}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-3)" }}>Additional Files</h2>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                  Optionally add more Excel files to merge their rows with the primary file.
                </p>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    setAdditionalFiles(files)
                    setAdditionalParseResults([])
                  }}
                  style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)" }}
                />
                {additionalFiles.length > 0 && (
                  <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                    {additionalFiles.length} additional file{additionalFiles.length !== 1 ? "s" : ""} selected
                    {additionalParseResults.length > 0 && (
                      <span style={{ color: "var(--color-success)", marginLeft: "var(--space-2)" }}>
                        ({additionalParseResults.reduce((s, r) => s + r.validation.totalRows, 0)} rows parsed)
                      </span>
                    )}
                    {parsingAdditional && <span style={{ marginLeft: "var(--space-2)" }}>Parsing...</span>}
                  </div>
                )}
              </div>

              {/* Internal / External classification */}
              <div style={cardStyle}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Support Classification</h2>
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  {(["internal", "external"] as const).map((opt) => (
                    <label key={opt} style={{
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      padding: "var(--space-2) var(--space-4)",
                      background: classification === opt ? "var(--color-primary-soft)" : "var(--color-surface-2)",
                      border: classification === opt ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)", cursor: "pointer",
                      fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600,
                      color: classification === opt ? "var(--color-primary)" : "var(--color-text-muted)",
                      textTransform: "capitalize",
                    }}>
                      <input type="radio" name="classification" value={opt} checked={classification === opt} onChange={() => setClassification(opt)} style={{ accentColor: "var(--color-primary)" }} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              {typeMissing && (
                <div style={cardStyle}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Support Type</h2>
                  {hasProjectTypes ? (
                    <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ ...inputStyle, maxWidth: 300, cursor: "pointer" }}>
                      <option value="">Select type...</option>
                      {typeNames.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-warning)" }}>No types configured.</div>
                  )}
                </div>
              )}

              {Object.keys(missingValues).length > 0 && (
                <div style={cardStyle}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Missing Columns</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
                    {Object.keys(missingValues).map((col) => (
                      <div key={col}>
                        <label style={labelStyle}>{FIELD_LABELS[col] || col}</label>
                        <input type="text" value={missingValues[col] || ""} onChange={(e) => setMissingValues((p) => ({ ...p, [col]: e.target.value }))} placeholder={`Enter ${FIELD_LABELS[col] || col}`} style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasProjectTypes && (
                <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-success-soft)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--color-success)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text)" }}>
                  Item names and quantities auto-filled from project configuration.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                <ActionButton variant="secondary" onClick={() => { setParseResult(null); setMissingValues({}); setSelectedType("") }}>Re-parse</ActionButton>
                <ActionButton variant="primary" onClick={finalize}
                  iconRight={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                >Continue to Review</ActionButton>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Confirmation Popup ─── */}
      {showConfirm && pendingFile && project && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300,
          }}
          onClick={cancelUpload}
        >
          <div
            className="animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-8)",
              boxShadow: "var(--shadow-xl)",
              maxWidth: 440,
              width: "90%",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-3)" }}>
              Confirm Upload
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
              Upload <strong style={{ color: "var(--color-text)" }}>{pendingFile.name}</strong> to
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700, color: "var(--color-primary)", marginBottom: "var(--space-6)" }}>
              {project.clientName}
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <ActionButton variant="secondary" onClick={cancelUpload}>Cancel</ActionButton>
              <ActionButton variant="primary" onClick={confirmUpload}>Confirm</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
