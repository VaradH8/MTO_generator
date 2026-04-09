"use client"

import { useAuth } from "@/context/AuthContext"
import LoginForm from "./LoginForm"
import { ReactNode } from "react"

export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <>{children}</>
}
