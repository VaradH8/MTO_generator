"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useProjects } from "@/context/ProjectContext"
import { useSettings } from "@/context/SettingsContext"
import { useAuth } from "@/context/AuthContext"
import ActionButton from "@/components/ActionButton"
import StatusBadge from "@/components/StatusBadge"
import type { SupportTypeConfig, TypeItemConfig, MasterTypeItem } from "@/types/support"

export default function ProjectsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { projects, activeProject, setActiveProjectId, createProject, updateProject, deleteProject } = useProjects()
  const { masterItems, masterTypes, addMasterType } = useSettings()
  const [newClientName, setNewClientName] = useState("")
  const [newSupportRange, setNewSupportRange] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRange, setEditRange] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteInput, setDeleteInput] = useState("")
  const [editTypes, setEditTypes] = useState<SupportTypeConfig[]>([])
  const [saveError, setSaveError] = useState("")

  // "Add New" type inline state
  const [addingCustom, setAddingCustom] = useState(false)
  const [customTypeName, setCustomTypeName] = useState("")
  const [customClassification, setCustomClassification] = useState<"internal" | "external">("internal")
  const [customWithPlate, setCustomWithPlate] = useState(false)
  const [customWithoutPlate, setCustomWithoutPlate] = useState(false)
  const [customItems, setCustomItems] = useState<TypeItemConfig[]>([])
  const [saveToMaster, setSaveToMaster] = useState(false)
  const [customError, setCustomError] = useState("")

  const handleCreate = () => {
    if (!newClientName.trim()) return
    const range = parseInt(newSupportRange) || 0
    const project = createProject(newClientName.trim(), user?.username, range)
    setNewClientName("")
    setNewSupportRange("")
    setEditingId(project.id)
    setEditRange(String(range || ""))
    setEditTypes([])
  }

  const startEdit = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    setEditingId(projectId)
    setEditRange(String(project.supportRange || ""))
    setEditTypes(project.supportTypes.map((t) => ({ ...t, items: t.items?.map((i) => ({ ...i })) || [] })))
  }

  const saveEdit = () => {
    if (!editingId) return
    const cleaned = editTypes.filter((t) => t.typeName.trim() !== "")
    const keys = cleaned.map((t) => `${t.typeName.trim().toLowerCase()}:${t.classification || "internal"}`)
    const dupeIdx = keys.findIndex((k, i) => keys.indexOf(k) !== i)
    if (dupeIdx !== -1) { setSaveError(`Duplicate type: ${cleaned[dupeIdx].typeName} (${cleaned[dupeIdx].classification})`); return }
    setSaveError("")
    updateProject(editingId, { supportTypes: cleaned, supportRange: parseInt(editRange) || 0 })
    setEditingId(null)
    setEditTypes([])
  }

  // Add type from master dropdown
  const handleAddFromMaster = (masterTypeId: string) => {
    const mt = masterTypes.find((t) => t.id === masterTypeId)
    if (!mt) return
    // Check not already added (same name + same classification)
    if (editTypes.some((t) => t.typeName === mt.typeName && (t.classification || "internal") === (mt.classification || "internal"))) return
    const newType: SupportTypeConfig = {
      typeName: mt.typeName,
      classification: mt.classification || "internal",
      withPlate: !!mt.withPlate,
      withoutPlate: !!mt.withoutPlate,
      items: mt.items.map((i: MasterTypeItem) => ({
        itemId: i.itemId,
        itemName: i.itemName,
        qty: i.qty,
        make: i.make,
        model: i.model,
        variants: i.variants ? i.variants.map((v) => ({ ...v })) : undefined,
      })),
    }
    setEditTypes((prev) => [...prev, newType])
  }

  // Toggle item for custom type
  const toggleCustomItem = (itemId: string, itemName: string) => {
    const exists = customItems.find((i) => i.itemId === itemId)
    if (exists) {
      setCustomItems(customItems.filter((i) => i.itemId !== itemId))
    } else {
      setCustomItems([...customItems, { itemId, itemName, qty: "", make: "", model: "" }])
    }
  }

  const updateCustomItemField = (itemId: string, field: keyof TypeItemConfig, value: string) => {
    setCustomItems(customItems.map((i) => i.itemId === itemId ? { ...i, [field]: value } : i))
  }

  const handleSaveCustomType = () => {
    if (!customTypeName.trim()) { setCustomError("Type name required"); return }
    if (editTypes.some((t) => t.typeName.toLowerCase() === customTypeName.trim().toLowerCase() && (t.classification || "internal") === customClassification)) { setCustomError(`Already added as ${customClassification}`); return }
    for (const item of customItems) {
      if (!item.qty?.trim()) { setCustomError(`${item.itemName} needs qty`); return }
    }
    setCustomError("")

    // Add to project types
    setEditTypes((prev) => [...prev, {
      typeName: customTypeName.trim(),
      classification: customClassification,
      withPlate: customWithPlate,
      withoutPlate: customWithoutPlate,
      items: customItems,
    }])

    // Optionally save to master config
    if (saveToMaster) {
      addMasterType({
        typeName: customTypeName.trim(),
        classification: customClassification,
        withPlate: customWithPlate,
        withoutPlate: customWithoutPlate,
        items: customItems.map((i) => ({
          itemId: i.itemId, itemName: i.itemName, qty: i.qty, make: i.make, model: i.model,
          variants: i.variants ? i.variants.map((v) => ({ ...v })) : undefined,
        })),
      })
    }

    setAddingCustom(false)
    setCustomTypeName("")
    setCustomClassification("internal")
    setCustomWithPlate(false)
    setCustomWithoutPlate(false)
    setCustomItems([])
    setSaveToMaster(false)
  }

  const removeType = (index: number) => {
    setEditTypes((prev) => prev.filter((_, i) => i !== index))
  }

  const inputStyle: React.CSSProperties = {
    height: 36, padding: "0 var(--space-3)", fontFamily: "var(--font-body)",
    fontSize: "0.8125rem", color: "var(--color-text)", background: "var(--color-surface)",
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

  // Available master types not yet added
  const availableMasterTypes = masterTypes.filter((mt) => !editTypes.some((t) => t.typeName === mt.typeName && (t.classification || "internal") === (mt.classification || "internal")))

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>Projects</h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "var(--color-text-muted)", marginBottom: "var(--space-8)" }}>Manage projects and assign support types.</p>

      {/* Create */}
      <div style={{ ...cardStyle, marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>New Project</h2>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Client name" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          </div>
          <div style={{ width: 140 }}>
            <input type="number" min="0" value={newSupportRange} onChange={(e) => setNewSupportRange(e.target.value)} placeholder="Support range" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          </div>
          <ActionButton variant="primary" size="sm" onClick={handleCreate} disabled={!newClientName.trim()}>Create</ActionButton>
        </div>
      </div>

      {/* Project list */}
      {projects.map((project) => {
        const isActive = project.id === activeProject?.id
        const isEditing = project.id === editingId

        return (
          <div key={project.id} style={{ ...cardStyle, marginBottom: "var(--space-4)", borderLeft: isActive ? "3px solid var(--color-primary)" : undefined }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: isEditing ? "var(--space-5)" : 0, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text)" }}>{project.clientName}</span>
              <StatusBadge variant="info">by {project.createdBy || "unknown"}</StatusBadge>
              <StatusBadge variant="info">{project.supportTypes.length} types</StatusBadge>
              {project.supportRange > 0 && <StatusBadge variant="warning">Range: {project.supportRange}</StatusBadge>}
              {isActive && <StatusBadge variant="success">Active</StatusBadge>}
              <span style={{ flex: 1 }} />
              {!isEditing && (
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <ActionButton variant="primary" size="sm" onClick={() => router.push(`/projects/${project.id}`)}>Open</ActionButton>
                  <ActionButton variant="secondary" size="sm" onClick={() => router.push(`/upload?project=${project.id}`)}>Upload Excel</ActionButton>
                  {!isActive && <ActionButton variant="secondary" size="sm" onClick={() => setActiveProjectId(project.id)}>Set Active</ActionButton>}
                  <ActionButton variant="secondary" size="sm" onClick={() => startEdit(project.id)}>Configure</ActionButton>
                  {confirmDelete === project.id ? (
                    <div className="animate-fade-in" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)" }}>Type "delete" to confirm:</span>
                      <input
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="delete"
                        autoFocus
                        style={{ width: 80, height: 28, padding: "0 var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-text)", background: "var(--color-surface)", border: "1px solid var(--color-error)", borderRadius: "var(--radius-sm)", outline: "none" }}
                        onKeyDown={(e) => { if (e.key === "Enter" && deleteInput.toLowerCase() === "delete") { deleteProject(project.id); setConfirmDelete(null); setDeleteInput("") } if (e.key === "Escape") { setConfirmDelete(null); setDeleteInput("") } }}
                      />
                      <ActionButton variant="destructive" size="sm" disabled={deleteInput.toLowerCase() !== "delete"} onClick={() => { deleteProject(project.id); setConfirmDelete(null); setDeleteInput("") }}>Confirm</ActionButton>
                      <ActionButton variant="ghost" size="sm" onClick={() => { setConfirmDelete(null); setDeleteInput("") }}>Cancel</ActionButton>
                    </div>
                  ) : (
                    <ActionButton variant="ghost" size="sm" onClick={() => { setConfirmDelete(project.id); setDeleteInput("") }}>Delete</ActionButton>
                  )}
                </div>
              )}
            </div>

            {/* Type config editor */}
            {isEditing && (
              <div>
                {/* Support Range */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label style={labelStyle}>Support Range (total expected)</label>
                  <input type="number" min="0" value={editRange} onChange={(e) => setEditRange(e.target.value)} placeholder="e.g. 100" style={{ ...inputStyle, maxWidth: 160 }} />
                </div>

                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text)", marginBottom: "var(--space-4)" }}>Support Types</h3>

                {/* Current types */}
                {editTypes.map((type, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text)" }}>{type.typeName}</span>
                    {type.withPlate && <StatusBadge variant="info">With Plate</StatusBadge>}
                    {type.withoutPlate && <StatusBadge variant="info">Without Plate</StatusBadge>}
                    {type.items.map((i) => (
                      <StatusBadge key={i.itemId} variant="info">{i.itemName}: {i.qty}</StatusBadge>
                    ))}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => removeType(idx)} style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "var(--color-error)" }}>Remove</button>
                  </div>
                ))}

                {/* Add type dropdown */}
                {!addingCustom && (
                  <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "end", marginTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div style={{ flex: 1, maxWidth: 300 }}>
                      <label style={labelStyle}>Add Type</label>
                      <select
                        onChange={(e) => {
                          if (e.target.value === "__new__") { setAddingCustom(true) }
                          else if (e.target.value) { handleAddFromMaster(e.target.value) }
                          e.target.value = ""
                        }}
                        style={{ ...inputStyle, cursor: "pointer" }}
                        defaultValue=""
                      >
                        <option value="">Select type...</option>
                        {availableMasterTypes.map((mt) => (
                          <option key={mt.id} value={mt.id}>{mt.typeName} ({mt.items.map((i) => i.itemName).join(", ")})</option>
                        ))}
                        <option value="__new__">+ Add New Type</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Custom type form */}
                {addingCustom && (
                  <div className="animate-fade-in-up" style={{ padding: "var(--space-4)", background: "var(--color-surface-offset)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div style={{ marginBottom: "var(--space-3)" }}>
                      <label style={labelStyle}>Type Name</label>
                      <input value={customTypeName} onChange={(e) => { setCustomTypeName(e.target.value); setCustomError("") }} placeholder="e.g. RF01" style={{ ...inputStyle, maxWidth: 200, fontWeight: 600 }} />
                      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                          <input type="radio" checked={customClassification === "internal"} onChange={() => setCustomClassification("internal")} />
                          Internal
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}>
                          <input type="radio" checked={customClassification === "external"} onChange={() => setCustomClassification("external")} />
                          External
                        </label>
                        <span style={{ width: 1, height: 18, background: "var(--color-border)" }} />
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                          <input type="checkbox" checked={customWithPlate} onChange={() => setCustomWithPlate((v) => !v)} style={{ accentColor: "var(--color-primary)" }} />
                          With Plate
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                          <input type="checkbox" checked={customWithoutPlate} onChange={() => setCustomWithoutPlate((v) => !v)} style={{ accentColor: "var(--color-primary)" }} />
                          Without Plate
                        </label>
                      </div>
                    </div>
                    <label style={{ ...labelStyle, marginBottom: "var(--space-2)" }}>Select Items</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                      {masterItems.map((mi) => {
                        const sel = customItems.some((i) => i.itemId === mi.id)
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
                            <input type="checkbox" checked={sel} onChange={() => toggleCustomItem(mi.id, mi.name)} style={{ accentColor: "var(--color-primary)" }} />
                            {mi.name}
                          </label>
                        )
                      })}
                    </div>
                    {customItems.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                        {customItems.map((item) => (
                          <div key={item.itemId} style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 1fr", gap: "var(--space-2)", padding: "var(--space-2)", background: "var(--color-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", alignItems: "end" }}>
                            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text)", paddingTop: 6 }}>{item.itemName}</div>
                            <input type="number" min="0" value={item.qty} onChange={(e) => updateCustomItemField(item.itemId, "qty", e.target.value)} placeholder="Qty" style={{ ...inputStyle, height: 30, fontSize: "0.75rem", textAlign: "center" }} />
                            <input value={item.make} onChange={(e) => updateCustomItemField(item.itemId, "make", e.target.value)} placeholder="Make" style={{ ...inputStyle, height: 30, fontSize: "0.75rem" }} />
                            <input value={item.model} onChange={(e) => updateCustomItemField(item.itemId, "model", e.target.value)} placeholder="Model" style={{ ...inputStyle, height: 30, fontSize: "0.75rem" }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Save to master checkbox */}
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                      <input type="checkbox" checked={saveToMaster} onChange={(e) => setSaveToMaster(e.target.checked)} style={{ accentColor: "var(--color-primary)" }} />
                      Also save to master type config (Settings)
                    </label>
                    {customError && <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-error-soft)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--color-error)", marginBottom: "var(--space-3)" }}>{customError}</div>}
                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                      <ActionButton variant="ghost" size="sm" onClick={() => { setAddingCustom(false); setCustomTypeName(""); setCustomClassification("internal"); setCustomItems([]); setCustomError("") }}>Cancel</ActionButton>
                      <ActionButton variant="primary" size="sm" onClick={handleSaveCustomType}>Add Type</ActionButton>
                    </div>
                  </div>
                )}

                {/* Validation error + save */}
                {saveError && <div className="animate-fade-in-down" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-error-soft)", borderLeft: "3px solid var(--color-error)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-error)", marginTop: "var(--space-3)" }}>{saveError}</div>}
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                  <span style={{ flex: 1 }} />
                  <ActionButton variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditTypes([]); setSaveError(""); setAddingCustom(false) }}>Cancel</ActionButton>
                  <ActionButton variant="primary" size="sm" onClick={saveEdit}>Save Configuration</ActionButton>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
