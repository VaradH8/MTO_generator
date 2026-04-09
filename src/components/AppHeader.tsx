"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "@/context/ThemeProvider"
import { useAuth } from "@/context/AuthContext"
import { useBilling } from "@/context/BillingContext"

export default function AppHeader() {
  const { darkMode, toggleTheme } = useTheme()
  const { logout } = useAuth()
  const { currentTotalSupports, currentAmount } = useBilling()
  const pathname = usePathname()

  const navLinks = [
    { href: "/", label: "Upload" },
    { href: "/billing", label: "Billing" },
  ]

  const navStyle = (isActive: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-display)",
    fontSize: "0.8125rem",
    fontWeight: isActive ? 600 : 500,
    color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
    padding: "var(--space-2) var(--space-3)",
    borderRadius: "var(--radius-md)",
    background: isActive ? "var(--color-primary-soft)" : "transparent",
    textDecoration: "none",
    transition: "var(--transition-fast)",
  })

  const iconBtnStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: "var(--radius-full)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--color-text-muted)",
    transition: "var(--transition-fast)",
    fontSize: 14,
  }

  return (
    <header
      style={{
        height: 56,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        padding: "0 var(--space-6)",
        position: "sticky",
        top: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      {/* App name */}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "var(--color-text)",
          marginRight: "var(--space-2)",
        }}
      >
        Support PDF Generator
      </span>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />

      {/* Nav links */}
      <nav style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
          return (
            <Link key={link.href} href={link.href} style={navStyle(isActive)}>
              {link.label}
              {link.href === "/billing" && currentTotalSupports > 0 && (
                <span
                  style={{
                    marginLeft: "var(--space-2)",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--color-primary)",
                    color: "#fff",
                  }}
                >
                  {currentTotalSupports}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />

      {/* AutoCAD trigger buttons */}
      <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
        <button
          title="Run AutoCAD Script"
          style={iconBtnStyle}
          onClick={() => alert("AutoCAD Script trigger — plugin not connected yet")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 12l4-8 4 8M4 8h4M12 4v8M10 6h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          title="Export to AutoCAD"
          style={iconBtnStyle}
          onClick={() => alert("Export to AutoCAD — plugin not connected yet")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button
          title="Sync from AutoCAD"
          style={iconBtnStyle}
          onClick={() => alert("Sync from AutoCAD — plugin not connected yet")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8a6 6 0 0111.3-2.8M14 8a6 6 0 01-11.3 2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M13 2v3h-3M3 14v-3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <span style={{ flexGrow: 1 }} />

      {/* Billing mini summary */}
      {currentTotalSupports > 0 && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--color-text-muted)",
          }}
        >
          ${currentAmount.toFixed(2)}
        </span>
      )}

      {/* Theme toggle */}
      <button onClick={toggleTheme} aria-label="Toggle theme" style={iconBtnStyle}>
        {darkMode ? "\u2600" : "\u263E"}
      </button>

      {/* Logout */}
      <button
        onClick={logout}
        title="Logout"
        style={{
          ...iconBtnStyle,
          fontSize: 12,
          color: "var(--color-text-faint)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M6 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </header>
  )
}
