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
  const [showPassword, setShowPassword] = useState(false)

  // Forgot-password state. The flow is "user submits username → admin
  // sees a pending request in Settings → admin resets the password and
  // shares it out-of-band". The endpoint always returns 200 so this
  // form never reveals whether the username exists.
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotUsername, setForgotUsername] = useState("")
  const [forgotStatus, setForgotStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle")
  const [forgotError, setForgotError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login(username, password)
    if (!success) setError(true)
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = forgotUsername.trim()
    if (!u) return
    setForgotStatus("submitting")
    setForgotError("")
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setForgotError(data.error || `Request failed (${res.status})`)
        setForgotStatus("error")
        return
      }
      setForgotStatus("submitted")
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Network error")
      setForgotStatus("error")
    }
  }

  const closeForgot = () => {
    setForgotOpen(false)
    setForgotUsername("")
    setForgotStatus("idle")
    setForgotError("")
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
            {darkMode ? "☀" : "☾"}
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

        {/* Password — input + eye toggle anchored on the right edge */}
        <div className="animate-fade-in-up delay-3" style={{ marginBottom: "var(--space-3)" }}>
          <label style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text)", marginBottom: "var(--space-2)" }}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="Enter password" autoComplete="current-password"
              style={{ width: "100%", height: 40, padding: "0 40px 0 var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", outline: "none" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--color-text-muted)",
              }}
            >
              {showPassword ? (
                /* eye-off — single SVG so no extra deps */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.6 19.6 0 015.16-6.06" />
                  <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a19.6 19.6 0 01-3.27 4.42" />
                  <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                /* eye */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Forgot password — opens an inline modal that POSTs to the
            password-reset endpoint. Admins see the request in Settings. */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-6)" }}>
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            style={{
              fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 500,
              color: "var(--color-primary)", background: "none", border: "none",
              cursor: "pointer", padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <div className="animate-fade-in-up delay-4">
          <ActionButton variant="primary" fullWidth onClick={() => handleSubmit(new Event("submit") as unknown as React.FormEvent)}>
            Sign In
          </ActionButton>
        </div>
      </form>

      {/* ── Forgot Password modal ── */}
      {forgotOpen && (
        <div
          className="animate-fade-in"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}
          onClick={() => { if (forgotStatus !== "submitting") closeForgot() }}
        >
          <div
            className="animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              boxShadow: "var(--shadow-xl)",
              width: "92%", maxWidth: 420,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text)" }}>
                Forgot password
              </h2>
              {forgotStatus !== "submitting" && (
                <button onClick={closeForgot} style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "var(--color-text-faint)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>×</button>
              )}
            </div>

            {forgotStatus === "submitted" ? (
              <>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
                  Reset request submitted. An administrator will review it and contact you with a new password.
                </p>
                <ActionButton variant="primary" fullWidth onClick={closeForgot}>
                  OK
                </ActionButton>
              </>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                  Enter your username. An administrator will see your request in Settings and reset the password.
                </p>
                <input
                  type="text" autoFocus
                  value={forgotUsername}
                  onChange={(e) => { setForgotUsername(e.target.value); setForgotError("") }}
                  placeholder="Your username"
                  disabled={forgotStatus === "submitting"}
                  style={{ width: "100%", height: 40, padding: "0 var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-text)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", outline: "none", marginBottom: "var(--space-3)" }}
                />
                {forgotError && (
                  <div style={{ background: "var(--color-error-soft)", borderLeft: "3px solid var(--color-error)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-error)" }}>
                    {forgotError}
                  </div>
                )}
                <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                  <ActionButton variant="ghost" size="sm" onClick={closeForgot}>
                    Cancel
                  </ActionButton>
                  <ActionButton variant="primary" size="sm" loading={forgotStatus === "submitting"}>
                    {forgotStatus === "submitting" ? "Submitting..." : "Submit request"}
                  </ActionButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
