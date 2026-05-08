import type { ExternalTypeProfile } from "@/types/support"

/**
 * Parse a `L_ANGLE_PROFILE`-style CSV into ExternalTypeProfile rows.
 *
 * Expected header (case-insensitive):
 *   TYPE, MEMBERS, A, B, C, D, E
 *
 * Rules:
 *   - TYPE and MEMBERS are required columns; any other column ordering is
 *     OK as long as those headers exist.
 *   - Empty TYPE rows are silently skipped (the source CSV has trailing
 *     blank lines).
 *   - Numeric MEMBERS that fails to parse falls back to 0, which means
 *     "no L PROFILE summation for this type" downstream.
 *   - Cell content is otherwise stored verbatim (after trim) in flagA..E.
 *
 * No DB writes here — this is a pure CSV → array transformation. Callers
 * POST the result to `/api/settings/external-profile`.
 */
export function parseExternalProfileCsv(text: string): ExternalTypeProfile[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.findIndex((h) => h === name)
  const typeIdx = idx("type")
  const membersIdx = idx("members")
  if (typeIdx < 0 || membersIdx < 0) {
    throw new Error("CSV must contain TYPE and MEMBERS columns")
  }
  const aIdx = idx("a"), bIdx = idx("b"), cIdx = idx("c"), dIdx = idx("d"), eIdx = idx("e")
  const cellAt = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "")

  const out: ExternalTypeProfile[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim())
    const t = cellAt(cells, typeIdx)
    if (!t) continue
    const mRaw = cellAt(cells, membersIdx)
    const m = parseInt(mRaw, 10)
    out.push({
      typeName: t,
      members: Number.isFinite(m) && m >= 0 ? m : 0,
      flagA: cellAt(cells, aIdx),
      flagB: cellAt(cells, bIdx),
      flagC: cellAt(cells, cIdx),
      flagD: cellAt(cells, dIdx),
      flagE: cellAt(cells, eIdx),
    })
  }
  return out
}
