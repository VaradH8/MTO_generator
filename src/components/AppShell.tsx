"use client"

import { ReactNode, useState } from "react"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            zIndex: 249, display: "none",
          }}
          // Show only on mobile via className
          id="sidebar-overlay"
        />
      )}

      {/* Sidebar — always visible on desktop, slide-in on mobile */}
      <div
        className="animate-slide-in-left"
        id="sidebar-wrapper"
        style={{
          position: "fixed",
          top: 0,
          left: sidebarOpen ? 0 : -220,
          zIndex: 250,
          transition: "left 0.25s ease-out",
          height: "100vh",
        }}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop: sidebar takes space */}
      <div id="sidebar-spacer" style={{ width: 220, flexShrink: 0 }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar onMenuToggle={() => setSidebarOpen((p) => !p)} />
        <main
          className="animate-fade-in"
          style={{
            flex: 1,
            maxWidth: "var(--container-max)",
            paddingLeft: "var(--container-pad-x)",
            paddingRight: "var(--container-pad-x)",
            paddingTop: "var(--space-6)",
            paddingBottom: "var(--space-10)",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #sidebar-spacer { display: none !important; }
          #sidebar-overlay { display: block !important; }
        }
        @media (min-width: 769px) {
          #sidebar-wrapper { left: 0 !important; position: sticky !important; }
          #sidebar-overlay { display: none !important; }
        }
      `}</style>
    </div>
  )
}
