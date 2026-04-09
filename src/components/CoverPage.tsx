"use client"

import Image from "next/image"
import { useTheme } from "@/context/ThemeProvider"

interface CoverPageProps {
  onLogin: () => void
}

export default function CoverPage({ onLogin }: CoverPageProps) {
  const { darkMode } = useTheme()

  return (
    <div
      className="animate-fade-in"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: darkMode
          ? "linear-gradient(135deg, #0c0f1a 0%, #151929 40%, #1c2236 100%)"
          : "linear-gradient(135deg, #f3f5fa 0%, #e9edf6 40%, #dce3f0 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Floating shapes */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <svg viewBox="0 0 80 80" fill="none" style={{ position: "absolute", top: "6%", right: "8%", width: "min(120px, 15vw)", opacity: darkMode ? 0.06 : 0.05, animation: "floatSpin1 25s linear infinite" }}>
          <path d="M10 10v60h20V30h40V10H10z" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="3" />
        </svg>
        <svg viewBox="0 0 60 100" fill="none" style={{ position: "absolute", top: "25%", left: "5%", width: "min(80px, 10vw)", opacity: darkMode ? 0.05 : 0.04, animation: "floatSpin2 30s linear infinite" }}>
          <rect x="5" y="5" width="50" height="10" rx="2" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="2.5" />
          <rect x="22" y="15" width="16" height="70" rx="1" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="2.5" />
          <rect x="5" y="85" width="50" height="10" rx="2" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="2.5" />
        </svg>
        <svg viewBox="0 0 80 80" fill="none" style={{ position: "absolute", bottom: "12%", right: "15%", width: "min(100px, 12vw)", opacity: darkMode ? 0.06 : 0.04, animation: "floatSpin3 22s linear infinite" }}>
          <path d="M10 10h60M40 10v60" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="4" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 80 80" fill="none" style={{ position: "absolute", top: "55%", left: "10%", width: "min(90px, 11vw)", opacity: darkMode ? 0.05 : 0.04, animation: "floatSpin4 28s linear infinite" }}>
          <path d="M10 70L70 10M10 70h30M10 70V40" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="3" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 80 80" fill="none" style={{ position: "absolute", bottom: "5%", left: "3%", width: "min(80px, 10vw)", opacity: darkMode ? 0.04 : 0.03, animation: "floatSpin2 32s linear infinite" }}>
          <path d="M10 10l60 60M70 10l-60 60" stroke={darkMode ? "#5b7ce6" : "#1f3ca8"} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Top bar — just Sign In */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-4) var(--space-5)", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <button
          onClick={onLogin}
          style={{
            padding: "var(--space-2) var(--space-5)",
            fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600,
            color: "#fff", background: "var(--color-primary)", border: "none",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", cursor: "pointer",
          }}
        >
          Sign In
        </button>
      </div>

      {/* Hero — flex:1 centers vertically in remaining space */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 var(--space-5)",
          position: "relative",
          zIndex: 1,
          minHeight: 0,
        }}
      >
        {/* Logo */}
        <div
          className="animate-fade-in-up"
          style={{
            background: darkMode ? "transparent" : "var(--color-text)",
            borderRadius: "var(--radius-xl)",
            padding: darkMode ? 0 : "clamp(8px, 2vw, 16px)",
            marginBottom: "clamp(12px, 3vw, 24px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={140}
            style={{
              objectFit: "contain",
              borderRadius: "var(--radius-lg)",
              width: "clamp(80px, 20vw, 140px)",
              height: "clamp(80px, 20vw, 140px)",
            }}
          />
        </div>

        {/* Title */}
        <h1
          className="animate-fade-in-up delay-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.75rem, 6vw, 3.5rem)",
            fontWeight: 700,
            color: "var(--color-text)",
            lineHeight: 1.1,
            marginBottom: "var(--space-2)",
            letterSpacing: "-0.03em",
          }}
        >
          Support MTO
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-in-up delay-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1rem, 3vw, 1.375rem)",
            fontWeight: 500,
            color: "var(--color-primary)",
            marginBottom: "clamp(12px, 3vw, 24px)",
            letterSpacing: "0.02em",
          }}
        >
          Generation
        </p>

        <p
          className="animate-fade-in-up delay-3"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.875rem, 2.5vw, 1.0625rem)",
            color: "var(--color-text-muted)",
            maxWidth: 420,
            lineHeight: 1.6,
            marginBottom: "clamp(16px, 4vw, 32px)",
          }}
        >
          Your internal MTO workflow — simplified.
        </p>

        {/* CTA */}
        <div className="animate-fade-in-up delay-4">
          <button
            onClick={onLogin}
            style={{
              padding: "var(--space-3) var(--space-10)",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              cursor: "pointer",
            }}
          >
            Get Started
          </button>
        </div>
      </div>

      {/* Footer — always visible, no scroll */}
      <div
        className="animate-fade-in delay-5"
        style={{
          padding: "var(--space-4) var(--space-5)",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-body)", fontSize: "clamp(0.625rem, 1.8vw, 0.75rem)", color: "var(--color-text-faint)" }}>
          Powered by{" "}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(0.625rem, 1.8vw, 0.75rem)", fontWeight: 600, color: "var(--color-text-muted)" }}>
          Inventive Business Solutions Private Limited
        </span>
      </div>

      <style>{`
        @keyframes floatSpin1 { 0% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-15px,20px) rotate(180deg); } 100% { transform: translate(0,0) rotate(360deg); } }
        @keyframes floatSpin2 { 0% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(20px,-15px) rotate(-180deg); } 100% { transform: translate(0,0) rotate(-360deg); } }
        @keyframes floatSpin3 { 0% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(10px,15px) rotate(120deg); } 66% { transform: translate(-10px,5px) rotate(240deg); } 100% { transform: translate(0,0) rotate(360deg); } }
        @keyframes floatSpin4 { 0% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-20px,-10px) rotate(180deg); } 100% { transform: translate(0,0) rotate(360deg); } }
      `}</style>
    </div>
  )
}
