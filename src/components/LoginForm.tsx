"use client"

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import ActionButton from "./ActionButton"

export default function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const success = login(username, password)
    if (!success) {
      setError(true)
    }
  }

  return (
    <div
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
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-10)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 400,
        }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            style={{ marginBottom: "var(--space-4)" }}
          >
            <rect width="48" height="48" rx="10" fill="var(--color-primary)" />
            <text
              x="24"
              y="32"
              textAnchor="middle"
              fill="#fff"
              fontSize="24"
              fontFamily="var(--font-display)"
              fontWeight="700"
            >
              S
            </text>
          </svg>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "var(--space-1)",
            }}
          >
            Support PDF Generator
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--color-text-muted)",
            }}
          >
            Sign in to continue
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              background: "var(--color-error-soft)",
              borderLeft: "3px solid var(--color-error)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-3) var(--space-4)",
              marginBottom: "var(--space-4)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--color-error)",
            }}
          >
            Invalid username or password.
          </div>
        )}

        {/* Username */}
        <div style={{ marginBottom: "var(--space-4)" }}>
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text)",
              marginBottom: "var(--space-2)",
            }}
          >
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError(false)
            }}
            placeholder="Enter username"
            autoComplete="username"
            style={{
              width: "100%",
              height: 40,
              padding: "0 var(--space-3)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--color-text)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "var(--shadow-focus)")}
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text)",
              marginBottom: "var(--space-2)",
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(false)
            }}
            placeholder="Enter password"
            autoComplete="current-password"
            style={{
              width: "100%",
              height: 40,
              padding: "0 var(--space-3)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "var(--color-text)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "var(--shadow-focus)")}
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />
        </div>

        {/* Submit */}
        <ActionButton variant="primary" fullWidth onClick={() => handleSubmit(new Event("submit") as unknown as React.FormEvent)}>
          Sign In
        </ActionButton>
      </form>
    </div>
  )
}
