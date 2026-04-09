"use client"

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import CoverPage from "./CoverPage"
import LoginForm from "./LoginForm"
import { ReactNode } from "react"

export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  if (!isAuthenticated) {
    if (showLogin) {
      return <LoginForm onBack={() => setShowLogin(false)} />
    }
    return <CoverPage onLogin={() => setShowLogin(true)} />
  }

  return <>{children}</>
}
