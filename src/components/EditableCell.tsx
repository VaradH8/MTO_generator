"use client"

import { useState, useRef, useEffect } from "react"

interface EditableCellProps {
  value: string | number | null
  columnType?: "text" | "number"
  onCommit: (value: string | number) => void
  disabled?: boolean
}

export default function EditableCell({
  value,
  columnType = "text",
  onCommit,
  disabled = false,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const isEmpty = value === null || value === ""

  // Not editing — show value or placeholder, click to edit
  if (!editing) {
    return (
      <span
        onClick={() => {
          if (!disabled) {
            setEditing(true)
            setDraft(isEmpty ? "" : String(value))
            setError(null)
          }
        }}
        style={{
          color: isEmpty ? "var(--color-text-faint)" : "var(--color-text)",
          cursor: disabled ? "default" : "text",
          display: "block",
          width: "100%",
          minHeight: 20,
        }}
      >
        {isEmpty ? "\u2014" : String(value)}
      </span>
    )
  }

  const validate = (val: string): string | null => {
    if (columnType === "number") {
      if (val.trim() === "") return null // allow empty
      if (!/^-?\d+(\.\d+)?$/.test(val.trim())) return "Must be a number"
    }
    return null
  }

  const commit = () => {
    const trimmed = draft.trim()
    const err = validate(trimmed)
    if (err) {
      setError(err)
      return
    }
    setEditing(false)
    setError(null)
    if (trimmed === "") {
      // Allow clearing — commit empty string
      onCommit("")
    } else {
      onCommit(columnType === "number" ? parseFloat(trimmed) : trimmed)
    }
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        setError(null)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        if (e.key === "Escape") {
          setEditing(false)
          setError(null)
        }
      }}
      title={error ?? undefined}
      style={{
        width: "100%",
        fontFamily: "var(--font-body)",
        fontSize: "0.875rem",
        padding: "var(--space-2) var(--space-3)",
        border: `1px solid ${error ? "var(--color-error)" : "var(--color-primary)"}`,
        borderRadius: "var(--radius-sm)",
        background: error ? "var(--color-error-soft)" : "var(--color-surface)",
        boxShadow: error ? "none" : "var(--shadow-focus)",
        outline: "none",
        color: "var(--color-text)",
      }}
    />
  )
}
