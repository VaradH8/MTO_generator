"use client"

import { useEffect, useRef } from "react"

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onInsertAbove: () => void
  onInsertBelow: () => void
  onDeleteRows: () => void
  onDuplicateRow: () => void
  selectedCount: number
}

export default function ContextMenu({
  x,
  y,
  onClose,
  onInsertAbove,
  onInsertBelow,
  onDeleteRows,
  onDuplicateRow,
  selectedCount,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", escHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", escHandler)
    }
  }, [onClose])

  // Keep menu on screen
  const style: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 500,
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-lg)",
    padding: "var(--space-1) 0",
    minWidth: 180,
  }

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 12px",
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: "var(--color-text)",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  }

  const separator: React.CSSProperties = { borderTop: "1px solid var(--color-border)", margin: "4px 0" }

  return (
    <div ref={ref} style={style}>
      <button style={itemStyle} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")} onClick={() => { onInsertAbove(); onClose() }}>
        Insert row above
      </button>
      <button style={itemStyle} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")} onClick={() => { onInsertBelow(); onClose() }}>
        Insert row below
      </button>
      <button style={itemStyle} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")} onClick={() => { onDuplicateRow(); onClose() }}>
        Duplicate row
      </button>
      <div style={separator} />
      <button style={{ ...itemStyle, color: "var(--color-error)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-error-soft)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")} onClick={() => { onDeleteRows(); onClose() }}>
        Delete {selectedCount > 1 ? `${selectedCount} rows` : "row"}
      </button>
    </div>
  )
}
