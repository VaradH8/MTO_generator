"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type UserRole = "admin" | "user" | "client"

export interface AuthUser {
  username: string
  role: UserRole
}

const AUTH_KEY = "spg_auth"

interface AuthContextType {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  // Persist session
  useEffect(() => {
    if (!loaded) return
    if (user) {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(user))
    } else {
      sessionStorage.removeItem(AUTH_KEY)
    }
  }, [user, loaded])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        const data: AuthUser = await res.json()
        setUser({ username: data.username, role: data.role })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = () => setUser(null)

  // Don't render children until session is checked (prevents flash)
  if (!loaded) return null

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
