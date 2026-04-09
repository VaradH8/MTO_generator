"use client"

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeProvider"

export default function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, logout } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-6)",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        position: "sticky",
        top: 0,
        zIndex: 200,
      }}
    >
      {/* Hamburger — mobile only */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          id="hamburger-btn"
          aria-label="Toggle menu"
          style={{
            width: 34, height: 34, borderRadius: "var(--radius-md)",
            display: "none", alignItems: "center", justifyContent: "center",
            color: "var(--color-text-muted)", background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)", marginRight: "auto",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--radius-full)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          fontSize: 16,
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        {darkMode ? "\u2600" : "\u263E"}
      </button>

      {/* User avatar + dropdown */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowMenu((p) => !p)}
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-full)",
            background: "var(--color-primary)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textTransform: "uppercase",
            border: "2px solid var(--color-surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {user?.username?.charAt(0) || "U"}
        </button>

        {showMenu && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 299 }}
              onClick={() => setShowMenu(false)}
            />
            <div
              className="animate-fade-in-down"
              style={{
                position: "absolute",
                top: 42,
                right: 0,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                padding: "var(--space-2)",
                minWidth: 160,
                zIndex: 300,
              }}
            >
              <div style={{ padding: "var(--space-2) var(--space-3)", fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)" }}>
                {user?.username}
              </div>
              <div style={{ padding: "var(--space-1) var(--space-3)", fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--color-text-faint)", marginBottom: "var(--space-2)" }}>
                {user?.role}
              </div>
              <div style={{ height: 1, background: "var(--color-border)", margin: "var(--space-1) 0" }} />
              <button
                onClick={() => { logout(); setShowMenu(false) }}
                style={{
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  fontFamily: "var(--font-display)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-error)",
                  textAlign: "left",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M6 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          #hamburger-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
