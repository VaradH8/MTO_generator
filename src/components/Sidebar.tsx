"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeProvider"
import { useApprovals } from "@/context/ApprovalContext"

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const { darkMode } = useTheme()
  const { pendingCount } = useApprovals()
  const pathname = usePathname()

  const isAdmin = user?.role === "admin"
  const isClient = user?.role === "client"

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "grid" },
    { href: "/projects", label: "Projects", icon: "folder" },
    ...(!isClient ? [{ href: "/upload", label: "Upload", icon: "upload" }] : []),
    ...(!isClient ? [{ href: "/settings", label: "Settings", icon: "settings" }] : []),
    ...(isAdmin ? [
      { href: "/approvals", label: "Approvals", icon: "check" },
      { href: "/billing", label: "Billing", icon: "dollar" },
    ] : []),
  ]

  const icons: Record<string, React.ReactNode> = {
    grid: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
    folder: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4a1 1 0 011-1h3l2 2h5a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
    upload: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 10V2M5 5l3-3 3 3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    settings: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    check: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    dollar: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v14M11 4H6.5a2 2 0 000 4h3a2 2 0 010 4H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  }

  return (
    <aside
      style={{
        width: 220,
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        flexShrink: 0,
      }}
    >
      {/* Logo + name */}
      <div style={{ padding: "var(--space-5) var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              background: darkMode ? "transparent" : "var(--color-text)",
              borderRadius: "var(--radius-md)",
              padding: darkMode ? 0 : 6,
              marginBottom: "var(--space-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={48}
              height={48}
              style={{ borderRadius: darkMode ? "var(--radius-md)" : "var(--radius-sm)", objectFit: "contain" }}
            />
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--color-text)",
              textAlign: "center",
            }}
          >
            Support MTO
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "var(--space-3) var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-display)",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                background: isActive ? "var(--color-primary-soft)" : "transparent",
                textDecoration: "none",
                transition: "var(--transition-fast)",
              }}
            >
              {icons[item.icon]}
              {item.label}
              {item.href === "/approvals" && pendingCount > 0 && (
                <span style={{ marginLeft: "auto", fontSize: "0.6875rem", fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--color-error)", color: "#fff" }}>
                  {pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
