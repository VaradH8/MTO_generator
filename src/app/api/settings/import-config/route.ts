import { NextRequest, NextResponse } from "next/server"
import pool, { ensureMigrations } from "@/lib/db"

/**
 * Master config Excel importer — two-phase, never destructive.
 *
 *   POST { mode: "dryRun", classification, types[] }
 *     → returns { newItems, existingItems, newTypes, conflictTypes[] }
 *       where each conflictType carries the existing rows + incoming rows +
 *       a structured diff so the client can show the user exactly what
 *       changes per type before they pick which to overwrite.
 *
 *   POST { mode: "apply", classification, types[], overwriteTypeNames[] }
 *     → applies inside a transaction:
 *       - master_items: any item names not in master_items are inserted; existing
 *         rows are reused by name (never touched).
 *       - master_types: types not in DB are inserted. Types in DB and in
 *         overwriteTypeNames are wiped (their master_type_items deleted) and
 *         re-inserted with the file's classification + items. Types NOT in
 *         overwriteTypeNames are left untouched.
 *
 * Plate flags reset to false on every (re-)imported type because the file
 * doesn't carry plate info — the user re-ticks via the Master Types UI.
 */

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

interface IncomingItem { itemName: string; qty: string; make: string; model: string }
interface IncomingType { typeName: string; items: IncomingItem[] }

interface ExistingItemRow {
  itemName: string
  qty: string
  make: string
  model: string
  withPlate: boolean
  withoutPlate: boolean
}

interface ItemDiffChange {
  itemName: string
  before: { qty: string; make: string; model: string }
  after: { qty: string; make: string; model: string }
}

interface ConflictType {
  typeName: string
  existing: { classification: string; items: ExistingItemRow[] }
  incoming: { classification: string; items: IncomingItem[] }
  diff: {
    addedItems: string[]
    removedItems: string[]
    changedItems: ItemDiffChange[]
    classificationChanged: boolean
    plateFlagsWillReset: boolean
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureMigrations()
    const body = await req.json()
    const classification: "internal" | "external" =
      body.classification === "external" ? "external" : "internal"
    const types: IncomingType[] = Array.isArray(body.types) ? body.types : []
    const mode: "dryRun" | "apply" = body.mode === "apply" ? "apply" : "dryRun"
    const overwriteSet = new Set<string>(
      Array.isArray(body.overwriteTypeNames) ? body.overwriteTypeNames.map((s: unknown) => String(s)) : []
    )

    if (types.length === 0) {
      return NextResponse.json({ error: "types[] is empty" }, { status: 400 })
    }

    // Collect every distinct item name referenced.
    const allIncomingItemNames = new Set<string>()
    for (const t of types) for (const i of t.items) allIncomingItemNames.add(i.itemName)
    const itemNamesArr = Array.from(allIncomingItemNames)

    if (mode === "dryRun") {
      // 1. Items: which names are already in master_items vs new.
      const { rows: existingItemRows } = await pool.query<{ name: string }>(
        `SELECT name FROM master_items WHERE name = ANY($1::text[])`,
        [itemNamesArr]
      )
      const existingItemNames = new Set(existingItemRows.map((r) => r.name))
      const newItems = itemNamesArr.filter((n) => !existingItemNames.has(n))

      // 2. Types: split into new vs conflicts. For conflicts pull the existing
      //    items so the client can render a real diff.
      const incomingTypeNames = types.map((t) => t.typeName)
      const { rows: existingTypeRows } = await pool.query<{ id: string; type_name: string; classification: string }>(
        `SELECT id, type_name, classification FROM master_types WHERE type_name = ANY($1::text[])`,
        [incomingTypeNames]
      )
      const existingByName = new Map<string, { id: string; classification: string }>()
      for (const r of existingTypeRows) existingByName.set(r.type_name, { id: r.id, classification: r.classification })

      const newTypes: string[] = []
      const conflictTypes: ConflictType[] = []
      for (const inc of types) {
        const existing = existingByName.get(inc.typeName)
        if (!existing) { newTypes.push(inc.typeName); continue }
        const { rows: itemRows } = await pool.query(
          `SELECT item_name, qty, make, model, with_plate, without_plate
           FROM master_type_items WHERE master_type_id = $1`,
          [existing.id]
        )
        const exItems: ExistingItemRow[] = itemRows.map((i: { item_name: string; qty: string; make: string; model: string; with_plate: boolean; without_plate: boolean }) => ({
          itemName: i.item_name,
          qty: i.qty ?? "",
          make: i.make ?? "",
          model: i.model ?? "",
          withPlate: !!i.with_plate,
          withoutPlate: !!i.without_plate,
        }))

        const exNames = new Set(exItems.map((x) => x.itemName))
        const incNames = new Set(inc.items.map((x) => x.itemName))
        const addedItems = inc.items.filter((x) => !exNames.has(x.itemName)).map((x) => x.itemName)
        const removedItems = exItems.filter((x) => !incNames.has(x.itemName)).map((x) => x.itemName)
        const changedItems: ItemDiffChange[] = []
        for (const incItem of inc.items) {
          const ex = exItems.find((x) => x.itemName === incItem.itemName)
          if (!ex) continue
          if (ex.qty !== incItem.qty || ex.make !== incItem.make || ex.model !== incItem.model) {
            changedItems.push({
              itemName: incItem.itemName,
              before: { qty: ex.qty, make: ex.make, model: ex.model },
              after: { qty: incItem.qty, make: incItem.make, model: incItem.model },
            })
          }
        }

        conflictTypes.push({
          typeName: inc.typeName,
          existing: { classification: existing.classification, items: exItems },
          incoming: { classification, items: inc.items },
          diff: {
            addedItems,
            removedItems,
            changedItems,
            classificationChanged: existing.classification !== classification,
            plateFlagsWillReset: exItems.some((i) => i.withPlate || i.withoutPlate),
          },
        })
      }

      return NextResponse.json({
        mode: "dryRun",
        newItems,
        existingItems: itemNamesArr.filter((n) => existingItemNames.has(n)),
        newTypes,
        conflictTypes,
      })
    }

    // mode === "apply" — transactional upsert.
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      // Resolve / insert master_items by name. Existing rows are kept verbatim.
      const { rows: existingItemRows } = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM master_items WHERE name = ANY($1::text[])`,
        [itemNamesArr]
      )
      const itemIdByName = new Map<string, string>()
      for (const r of existingItemRows) itemIdByName.set(r.name, r.id)
      let itemsAdded = 0
      for (const name of itemNamesArr) {
        if (itemIdByName.has(name)) continue
        const id = generateId()
        await client.query(
          `INSERT INTO master_items (id, name) VALUES ($1, $2)`,
          [id, name]
        )
        itemIdByName.set(name, id)
        itemsAdded++
      }

      // Upsert types.
      const { rows: existingTypeRows } = await client.query<{ id: string; type_name: string }>(
        `SELECT id, type_name FROM master_types WHERE type_name = ANY($1::text[])`,
        [types.map((t) => t.typeName)]
      )
      const existingTypeIdByName = new Map<string, string>()
      for (const r of existingTypeRows) existingTypeIdByName.set(r.type_name, r.id)

      let typesAdded = 0
      let typesOverwritten = 0
      let typesSkipped = 0
      for (const inc of types) {
        const existingId = existingTypeIdByName.get(inc.typeName)

        if (!existingId) {
          // Insert new type + items.
          const id = generateId()
          await client.query(
            `INSERT INTO master_types (id, type_name, classification) VALUES ($1, $2, $3)`,
            [id, inc.typeName, classification]
          )
          for (const item of inc.items) {
            await client.query(
              `INSERT INTO master_type_items (master_type_id, item_id, item_name, qty, make, model, variants, with_plate, without_plate)
               VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, false, false)`,
              [id, itemIdByName.get(item.itemName) || "", item.itemName, item.qty, item.make, item.model]
            )
          }
          typesAdded++
          continue
        }

        if (!overwriteSet.has(inc.typeName)) {
          // Conflict but not selected for overwrite — leave alone.
          typesSkipped++
          continue
        }

        // Overwrite an existing type's items + classification. Plate flags
        // reset to false because the file doesn't carry them.
        await client.query(
          `UPDATE master_types SET classification = $1 WHERE id = $2`,
          [classification, existingId]
        )
        await client.query(
          `DELETE FROM master_type_items WHERE master_type_id = $1`,
          [existingId]
        )
        for (const item of inc.items) {
          await client.query(
            `INSERT INTO master_type_items (master_type_id, item_id, item_name, qty, make, model, variants, with_plate, without_plate)
             VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, false, false)`,
            [existingId, itemIdByName.get(item.itemName) || "", item.itemName, item.qty, item.make, item.model]
          )
        }
        typesOverwritten++
      }

      await client.query("COMMIT")
      return NextResponse.json({
        mode: "apply",
        itemsAdded,
        typesAdded,
        typesOverwritten,
        typesSkipped,
      })
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
