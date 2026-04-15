"use client"

import { ReactNode, useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"

export default function GlobalDropZone({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState(false)
  const router = useRouter()
  const dragCounterRef = useRef(0)

  const handleDragEnter = useCallback((e: globalThis.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer?.types.includes("Files")) {
      setDragging(true)
    }
  }, [])

  const handleDragOver = useCallback((e: globalThis.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: globalThis.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: globalThis.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragging(false)

    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "xlsx" && ext !== "xls") return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      sessionStorage.setItem("dropped_file", JSON.stringify({ name: file.name, base64 }))
      router.push("/upload")
    }
    reader.readAsDataURL(file)
  }, [router])

  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter)
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("dragleave", handleDragLeave)
    window.addEventListener("drop", handleDrop)

    return () => {
      window.removeEventListener("dragenter", handleDragEnter)
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("dragleave", handleDragLeave)
      window.removeEventListener("drop", handleDrop)
    }
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop])

  return (
    <>
      {children}
      {dragging && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(31, 60, 168, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "var(--space-8) var(--space-10)",
              borderRadius: "var(--radius-lg)",
              border: "3px dashed rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#fff",
                textAlign: "center",
              }}
            >
              Drop Excel file to upload
            </p>
          </div>
        </div>
      )}
    </>
  )
}
