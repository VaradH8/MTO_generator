interface PageLoaderProps {
  message?: string
}

export default function PageLoader({ message = "Loading..." }: PageLoaderProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in srgb, var(--color-bg) 80%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        zIndex: "var(--z-modal)" as unknown as number,
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--color-primary)",
          borderTopColor: "transparent",
          borderRadius: "var(--radius-full)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--color-text-muted)",
        }}
      >
        {message}
      </span>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
