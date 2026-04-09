"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type UserRole = "admin" | "user" | "client"

export interface AuthUser {
  username: string
  role: UserRole
}

const USERS: { username: string; password: string; role: UserRole }[] = [
  { username: "Varad", password: "Admin123", role: "admin" },
  { username: "User", password: "default123", role: "user" },
  { username: "Client", password: "client123", role: "client" },
]

const AUTH_KEY = "spg_auth"

interface AuthContextType {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (username: string, password: string) => boolean
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

  const login = (username: string, password: string): boolean => {
    const found = USERS.find(
      (u) => u.username === username && u.password === password
    )
    if (found) {
      setUser({ username: found.username, role: found.role })
      return true
    }
    return false
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
