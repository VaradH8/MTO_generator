"use client"

import { useCallback, useRef, useState } from "react"

type Status = "idle" | "validating" | "valid" | "invalid"

interface FileUploadZoneProps {
  accept?: string
  maxSizeMB?: number
  file: File | null
  status: Status
  errorMessage?: string | null
  onFileSelect: (file: File) => void
  onFileRemove: () => void
}

export default function FileUploadZone({
  accept = ".xlsx,.xls",
  maxSizeMB = 10,
  file,
  status,
  errorMessage = null,
  onFileSelect,
  onFileRemove,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (f: File) => {
      onFileSelect(f)
    },
    [onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {/* Drop Zone */}
      {!file && (
        <div
          className="animate-fade-in-up"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? "var(--color-primary)" : "var(--color-border)"}`,
            background: dragOver ? "var(--color-primary-soft)" : "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-12)",
            textAlign: "center",
            minHeight: 200,
            cursor: "pointer",
            transition: "var(--transition-base)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            style={{ marginBottom: "var(--space-4)", color: dragOver ? "var(--color-primary)" : "var(--color-text-faint)" }}
          >
            <path
              d="M24 6v24M14 18l10-10 10 10M8 34h32v6H8v-6z"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 500, color: "var(--color-text)" }}>
            Drag & drop your file here
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            or click to browse
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-faint)", marginTop: "var(--space-3)" }}>
            {accept} — max {maxSizeMB} MB
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* File Info Bar */}
      {file && (
        <div
          className="animate-fade-in-up"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="1" width="14" height="18" rx="2" stroke="var(--color-primary)" strokeWidth="1.5" />
            <path d="M7 7h6M7 10h6M7 13h4" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 300,
            }}
          >
            {file.name}
          </span>

          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            {formatSize(file.size)}
          </span>

          <span style={{ flexGrow: 1 }} />

          <button
            onClick={onFileRemove}
            aria-label="Remove file"
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-faint)",
              borderRadius: "var(--radius-sm)",
              fontSize: "1rem",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Validation Feedback */}
      {status === "valid" && (
        <div
          className="animate-fade-in-down"
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            borderLeft: "3px solid var(--color-success)",
            background: "var(--color-success-soft)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            color: "var(--color-text)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <span style={{ color: "var(--color-success)" }}>&#10003;</span>
          Valid Excel file. Ready to parse.
        </div>
      )}

      {status === "invalid" && errorMessage && (
        <div
          className="animate-fade-in-down"
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            borderLeft: "3px solid var(--color-error)",
            background: "var(--color-error-soft)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            color: "var(--color-text)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <span style={{ color: "var(--color-error)" }}>&#10007;</span>
          {errorMessage}
        </div>
      )}
    </div>
  )
}
