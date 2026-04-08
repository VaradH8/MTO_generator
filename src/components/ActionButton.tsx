"use client"

import { ReactNode } from "react"

type Variant = "primary" | "secondary" | "ghost" | "destructive"
type Size = "sm" | "md"

interface ActionButtonProps {
  variant?: Variant
  size?: Size
  disabled?: boolean
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
  onClick?: () => void
  children: ReactNode
}

const sizeMap: Record<Size, { height: number; paddingX: string; fontSize: string }> = {
  sm: { height: 32, paddingX: "var(--space-4)", fontSize: "0.875rem" },
  md: { height: 40, paddingX: "var(--space-5)", fontSize: "0.875rem" },
}

const variantMap: Record<Variant, Record<string, string>> = {
  primary: {
    background: "var(--color-primary)",
    color: "#ffffff",
    border: "none",
    boxShadow: "var(--shadow-sm)",
  },
  secondary: {
    background: "transparent",
    color: "var(--color-primary)",
    border: "1px solid var(--color-primary)",
    boxShadow: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-primary)",
    border: "none",
    boxShadow: "none",
  },
  destructive: {
    background: "var(--color-error)",
    color: "#ffffff",
    border: "none",
    boxShadow: "var(--shadow-sm)",
  },
}

export default function ActionButton({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  onClick,
  children,
}: ActionButtonProps) {
  const sizeStyles = sizeMap[size]
  const vStyles = variantMap[variant]
  const isDisabled = disabled || loading

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        height: sizeStyles.height,
        paddingLeft: sizeStyles.paddingX,
        paddingRight: sizeStyles.paddingX,
        fontSize: sizeStyles.fontSize,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        borderRadius: "var(--radius-md)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        whiteSpace: "nowrap",
        transition: "var(--transition-fast)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.45 : 1,
        width: fullWidth ? "100%" : undefined,
        ...vStyles,
      }}
    >
      {loading ? (
        <span
          style={{
            width: size === "sm" ? 14 : 16,
            height: size === "sm" ? 14 : 16,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "var(--radius-full)",
            animation: "spin 0.8s linear infinite",
            display: "inline-block",
          }}
        />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  )
}
