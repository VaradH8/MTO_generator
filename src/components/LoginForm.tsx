"use client"

import { useState } from "react"
import Image from "next/image"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeProvider"
import ActionButton from "./ActionButton"

interface LoginFormProps {
  onBack?: () => void
}

export default function LoginForm({ onBack }: LoginFormProps) {
  const { login } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login(username, password)
    if (!success) setError(true)
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in-up"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "clamp(24px, 5vw, 40px)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 400,
        }}
      >
        {/* Top row: back + theme toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: onBack ? "var(--space-4)" : 0 }}>
          {onBack ? (
            <button type="button" onClick={onBack} style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={toggleTheme}
            style={{ width: 32, height: 32, borderRadius: "var(--radius-full)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 16, background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          >
            {darkMode ? "\u2600" : "\u263E"}
          </button>
        </div>
        {/* Logo + title */}
        <div className="animate-fade-in-up delay-1" style={{ textAlign: "center", marginBottom: "var(--space-8)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              background: darkMode ? "transparent" : "var(--color-text)",
              borderRadius: "var(--radius-lg)",
              padding: darkMode ? 0 : 10,
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={100}
              height={100}
              style={{ borderRadius: "var(--radius-md)", objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
            Support MTO
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            Sign in to continue
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="animate-fade-in-down" style={{ background: "var(--color-error-soft)", borderLeft: "3px solid var(--color-error)", borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-4)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-error)" }}>
            Invalid username or password.
          </div>
        )}

        {/* Username */}
        <div className="animate-fade-in-up delay-2" style={{ marginBottom: "var(--space-4)" }}>
          <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
            Username
          </label>
          <input
            type="text" value={username}
            onChange={(e) => { setUsername(e.target.value); setError(false) }}
            placeholder="Enter username" autoComplete="username"
            style={{ width: "100%", height: 40, padding: "0 var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", outline: "none" }}
          />
        </div>

        {/* Password */}
        <div className="animate-fade-in-up delay-3" style={{ marginBottom: "var(--space-6)" }}>
          <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
            Password
          </label>
          <input
            type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            placeholder="Enter password" autoComplete="current-password"
            style={{ width: "100%", height: 40, padding: "0 var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", outline: "none" }}
          />
        </div>

        {/* Submit */}
        <div className="animate-fade-in-up delay-4">
          <ActionButton variant="primary" fullWidth onClick={() => handleSubmit(new Event("submit") as unknown as React.FormEvent)}>
            Sign In
          </ActionButton>
        </div>
      </form>
    </div>
  )
}
