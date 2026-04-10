"use client"

const PAGE_SIZES = [25, 50, 100, 250, 500]

export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  const btnStyle: React.CSSProperties = {
    height: 28,
    minWidth: 28,
    padding: "0 8px",
    fontFamily: "var(--font-display)",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
  }

  // Show a window of page buttons around current
  const pageButtons: number[] = []
  const start = Math.max(0, page - 2)
  const end = Math.min(totalPages - 1, page + 2)
  for (let i = start; i <= end; i++) pageButtons.push(i)

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) 0", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", flexWrap: "wrap" }}>
      <span>{from}–{to} of {total}</span>

      <div style={{ display: "flex", gap: 2 }}>
        <button style={btnStyle} disabled={page === 0} onClick={() => onPageChange(0)} title="First page">«</button>
        <button style={btnStyle} disabled={page === 0} onClick={() => onPageChange(page - 1)} title="Previous">‹</button>
        {start > 0 && <span style={{ padding: "0 4px", lineHeight: "28px" }}>…</span>}
        {pageButtons.map((p) => (
          <button key={p} style={{ ...btnStyle, background: p === page ? "var(--color-primary)" : "var(--color-surface)", color: p === page ? "#fff" : "var(--color-text)" }} onClick={() => onPageChange(p)}>
            {p + 1}
          </button>
        ))}
        {end < totalPages - 1 && <span style={{ padding: "0 4px", lineHeight: "28px" }}>…</span>}
        <button style={btnStyle} disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} title="Next">›</button>
        <button style={btnStyle} disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} title="Last page">»</button>
      </div>

      <select
        value={pageSize}
        onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(0) }}
        style={{ height: 28, padding: "0 4px", fontFamily: "var(--font-body)", fontSize: "0.75rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer" }}
      >
        {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
      </select>
    </div>
  )
}
