"use client"

import { useState, useRef } from "react"
import { useSettings } from "@/context/SettingsContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import type { MasterTypeItem, ItemVariant } from "@/types/support"

export default function SettingsPage() {
  const { masterItems, addItem, removeItem, renameItem, masterTypes, addMasterType, updateMasterType, removeMasterType, pdfConfig, updatePdfConfig } = useSettings()

  // Item state
  const [newItemName, setNewItemName] = useState("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemName, setEditItemName] = useState("")
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null)

  // Type state
  const [addingType, setAddingType] = useState(false)
  const [newTypeName, setNewTypeName] = useState("")
  const [newTypeItems, setNewTypeItems] = useState<MasterTypeItem[]>([])
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editTypeName, setEditTypeName] = useState("")
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
    if (masterTypes.some((t) => t.typeName.toLowerCase() === newTypeName.trim().toLowerCase())) { setTypeError("Type already exists"); return }
    const err = validateItemQtys(newTypeItems)
    if (err) { setTypeError(err); return }
    setTypeError("")
    addMasterType({ typeName: newTypeName.trim(), items: newTypeItems })
    setAddingType(false)
    setNewTypeName("")
    setNewTypeItems([])
  }

  const startEditType = (id: string) => {
    const t = masterTypes.find((mt) => mt.id === id)
    if (!t) return
    setEditingTypeId(id)
    setEditTypeName(t.typeName)
    setEditTypeItems(t.items.map((i) => ({ ...i })))
  }

  const handleSaveEditType = () => {
    if (!editingTypeId || !editTypeName.trim()) return
    const err = validateItemQtys(editTypeItems)
    if (err) { setTypeError(err); return }
    setTypeError("")
    updateMasterType(editingTypeId, { typeName: editTypeName.trim(), items: editTypeItems })
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
          return (
            <label key={mi.id} style={{
              display: "flex", alignItems: "center", gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              background: sel ? "var(--color-primary-soft)" : "var(--color-surface)",
              border: sel ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)", cursor: "pointer",
              fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 500,
              color: sel ? "var(--color-primary)" : "var(--color-text-muted)",
            }}>
              <input type="checkbox" checked={sel} onChange={() => toggleTypeItem(items, setItems, mi.id, mi.name)} style={{ accentColor: "var(--color-primary)" }} />
              {mi.name}
            </label>
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
                ? { ...i, variants: [...(i.variants || []), { label: "", qty: "" }] }
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
                {hasVariants && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingLeft: "var(--space-3)", borderLeft: "2px solid var(--color-primary-soft)" }}>
                    {(item.variants || []).map((v, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px auto", gap: "var(--space-2)", alignItems: "end" }}>
                        <div>
                          <label style={labelStyle}>Size label</label>
                          <input value={v.label} onChange={(e) => updateVariant(idx, "label", e.target.value)} placeholder="e.g. 2(50,50)" style={{ ...inputStyle, height: 32, fontSize: "0.75rem" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Qty</label>
                          <input type="number" min="0" value={v.qty} onChange={(e) => updateVariant(idx, "qty", e.target.value)} placeholder="0" style={{ ...inputStyle, height: 32, fontSize: "0.75rem", textAlign: "center" }} />
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
          {!addingType && (
            <ActionButton variant="primary" size="sm" onClick={() => setAddingType(true)}>+ Add Type</ActionButton>
          )}
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-5)" }}>
          Pre-configure support types here. In projects, just select from this list.
        </p>

        {/* Add new type form */}
        {addingType && (
          <div className="animate-fade-in-up" style={{ padding: "var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: "var(--space-4)" }}>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <label style={labelStyle}>Type Name</label>
              <input value={newTypeName} onChange={(e) => { setNewTypeName(e.target.value); setTypeError("") }} placeholder="e.g. L01" style={{ ...inputStyle, maxWidth: 200, fontWeight: 600 }} />
            </div>
            <label style={{ ...labelStyle, marginBottom: "var(--space-2)" }}>Select Items</label>
            {renderItemConfig(newTypeItems, setNewTypeItems)}
            {typeError && <div className="animate-fade-in-down" style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginTop: "var(--space-3)" }}>{typeError}</div>}
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <ActionButton variant="ghost" size="sm" onClick={() => { setAddingType(false); setNewTypeName(""); setNewTypeItems([]); setTypeError("") }}>Cancel</ActionButton>
              <ActionButton variant="primary" size="sm" onClick={handleSaveNewType}>Save Type</ActionButton>
            </div>
          </div>
        )}

        {/* Existing types */}
        {masterTypes.length === 0 && !addingType && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-faint)", textAlign: "center", padding: "var(--space-4)" }}>No types configured yet.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {masterTypes.map((mt) => {
            const isEditing = editingTypeId === mt.id
            return (
              <div key={mt.id} style={{ padding: "var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                {isEditing ? (
                  <>
                    <div style={{ marginBottom: "var(--space-3)" }}>
                      <label style={labelStyle}>Type Name</label>
                      <input value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} style={{ ...inputStyle, maxWidth: 200, fontWeight: 600 }} />
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
          })}
        </div>
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
        </div>
      </div>
    </div>
  )
}
