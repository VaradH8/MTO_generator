import { ReactNode } from "react"

type Variant = "success" | "warning" | "error" | "info"

interface StatusBadgeProps {
  variant?: Variant
  children: ReactNode
}

const variantStyles: Record<Variant, { background: string; color: string }> = {
  success: { background: "var(--color-success-soft)", color: "var(--color-success)" },
  warning: { background: "var(--color-warning-soft)", color: "var(--color-warning)" },
  error: { background: "var(--color-error-soft)", color: "var(--color-error)" },
  info: { background: "var(--color-surface-2)", color: "var(--color-text-muted)" },
}

export default function StatusBadge({ variant = "info", children }: StatusBadgeProps) {
  const styles = variantStyles[variant]

  return (
    <span
      style={{
        height: 24,
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-2)",
        fontFamily: "var(--font-display)",
        fontSize: "0.75rem",
        fontWeight: 500,
        borderRadius: "var(--radius-full)",
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        lineHeight: 1,
        background: styles.background,
        color: styles.color,
      }}
    >
      {children}
    </span>
  )
}
