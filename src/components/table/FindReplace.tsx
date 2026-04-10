"use client"

import { useEffect, useRef } from "react"

interface FindReplaceProps {
  query: string
  replaceText: string
  showReplace: boolean
  matchCount: number
  currentIndex: number
  onQueryChange: (q: string) => void
  onReplaceChange: (r: string) => void
  onNext: () => void
  onPrev: () => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onClose: () => void
  onToggleReplace: () => void
}

export default function FindReplace({
  query,
  replaceText,
  showReplace,
  matchCount,
  currentIndex,
  onQueryChange,
  onReplaceChange,
  onNext,
  onPrev,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
  onToggleReplace,
}: FindReplaceProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const inputStyle: React.CSSProperties = {
    height: 28,
    padding: "0 8px",
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: "var(--color-text)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    outline: "none",
    flex: 1,
    minWidth: 120,
  }

  const btnStyle: React.CSSProperties = {
    height: 28,
    padding: "0 8px",
    fontFamily: "var(--font-display)",
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: "var(--color-text)",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "var(--space-3) var(--space-4)",
      background: "var(--color-surface)",
      borderBottom: "1px solid var(--color-border)",
      boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.shiftKey ? onPrev() : onNext() }
            if (e.key === "Escape") onClose()
          }}
          placeholder="Find..."
          style={inputStyle}
        />
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-muted)", minWidth: 50 }}>
          {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : query ? "0 found" : ""}
        </span>
        <button onClick={onPrev} style={btnStyle} disabled={matchCount === 0}>↑</button>
        <button onClick={onNext} style={btnStyle} disabled={matchCount === 0}>↓</button>
        <button onClick={onToggleReplace} style={btnStyle}>{showReplace ? "Hide" : "Replace"}</button>
        <button onClick={onClose} style={btnStyle}>✕</button>
      </div>
      {showReplace && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={replaceText}
            onChange={(e) => onReplaceChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
            placeholder="Replace with..."
            style={inputStyle}
          />
          <button onClick={onReplaceCurrent} style={btnStyle} disabled={matchCount === 0}>Replace</button>
          <button onClick={onReplaceAll} style={btnStyle} disabled={matchCount === 0}>Replace all</button>
        </div>
      )}
    </div>
  )
}
