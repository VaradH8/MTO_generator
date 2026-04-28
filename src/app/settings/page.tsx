"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSettings } from "@/context/SettingsContext"
import { useAuth } from "@/context/AuthContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import * as XLSX from "xlsx"
import type { MasterTypeItem, ItemVariant } from "@/types/support"
import { parseConfigFile, type ParsedConfig } from "@/lib/parseConfigFile"

type ManagedUser = { username: string; role: "admin" | "user" | "client"; password: string; createdAt: string }

interface ImportConflictType {
  typeName: string
  existing: { classification: string; items: { itemName: string; qty: string; make: string; model: string; withPlate: boolean; withoutPlate: boolean }[] }
  incoming: { classification: string; items: { itemName: string; qty: string; make: string; model: string }[] }
  diff: {
    addedItems: string[]
    removedItems: string[]
    changedItems: { itemName: string; before: { qty: string; make: string; model: string }; after: { qty: string; make: string; model: string } }[]
    classificationChanged: boolean
    plateFlagsWillReset: boolean
  }
}

interface ImportDryRun {
  newItems: string[]
  existingItems: string[]
  newTypes: string[]
  conflictTypes: ImportConflictType[]
}

export default function SettingsPage() {
  const { masterItems, addItem, removeItem, renameItem, masterTypes, addMasterType, updateMasterType, removeMasterType, pdfConfig, updatePdfConfig, refreshFromServer } = useSettings()
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === "admin"

  // ─── Master config import (Excel) ───
  const configImportFileRef = useRef<HTMLInputElement>(null)
  const [importStage, setImportStage] = useState<"closed" | "pickClassification" | "analyzing" | "review" | "applying" | "result">("closed")
  const [importClassification, setImportClassification] = useState<"internal" | "external">("internal")
  const [importParsed, setImportParsed] = useState<ParsedConfig | null>(null)
  const [importDryRun, setImportDryRun] = useState<ImportDryRun | null>(null)
  const [importOverwrite, setImportOverwrite] = useState<Set<string>>(new Set())
  const [importError, setImportError] = useState("")
  const [importResult, setImportResult] = useState<{ itemsAdded: number; typesAdded: number; typesOverwritten: number; typesSkipped: number } | null>(null)

  const closeImport = () => {
    setImportStage("closed")
    setImportParsed(null)
    setImportDryRun(null)
    setImportOverwrite(new Set())
    setImportError("")
    setImportResult(null)
  }

  const onImportFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setImportError("")
    setImportStage("analyzing")
    try {
      const parsed = await parseConfigFile(file)
      if (parsed.types.length === 0) {
        setImportError(parsed.warnings.join("\n") || "No usable rows found in the file.")
        setImportStage("pickClassification")
        return
      }
      setImportParsed(parsed)
      const res = await fetch("/api/settings/import-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "dryRun",
          classification: importClassification,
          types: parsed.types,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || `HTTP ${res.status}`); setImportStage("pickClassification"); return }
      setImportDryRun(data)
      // Default: do NOT overwrite anything (safest). User opts in per type.
      setImportOverwrite(new Set())
      setImportStage("review")
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to read file")
      setImportStage("pickClassification")
    }
  }

  const toggleOverwrite = (typeName: string) => {
    setImportOverwrite((prev) => {
      const n = new Set(prev)
      if (n.has(typeName)) n.delete(typeName); else n.add(typeName)
      return n
    })
  }

  const applyImport = async () => {
    if (!importParsed) return
    setImportStage("applying")
    setImportError("")
    try {
      const res = await fetch("/api/settings/import-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "apply",
          classification: importClassification,
          types: importParsed.types,
          overwriteTypeNames: Array.from(importOverwrite),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || `HTTP ${res.status}`); setImportStage("review"); return }
      setImportResult({
        itemsAdded: data.itemsAdded ?? 0,
        typesAdded: data.typesAdded ?? 0,
        typesOverwritten: data.typesOverwritten ?? 0,
        typesSkipped: data.typesSkipped ?? 0,
      })
      await refreshFromServer()
      setImportStage("result")
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Apply failed")
      setImportStage("review")
    }
  }

  // ─── User management (admin only) ───
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState("")
  const [newUsername, setNewUsername] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState<"admin" | "user" | "client">("user")
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null)
  const [resetPwFor, setResetPwFor] = useState<string | null>(null)
  const [resetPwValue, setResetPwValue] = useState("")

  const fetchUsers = useCallback(async () => {
    if (!isAdmin || !currentUser) return
    setUsersLoading(true)
    setUsersError("")
    try {
      const res = await fetch("/api/users", { headers: { "x-username": currentUser.username } })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setUsersError(data.error || `Failed to load users (${res.status})`)
        return
      }
      setUsers(await res.json())
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }, [isAdmin, currentUser])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreateUser = async () => {
    if (!currentUser || !newUsername.trim() || !newUserPassword) return
    setUsersError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-username": currentUser.username },
      body: JSON.stringify({ username: newUsername.trim(), password: newUserPassword, role: newUserRole }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setUsersError(data.error || `Failed to create user (${res.status})`)
      return
    }
    setNewUsername(""); setNewUserPassword(""); setNewUserRole("user")
    fetchUsers()
  }

  const handleDeleteUser = async (username: string) => {
    if (!currentUser) return
    setUsersError("")
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
      headers: { "x-username": currentUser.username },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setUsersError(data.error || `Failed to delete user (${res.status})`)
      return
    }
    setConfirmDeleteUser(null)
    fetchUsers()
  }

  const handleResetPassword = async () => {
    if (!currentUser || !resetPwFor || !resetPwValue) return
    setUsersError("")
    const res = await fetch(`/api/users/${encodeURIComponent(resetPwFor)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-username": currentUser.username },
      body: JSON.stringify({ password: resetPwValue }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setUsersError(data.error || `Failed to reset password (${res.status})`)
      return
    }
    setResetPwFor(null); setResetPwValue("")
  }

  // ─── Self-service password change (any logged-in user) ───
  const [myCurrentPw, setMyCurrentPw] = useState("")
  const [myNewPw, setMyNewPw] = useState("")
  const [myConfirmPw, setMyConfirmPw] = useState("")
  const [myPwError, setMyPwError] = useState("")
  const [myPwSuccess, setMyPwSuccess] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())

  const toggleReveal = (username: string) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev)
      if (next.has(username)) next.delete(username); else next.add(username)
      return next
    })
  }

  const handleChangeMyPassword = async () => {
    if (!currentUser) return
    setMyPwError(""); setMyPwSuccess(false)
    if (!myCurrentPw || !myNewPw) { setMyPwError("Fill all fields"); return }
    if (myNewPw !== myConfirmPw) { setMyPwError("New passwords don't match"); return }
    if (myNewPw.length < 4) { setMyPwError("New password must be at least 4 characters"); return }
    const res = await fetch("/api/users/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser.username, currentPassword: myCurrentPw, newPassword: myNewPw }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMyPwError(data.error || `Failed (${res.status})`)
      return
    }
    setMyCurrentPw(""); setMyNewPw(""); setMyConfirmPw("")
    setMyPwSuccess(true)
    fetchUsers()
  }

  const handleUpdateRole = async (username: string, role: "admin" | "user" | "client") => {
    if (!currentUser) return
    setUsersError("")
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-username": currentUser.username },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setUsersError(data.error || `Failed to update role (${res.status})`)
      return
    }
    fetchUsers()
  }

  // Item state
  const [newItemName, setNewItemName] = useState("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemName, setEditItemName] = useState("")
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null)

  // Type state
  const [addingType, setAddingType] = useState(false)
  const [newTypeName, setNewTypeName] = useState("")
  const [newTypeClassification, setNewTypeClassification] = useState<"internal" | "external">("internal")
  const [newTypeItems, setNewTypeItems] = useState<MasterTypeItem[]>([])
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editTypeName, setEditTypeName] = useState("")
  const [editTypeClassification, setEditTypeClassification] = useState<"internal" | "external">("internal")
  const [editTypeItems, setEditTypeItems] = useState<MasterTypeItem[]>([])
  const [confirmDeleteType, setConfirmDeleteType] = useState<string | null>(null)
  const [typeError, setTypeError] = useState("")

  // Backup state
  const importFileRef = useRef<HTMLInputElement>(null)

  const BACKUP_KEYS = ["spg_projects", "spg_billing", "spg_approvals", "spg_settings", "spg_support"] as const

  const handleExportAll = () => {
    const data: Record<string, unknown> = {}
    for (const key of BACKUP_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        try { data[key] = JSON.parse(raw) } catch { data[key] = raw }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `spg_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (typeof data !== "object" || data === null) { alert("Invalid backup file."); return }
        for (const key of Object.keys(data)) {
          localStorage.setItem(key, typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]))
        }
        window.location.reload()
      } catch {
        alert("Failed to parse backup file. Ensure it is valid JSON.")
      }
    }
    reader.readAsText(file)
    // Reset input so re-selecting same file works
    e.target.value = ""
  }

  // ─── Item handlers ───
  const handleAddItem = () => {
    if (!newItemName.trim()) return
    if (masterItems.some((i) => i.name.toLowerCase() === newItemName.trim().toLowerCase())) return
    addItem(newItemName)
    setNewItemName("")
  }

  // ─── Type handlers ───
  const toggleTypeItem = (items: MasterTypeItem[], setItems: (i: MasterTypeItem[]) => void, itemId: string, itemName: string) => {
    const exists = items.find((i) => i.itemId === itemId)
    if (exists) {
      setItems(items.filter((i) => i.itemId !== itemId))
    } else {
      setItems([...items, { itemId, itemName, qty: "", make: "", model: "" }])
    }
  }

  const updateTypeItemField = (items: MasterTypeItem[], setItems: (i: MasterTypeItem[]) => void, itemId: string, field: keyof MasterTypeItem, value: string) => {
    setItems(items.map((i) => i.itemId === itemId ? { ...i, [field]: value } : i))
  }

  const toggleTypeItemPlate = (items: MasterTypeItem[], setItems: (i: MasterTypeItem[]) => void, itemId: string, field: "withPlate" | "withoutPlate") => {
    setItems(items.map((i) => i.itemId === itemId ? { ...i, [field]: !i[field] } : i))
  }

  const validateItemQtys = (items: MasterTypeItem[]): string | null => {
    for (const item of items) {
      if (item.variants && item.variants.length > 0) {
        for (const v of item.variants) {
          if (!v.label.trim()) return `${item.itemName}: variant label required`
          if (!v.qty.trim()) return `${item.itemName} (${v.label}): qty required`
        }
      } else if (!item.qty?.trim()) {
        return `${item.itemName} needs a quantity`
      }
    }
    return null
  }

  const handleSaveNewType = () => {
    if (!newTypeName.trim()) { setTypeError("Type name required"); return }
    if (masterTypes.some((t) => t.typeName.toLowerCase() === newTypeName.trim().toLowerCase() && (t.classification || "internal") === newTypeClassification)) { setTypeError(`Type already exists as ${newTypeClassification}`); return }
    const err = validateItemQtys(newTypeItems)
    if (err) { setTypeError(err); return }
    setTypeError("")
    addMasterType({ typeName: newTypeName.trim(), classification: newTypeClassification, items: newTypeItems })
    setAddingType(false)
    setNewTypeName("")
    setNewTypeClassification("internal")
    setNewTypeItems([])
  }

  const startEditType = (id: string) => {
    const t = masterTypes.find((mt) => mt.id === id)
    if (!t) return
    setEditingTypeId(id)
    setEditTypeName(t.typeName)
    setEditTypeClassification(t.classification || "internal")
    setEditTypeItems(t.items.map((i) => ({ ...i })))
  }

  const handleSaveEditType = () => {
    if (!editingTypeId || !editTypeName.trim()) return
    const err = validateItemQtys(editTypeItems)
    if (err) { setTypeError(err); return }
    setTypeError("")
    updateMasterType(editingTypeId, { typeName: editTypeName.trim(), classification: editTypeClassification, items: editTypeItems })
    setEditingTypeId(null)
  }

  const inputStyle: React.CSSProperties = {
    height: 36, padding: "0 var(--space-3)", fontFamily: "var(--font-body)",
    fontSize: "0.875rem", color: "var(--color-text)", background: "var(--color-surface)",
    border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", outline: "none", width: "100%",
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)", fontSize: "0.625rem", fontWeight: 500,
    color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em",
    marginBottom: 2, display: "block",
  }
  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-md)",
  }

  // Reusable item checkbox + config UI
  const renderItemConfig = (items: MasterTypeItem[], setItems: (i: MasterTypeItem[]) => void) => (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        {masterItems.map((mi) => {
          const sel = items.some((i) => i.itemId === mi.id)
          const hit = sel ? items.find((i) => i.itemId === mi.id) : null
          return (
            <div key={mi.id} style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              background: sel ? "var(--color-primary-soft)" : "var(--color-surface)",
              border: sel ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}>
              <label style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer",
                fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 500,
                color: sel ? "var(--color-primary)" : "var(--color-text-muted)",
              }}>
                <input type="checkbox" checked={sel} onChange={() => toggleTypeItem(items, setItems, mi.id, mi.name)} style={{ accentColor: "var(--color-primary)" }} />
                {mi.name}
              </label>
              {/* Plate flags travel with the item selection so the user can
                  tick them in one place. Disabled until the item itself is
                  selected. They edit the same fields as the per-item card
                  below — either surface works. */}
              <label style={{
                display: "flex", alignItems: "center", gap: 4, cursor: sel ? "pointer" : "not-allowed",
                opacity: sel ? 1 : 0.4,
                fontFamily: "var(--font-body)", fontSize: "0.6875rem",
                color: "var(--color-text-muted)", whiteSpace: "nowrap",
              }}>
                <input
                  type="checkbox"
                  disabled={!sel}
                  checked={!!hit?.withPlate}
                  onChange={() => sel && toggleTypeItemPlate(items, setItems, mi.id, "withPlate")}
                  style={{ accentColor: "var(--color-primary)" }}
                />
                W/Plate
              </label>
              <label style={{
                display: "flex", alignItems: "center", gap: 4, cursor: sel ? "pointer" : "not-allowed",
                opacity: sel ? 1 : 0.4,
                fontFamily: "var(--font-body)", fontSize: "0.6875rem",
                color: "var(--color-text-muted)", whiteSpace: "nowrap",
              }}>
                <input
                  type="checkbox"
                  disabled={!sel}
                  checked={!!hit?.withoutPlate}
                  onChange={() => sel && toggleTypeItemPlate(items, setItems, mi.id, "withoutPlate")}
                  style={{ accentColor: "var(--color-primary)" }}
                />
                W/o Plate
              </label>
            </div>
          )
        })}
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {items.map((item) => {
            const hasVariants = !!item.variants && item.variants.length > 0
            const toggleVariants = () => {
              const next: ItemVariant[] | undefined = hasVariants
                ? undefined
                : [{ label: "", qty: "" }]
              setItems(items.map((i) => i.itemId === item.itemId ? { ...i, variants: next, qty: next ? "" : i.qty } : i))
            }
            const updateVariant = (idx: number, field: keyof ItemVariant, value: string) => {
              setItems(items.map((i) => {
                if (i.itemId !== item.itemId) return i
                const vs = [...(i.variants || [])]
                vs[idx] = { ...vs[idx], [field]: value }
                return { ...i, variants: vs }
              }))
            }
            const addVariant = () => {
              setItems(items.map((i) => i.itemId === item.itemId
                ? { ...i, variants: [...(i.variants || []), { label: "", qty: "", make: "", model: "" }] }
                : i))
            }
            const removeVariant = (idx: number) => {
              setItems(items.map((i) => {
                if (i.itemId !== item.itemId) return i
                const vs = (i.variants || []).filter((_, k) => k !== idx)
                return { ...i, variants: vs.length > 0 ? vs : undefined }
              }))
            }

            return (
              <div key={item.itemId} style={{
                padding: "var(--space-3)", background: "var(--color-surface)",
                borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
                display: "flex", flexDirection: "column", gap: "var(--space-2)",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: hasVariants ? "1fr auto 1fr 1fr" : "1fr 70px auto 1fr 1fr", gap: "var(--space-2)", alignItems: "end" }}>
                  <div>
                    <label style={labelStyle}>Item</label>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", paddingTop: 6 }}>{item.itemName}</div>
                  </div>
                  {!hasVariants && (
                    <div>
                      <label style={labelStyle}>Qty</label>
                      <input type="number" min="0" value={item.qty} onChange={(e) => updateTypeItemField(items, setItems, item.itemId, "qty", e.target.value)} placeholder="0" style={{ ...inputStyle, height: 32, fontSize: "0.75rem", textAlign: "center" }} />
                    </div>
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-display)", fontSize: "0.6875rem", fontWeight: 500, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.02em", cursor: "pointer", paddingBottom: 6, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={hasVariants} onChange={toggleVariants} style={{ accentColor: "var(--color-primary)" }} />
                    Size variants
                  </label>
                  <div>
                    <label style={labelStyle}>Make</label>
                    <input value={item.make} onChange={(e) => updateTypeItemField(items, setItems, item.itemId, "make", e.target.value)} placeholder="Make" style={{ ...inputStyle, height: 32, fontSize: "0.75rem" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Model</label>
                    <input value={item.model} onChange={(e) => updateTypeItemField(items, setItems, item.itemId, "model", e.target.value)} placeholder="Model" style={{ ...inputStyle, height: 32, fontSize: "0.75rem" }} />
                  </div>
                </div>
                {/* Per-item plate flags. Each drives a "Yes"/blank sub-column
                    next to the item in every generated PDF. */}
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-1)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!item.withPlate} onChange={() => toggleTypeItemPlate(items, setItems, item.itemId, "withPlate")} style={{ accentColor: "var(--color-primary)" }} />
                    With Plate
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!item.withoutPlate} onChange={() => toggleTypeItemPlate(items, setItems, item.itemId, "withoutPlate")} style={{ accentColor: "var(--color-primary)" }} />
                    Without Plate
                  </label>
                </div>
                {hasVariants && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingLeft: "var(--space-3)", borderLeft: "2px solid var(--color-primary-soft)" }}>
                    {(item.variants || []).map((v, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 1fr auto", gap: "var(--space-2)", alignItems: "end" }}>
                        <div>
                          <label style={labelStyle}>Size label</label>
                          <input value={v.label} onChange={(e) => updateVariant(idx, "label", e.target.value)} placeholder="e.g. 2(50,50)" style={{ ...inputStyle, height: 32, fontSize: "0.75rem" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Qty</label>
                          <input type="number" min="0" value={v.qty} onChange={(e) => updateVariant(idx, "qty", e.target.value)} placeholder="0" style={{ ...inputStyle, height: 32, fontSize: "0.75rem", textAlign: "center" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Make</label>
                          <input value={v.make || ""} onChange={(e) => updateVariant(idx, "make", e.target.value)} placeholder="Make" style={{ ...inputStyle, height: 32, fontSize: "0.75rem" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Model</label>
                          <input value={v.model || ""} onChange={(e) => updateVariant(idx, "model", e.target.value)} placeholder="Model" style={{ ...inputStyle, height: 32, fontSize: "0.75rem" }} />
                        </div>
                        <ActionButton variant="ghost" size="sm" onClick={() => removeVariant(idx)}>×</ActionButton>
                      </div>
                    ))}
                    <div>
                      <ActionButton variant="ghost" size="sm" onClick={addVariant}>+ Add variant</ActionButton>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>Settings</h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "var(--space-8)" }}>
        Manage master items and support type templates.
      </p>

      {/* ─── Change My Password (all users) ─── */}
      {currentUser && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Change My Password
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
            Signed in as <strong>{currentUser.username}</strong> ({currentUser.role}).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) auto", gap: "var(--space-3)", alignItems: "end", maxWidth: 700 }}>
            <div>
              <label style={labelStyle}>Current password</label>
              <input type="password" value={myCurrentPw} onChange={(e) => { setMyCurrentPw(e.target.value); setMyPwError(""); setMyPwSuccess(false) }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>New password</label>
              <input type="password" value={myNewPw} onChange={(e) => { setMyNewPw(e.target.value); setMyPwError(""); setMyPwSuccess(false) }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Confirm new</label>
              <input type="password" value={myConfirmPw} onChange={(e) => { setMyConfirmPw(e.target.value); setMyPwError(""); setMyPwSuccess(false) }} style={inputStyle} />
            </div>
            <ActionButton variant="primary" size="sm" onClick={handleChangeMyPassword} disabled={!myCurrentPw || !myNewPw || !myConfirmPw}>Update</ActionButton>
          </div>
          {myPwError && (
            <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginTop: "var(--space-3)" }}>{myPwError}</div>
          )}
          {myPwSuccess && (
            <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-success-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-success)", marginTop: "var(--space-3)" }}>Password updated.</div>
          )}
        </div>
      )}

      {/* ─── User Management (admin only) ─── */}
      {isAdmin && (
        <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
            Users ({users.length})
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
            Add and manage application users. Only admins see this section.
          </p>

          {/* Add user row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px auto", gap: "var(--space-3)", marginBottom: "var(--space-4)", alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. alice" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Password" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as "admin" | "user" | "client")} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="client">client</option>
              </select>
            </div>
            <ActionButton variant="primary" size="sm" onClick={handleCreateUser} disabled={!newUsername.trim() || !newUserPassword}>Add User</ActionButton>
          </div>

          {usersError && (
            <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginBottom: "var(--space-3)" }}>{usersError}</div>
          )}

          {usersLoading ? (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-faint)" }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {users.map((u) => {
                const isSelf = u.username === currentUser?.username
                return (
                  <div key={u.username} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)", minWidth: 120 }}>{u.username}</span>
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleUpdateRole(u.username, e.target.value as "admin" | "user" | "client")}
                      style={{ ...inputStyle, height: 28, fontSize: "0.75rem", width: 100, cursor: isSelf ? "not-allowed" : "pointer", opacity: isSelf ? 0.5 : 1 }}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="client">client</option>
                    </select>
                    {isSelf && <StatusBadge variant="info">you</StatusBadge>}
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: 140 }}>
                      <span>Pw:</span>
                      <code style={{ background: "var(--color-surface)", padding: "2px 6px", borderRadius: 3, border: "1px solid var(--color-border)" }}>
                        {revealedPasswords.has(u.username) ? u.password : "••••••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() => toggleReveal(u.username)}
                        style={{ fontFamily: "var(--font-display)", fontSize: "0.6875rem", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                      >
                        {revealedPasswords.has(u.username) ? "hide" : "show"}
                      </button>
                    </div>
                    <span style={{ flex: 1 }} />
                    {resetPwFor === u.username ? (
                      <>
                        <input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder="New password" autoFocus style={{ ...inputStyle, width: 160, height: 28, fontSize: "0.75rem" }} />
                        <ActionButton variant="primary" size="sm" onClick={handleResetPassword} disabled={!resetPwValue}>Set</ActionButton>
                        <ActionButton variant="ghost" size="sm" onClick={() => { setResetPwFor(null); setResetPwValue("") }}>Cancel</ActionButton>
                      </>
                    ) : (
                      <ActionButton variant="ghost" size="sm" onClick={() => { setResetPwFor(u.username); setResetPwValue("") }}>Reset password</ActionButton>
                    )}
                    {!isSelf && (confirmDeleteUser === u.username ? (
                      <>
                        <ActionButton variant="destructive" size="sm" onClick={() => handleDeleteUser(u.username)}>Delete</ActionButton>
                        <ActionButton variant="ghost" size="sm" onClick={() => setConfirmDeleteUser(null)}>Cancel</ActionButton>
                      </>
                    ) : (
                      <ActionButton variant="ghost" size="sm" onClick={() => setConfirmDeleteUser(u.username)}>Remove</ActionButton>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Data Backup ─── */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          Data Backup
        </h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
          Export all application data as a JSON file or import a previous backup.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <ActionButton variant="primary" size="sm" onClick={handleExportAll}
            iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          >Export All Data</ActionButton>
          <ActionButton variant="secondary" size="sm" onClick={() => importFileRef.current?.click()}
            iconLeft={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 14V6m0 0l-3 3m3-3l3 3M3 3h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          >Import Data</ActionButton>
          <input ref={importFileRef} type="file" accept=".json" onChange={handleImportData} style={{ display: "none" }} />
        </div>
      </div>

      {/* ─── Master Items ─── */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          Master Items ({masterItems.length})
        </h2>
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)", alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="New item name (e.g. Clamp)" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleAddItem()} />
          </div>
          <ActionButton variant="primary" size="sm" onClick={handleAddItem} disabled={!newItemName.trim()}>Add</ActionButton>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {masterItems.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" }}>
              {editingItemId === item.id ? (
                <>
                  <input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} style={{ ...inputStyle, width: 100, height: 28, fontSize: "0.75rem" }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { renameItem(item.id, editItemName); setEditingItemId(null) } }} />
                  <ActionButton variant="primary" size="sm" onClick={() => { renameItem(item.id, editItemName); setEditingItemId(null) }}>OK</ActionButton>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text)" }}>{item.name}</span>
                  <button onClick={() => { setEditingItemId(item.id); setEditItemName(item.name) }} style={{ fontSize: "0.6875rem", color: "var(--color-text-faint)" }}>edit</button>
                  {confirmDeleteItem === item.id ? (
                    <>
                      <button onClick={() => { removeItem(item.id); setConfirmDeleteItem(null) }} style={{ fontSize: "0.6875rem", color: "var(--color-error)" }}>delete</button>
                      <button onClick={() => setConfirmDeleteItem(null)} style={{ fontSize: "0.6875rem", color: "var(--color-text-faint)" }}>no</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteItem(item.id)} style={{ fontSize: "0.6875rem", color: "var(--color-text-faint)" }}>x</button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Master Type Templates ─── */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", flex: 1 }}>
            Master Type Config ({masterTypes.length})
          </h2>
          {masterTypes.length > 0 && (
            <>
              <ActionButton variant="secondary" size="sm" onClick={() => {
                const rows: Record<string, string>[] = []
                for (const mt of masterTypes) {
                  for (const it of mt.items) {
                    const vars = it.variants && it.variants.length > 0 ? it.variants : [null]
                    for (const v of vars) {
                      rows.push({
                        "Type Name": mt.typeName,
                        "Classification": mt.classification || "internal",
                        "Item": it.itemName,
                        "Variant Label": v?.label || "",
                        "Qty": v?.qty ?? it.qty,
                        "Make": v?.make || it.make || "",
                        "Model": v?.model || it.model || "",
                      })
                    }
                  }
                }
                const ws = XLSX.utils.json_to_sheet(rows)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "Master Types")
                XLSX.writeFile(wb, `master_types_${new Date().toISOString().split("T")[0]}.xlsx`)
              }}>Download XLSX</ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => {
                const blob = new Blob([JSON.stringify(masterTypes, null, 2)], { type: "application/json" })
                const a = document.createElement("a")
                a.href = URL.createObjectURL(blob)
                a.download = `master_types_${new Date().toISOString().split("T")[0]}.json`
                a.click()
              }}>JSON</ActionButton>
            </>
          )}
          <ActionButton
            variant="secondary"
            size="sm"
            onClick={() => { setImportStage("pickClassification"); setImportError("") }}
          >
            Upload Config Excel
          </ActionButton>
          {!addingType && (
            <ActionButton variant="primary" size="sm" onClick={() => setAddingType(true)}>+ Add Type</ActionButton>
          )}
        </div>
        <input
          ref={configImportFileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onImportFilePicked}
          style={{ display: "none" }}
        />
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-5)" }}>
          Pre-configure support types here. In projects, just select from this list.
        </p>

        {/* Add new type form */}
        {addingType && (
          <div className="animate-fade-in-up" style={{ padding: "var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "var(--space-4)" }}>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <label style={labelStyle}>Type Name</label>
              <input value={newTypeName} onChange={(e) => { setNewTypeName(e.target.value); setTypeError("") }} placeholder="e.g. L01" style={{ ...inputStyle, maxWidth: 200, fontWeight: 600 }} />
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                  <input type="radio" checked={newTypeClassification === "internal"} onChange={() => setNewTypeClassification("internal")} />
                  Internal
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                  <input type="radio" checked={newTypeClassification === "external"} onChange={() => setNewTypeClassification("external")} />
                  External
                </label>
              </div>
            </div>
            <label style={{ ...labelStyle, marginBottom: "var(--space-2)" }}>Select Items</label>
            {renderItemConfig(newTypeItems, setNewTypeItems)}
            {typeError && <div className="animate-fade-in-down" style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginTop: "var(--space-3)" }}>{typeError}</div>}
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <ActionButton variant="ghost" size="sm" onClick={() => { setAddingType(false); setNewTypeName(""); setNewTypeClassification("internal"); setNewTypeItems([]); setTypeError("") }}>Cancel</ActionButton>
              <ActionButton variant="primary" size="sm" onClick={handleSaveNewType}>Save Type</ActionButton>
            </div>
          </div>
        )}

        {/* Existing types — grouped by classification in two columns */}
        {masterTypes.length === 0 && !addingType && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-4)" }}>No types configured yet.</p>
        )}

        {masterTypes.length > 0 && (() => {
          const internalTypes = masterTypes.filter((t) => (t.classification || "internal") === "internal")
          const externalTypes = masterTypes.filter((t) => (t.classification || "internal") === "external")

          const renderTypeCard = (mt: typeof masterTypes[0]) => {
            const isEditing = editingTypeId === mt.id
            return (
              <div key={mt.id} style={{ padding: "var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "var(--space-3)" }}>
                {isEditing ? (
                  <>
                    <div style={{ marginBottom: "var(--space-3)" }}>
                      <label style={labelStyle}>Type Name</label>
                      <input value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} style={{ ...inputStyle, maxWidth: 200, fontWeight: 600 }} />
                      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                          <input type="radio" checked={editTypeClassification === "internal"} onChange={() => setEditTypeClassification("internal")} />
                          Internal
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                          <input type="radio" checked={editTypeClassification === "external"} onChange={() => setEditTypeClassification("external")} />
                          External
                        </label>
                      </div>
                    </div>
                    <label style={{ ...labelStyle, marginBottom: "var(--space-2)" }}>Items</label>
                    {renderItemConfig(editTypeItems, setEditTypeItems)}
                    {typeError && <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginTop: "var(--space-3)" }}>{typeError}</div>}
                    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                      <ActionButton variant="ghost" size="sm" onClick={() => { setEditingTypeId(null); setTypeError("") }}>Cancel</ActionButton>
                      <ActionButton variant="primary" size="sm" onClick={handleSaveEditType}>Save</ActionButton>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 600, color: "var(--color-text)" }}>{mt.typeName}</span>
                    {mt.items.map((i) => {
                      const hasVars = i.variants && i.variants.length > 0
                      const label = hasVars
                        ? `${i.itemName}: ${i.variants!.map((v) => `${v.label || "?"}=${v.qty || "0"}`).join(", ")}`
                        : `${i.itemName}: ${i.qty}`
                      return <StatusBadge key={i.itemId} variant="info">{label}</StatusBadge>
                    })}
                    <span style={{ flex: 1 }} />
                    <ActionButton variant="ghost" size="sm" onClick={() => startEditType(mt.id)}>Edit</ActionButton>
                    {confirmDeleteType === mt.id ? (
                      <>
                        <ActionButton variant="destructive" size="sm" onClick={() => { removeMasterType(mt.id); setConfirmDeleteType(null) }}>Delete</ActionButton>
                        <ActionButton variant="ghost" size="sm" onClick={() => setConfirmDeleteType(null)}>Cancel</ActionButton>
                      </>
                    ) : (
                      <ActionButton variant="ghost" size="sm" onClick={() => setConfirmDeleteType(mt.id)}>Remove</ActionButton>
                    )}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-primary)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-primary)" }}>Internal</span>
                  <StatusBadge variant="info">{internalTypes.length}</StatusBadge>
                </div>
                {internalTypes.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-3)" }}>No internal types.</p>
                ) : (
                  internalTypes.map(renderTypeCard)
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-warning)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-warning)" }}>External</span>
                  <StatusBadge variant="warning">{externalTypes.length}</StatusBadge>
                </div>
                {externalTypes.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-3)" }}>No external types.</p>
                ) : (
                  externalTypes.map(renderTypeCard)
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ─── PDF Template ─── */}
      <div style={{ ...cardStyle }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
          PDF Template
        </h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-5)" }}>
          Customize the header, footer, and primary color used when generating PDF documents.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label style={labelStyle}>Header Text</label>
            <input
              value={pdfConfig.headerText}
              onChange={(e) => updatePdfConfig({ headerText: e.target.value })}
              placeholder="Support MTO"
              style={{ ...inputStyle, maxWidth: 400 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Footer Text</label>
            <input
              value={pdfConfig.footerText}
              onChange={(e) => updatePdfConfig({ footerText: e.target.value })}
              placeholder="Support MTO Generator"
              style={{ ...inputStyle, maxWidth: 400 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Primary Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <input
                type="color"
                value={pdfConfig.primaryColor}
                onChange={(e) => updatePdfConfig({ primaryColor: e.target.value })}
                style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", background: "var(--color-surface)" }}
              />
              <input
                value={pdfConfig.primaryColor}
                onChange={(e) => updatePdfConfig({ primaryColor: e.target.value })}
                placeholder="#1F3CA8"
                style={{ ...inputStyle, maxWidth: 120, fontFamily: "monospace" }}
              />
            </div>
          </div>

          {/* Logos — rendered at the top corners of every generated PDF.
              No built-in fallback: upload a file or the corner stays blank. */}
          <div>
            <label style={labelStyle}>Logos (top corners of every PDF)</label>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: -4, marginBottom: "var(--space-3)" }}>
              PNG / JPG / WEBP. Keep each file under ~500 KB for fast PDF generation.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-4)" }}>
              {[
                { side: "left" as const, label: "Top-Left Logo", value: pdfConfig.leftLogoDataUrl, onChange: (dataUrl: string) => updatePdfConfig({ leftLogoDataUrl: dataUrl }) },
                { side: "right" as const, label: "Top-Right Logo", value: pdfConfig.rightLogoDataUrl, onChange: (dataUrl: string) => updatePdfConfig({ rightLogoDataUrl: dataUrl }) },
              ].map((slot) => (
                <div key={slot.side} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", background: "var(--color-surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)" }}>{slot.label}</span>
                    {slot.value && (
                      <button
                        type="button"
                        onClick={() => slot.onChange("")}
                        style={{ fontFamily: "var(--font-display)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-error)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{
                    height: 96, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--color-surface)", borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--color-border)", marginBottom: "var(--space-2)",
                    overflow: "hidden",
                  }}>
                    {slot.value ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slot.value} alt={slot.label} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
                        No logo — corner will stay blank in the PDF
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (!file) return
                      if (file.size > 1_000_000) {
                        alert("Logo is larger than 1 MB. Please compress it first.")
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () => {
                        const result = typeof reader.result === "string" ? reader.result : ""
                        if (result) slot.onChange(result)
                      }
                      reader.readAsDataURL(file)
                    }}
                    style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Master Config Excel Import Modal ─── */}
      {importStage !== "closed" && (
        <div
          className="animate-fade-in"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400 }}
          onClick={() => { if (importStage !== "applying") closeImport() }}
        >
          <div
            className="animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              boxShadow: "var(--shadow-xl)",
              maxWidth: 720, width: "92%",
              maxHeight: "85vh", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text)" }}>
                Import Master Config from Excel
              </h2>
              {importStage !== "applying" && (
                <button onClick={closeImport} style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "var(--color-text-faint)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>×</button>
              )}
            </div>

            {importStage === "pickClassification" && (
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                  Step 1 — pick the classification this file is for. Every type in the file will be imported under this classification. Existing master types and items are never deleted; conflicts are shown one-by-one in the next step.
                </p>
                <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                  {(["internal", "external"] as const).map((opt) => (
                    <label key={opt} style={{
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      padding: "var(--space-2) var(--space-4)",
                      background: importClassification === opt ? "var(--color-primary-soft)" : "var(--color-surface-2)",
                      border: importClassification === opt ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)", cursor: "pointer",
                      fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600,
                      color: importClassification === opt ? "var(--color-primary)" : "var(--color-text-muted)",
                      textTransform: "capitalize",
                    }}>
                      <input type="radio" checked={importClassification === opt} onChange={() => setImportClassification(opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
                {importError && (
                  <pre style={{ padding: "var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginBottom: "var(--space-3)", whiteSpace: "pre-wrap" }}>{importError}</pre>
                )}
                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                  <ActionButton variant="ghost" size="sm" onClick={closeImport}>Cancel</ActionButton>
                  <ActionButton variant="primary" size="sm" onClick={() => configImportFileRef.current?.click()}>
                    Pick Excel File
                  </ActionButton>
                </div>
              </div>
            )}

            {importStage === "analyzing" && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>Analyzing file…</p>
            )}

            {importStage === "review" && importDryRun && (
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                  Step 2 — review and choose which existing types to overwrite. Anything not ticked is left alone.
                </p>
                {importParsed && importParsed.warnings.length > 0 && (
                  <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-warning-soft)", borderLeft: "3px solid var(--color-warning)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text)", marginBottom: "var(--space-3)" }}>
                    <strong>Warnings while parsing:</strong>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {importParsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
                  <StatusBadge variant="success">{importDryRun.newTypes.length} new types</StatusBadge>
                  <StatusBadge variant="warning">{importDryRun.conflictTypes.length} conflicts</StatusBadge>
                  <StatusBadge variant="info">{importDryRun.newItems.length} new items</StatusBadge>
                  <StatusBadge variant="info">{importDryRun.existingItems.length} existing items reused</StatusBadge>
                </div>

                {importDryRun.newTypes.length > 0 && (
                  <details style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-success-soft)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-3)" }}>
                    <summary style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", cursor: "pointer" }}>New types ({importDryRun.newTypes.length}) — will be added</summary>
                    <p style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{importDryRun.newTypes.join(", ")}</p>
                  </details>
                )}

                {importDryRun.newItems.length > 0 && (
                  <details style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-primary-soft)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-3)" }}>
                    <summary style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", cursor: "pointer" }}>New items ({importDryRun.newItems.length}) — will be added to Master Items</summary>
                    <p style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{importDryRun.newItems.join(", ")}</p>
                  </details>
                )}

                {importDryRun.conflictTypes.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                    No type-name conflicts. Confirm to import everything as new.
                  </p>
                ) : (
                  <div style={{ marginBottom: "var(--space-3)" }}>
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)" }}>
                        Conflicting types — tick to overwrite
                      </span>
                      <ActionButton variant="ghost" size="sm" onClick={() => setImportOverwrite(new Set(importDryRun.conflictTypes.map((c) => c.typeName)))}>Select all</ActionButton>
                      <ActionButton variant="ghost" size="sm" onClick={() => setImportOverwrite(new Set())}>Clear</ActionButton>
                    </div>
                    {importDryRun.conflictTypes.map((c) => (
                      <div key={c.typeName} style={{ padding: "var(--space-3)", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", marginBottom: "var(--space-2)" }}>
                          <input type="checkbox" checked={importOverwrite.has(c.typeName)} onChange={() => toggleOverwrite(c.typeName)} style={{ accentColor: "var(--color-primary)" }} />
                          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text)" }}>Type {c.typeName}</span>
                          {c.diff.classificationChanged && (
                            <StatusBadge variant="warning">classification: {c.existing.classification} → {c.incoming.classification}</StatusBadge>
                          )}
                          {c.diff.plateFlagsWillReset && (
                            <StatusBadge variant="warning">plate flags will reset</StatusBadge>
                          )}
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.75rem" }}>
                          <div>
                            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Existing</div>
                            {c.existing.items.length === 0 ? <span style={{ color: "var(--color-text-faint)" }}>(no items)</span> : c.existing.items.map((it, i) => (
                              <div key={i} style={{ marginBottom: 2 }}>
                                {it.itemName} · qty {it.qty || "—"} · {it.make || "—"} / {it.model || "—"}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Incoming (from file)</div>
                            {c.incoming.items.map((it, i) => (
                              <div key={i} style={{ marginBottom: 2 }}>
                                {it.itemName} · qty {it.qty || "—"} · {it.make || "—"} / {it.model || "—"}
                              </div>
                            ))}
                          </div>
                        </div>
                        {(c.diff.addedItems.length > 0 || c.diff.removedItems.length > 0 || c.diff.changedItems.length > 0) && (
                          <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                            {c.diff.addedItems.length > 0 && <div><strong style={{ color: "var(--color-success)" }}>+ added:</strong> {c.diff.addedItems.join(", ")}</div>}
                            {c.diff.removedItems.length > 0 && <div><strong style={{ color: "var(--color-error)" }}>− removed:</strong> {c.diff.removedItems.join(", ")}</div>}
                            {c.diff.changedItems.map((ch, i) => (
                              <div key={i}><strong style={{ color: "var(--color-warning)" }}>~ changed {ch.itemName}:</strong> qty {ch.before.qty}→{ch.after.qty}, model {ch.before.model}→{ch.after.model}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {importError && (
                  <pre style={{ padding: "var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginBottom: "var(--space-3)", whiteSpace: "pre-wrap" }}>{importError}</pre>
                )}
                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                  <ActionButton variant="ghost" size="sm" onClick={closeImport}>Cancel</ActionButton>
                  <ActionButton variant="primary" size="sm" onClick={applyImport}>
                    Apply ({importDryRun.newTypes.length} new + {importOverwrite.size} overwrite)
                  </ActionButton>
                </div>
              </div>
            )}

            {importStage === "applying" && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>Applying changes…</p>
            )}

            {importStage === "result" && importResult && (
              <div>
                <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-success-soft)", borderLeft: "3px solid var(--color-success)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", marginBottom: "var(--space-3)" }}>
                  Import complete.
                </div>
                <ul style={{ paddingLeft: 18, fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text)", marginBottom: "var(--space-4)" }}>
                  <li>{importResult.itemsAdded} new master items added</li>
                  <li>{importResult.typesAdded} new types added</li>
                  <li>{importResult.typesOverwritten} existing types overwritten</li>
                  <li>{importResult.typesSkipped} conflicting types left untouched</li>
                </ul>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ActionButton variant="primary" size="sm" onClick={closeImport}>Close</ActionButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
