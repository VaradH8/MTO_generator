import { ReactNode } from "react"
import ActionButton from "./ActionButton"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  message: string
  action?: { label: string; onClick: () => void } | null
}

export default function EmptyState({ icon, title, message, action = null }: EmptyStateProps) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-12) var(--space-6)",
        textAlign: "center",
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      {icon && (
        <div style={{ marginBottom: "var(--space-4)", color: "var(--color-text-faint)" }}>
          {icon}
        </div>
      )}

      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.125rem",
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: "var(--space-2)",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
          lineHeight: 1.5,
          marginBottom: action ? "var(--space-6)" : undefined,
        }}
      >
        {message}
      </p>

      {action && (
        <ActionButton variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </ActionButton>
      )}
    </div>
  )
}
