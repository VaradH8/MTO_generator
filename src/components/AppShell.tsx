"use client"

import { ReactNode, useState } from "react"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import GlobalDropZone from "./GlobalDropZone"

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 249, display: "none" }}
          id="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <div
        className="animate-slide-in-left"
        id="sidebar-wrapper"
        style={{
          position: "fixed", top: 0, left: sidebarOpen ? 0 : -220,
          zIndex: 250, transition: "left 0.25s ease-out", height: "100vh",
        }}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar spacer */}
      <div id="sidebar-spacer" style={{ width: 220, flexShrink: 0 }} />

      {/* Content column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* TopBar — fixed at top, offset by sidebar width on desktop */}
        <div id="topbar-wrapper" style={{ position: "fixed", top: 0, right: 0, left: 220, zIndex: 200 }}>
          <TopBar onMenuToggle={() => setSidebarOpen((p) => !p)} />
        </div>
        {/* Spacer for fixed topbar height */}
        <div style={{ height: 49, flexShrink: 0 }} />

        <GlobalDropZone>
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
        </GlobalDropZone>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #sidebar-spacer { display: none !important; }
          #sidebar-overlay { display: block !important; }
          #topbar-wrapper { left: 0 !important; }
        }
        @media (min-width: 769px) {
          #sidebar-wrapper { left: 0 !important; position: fixed !important; }
          #sidebar-overlay { display: none !important; }
          #topbar-wrapper { left: 220px !important; }
        }
      `}</style>
    </div>
  )
}
