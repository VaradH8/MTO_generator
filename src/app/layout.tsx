import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/context/ThemeProvider"
import { AuthProvider } from "@/context/AuthContext"
import { SupportProvider } from "@/context/SupportContext"
import { ProjectTableProvider } from "@/context/ProjectTableContext"
import { BillingProvider } from "@/context/BillingContext"
import { ProjectProvider } from "@/context/ProjectContext"
import { SettingsProvider } from "@/context/SettingsContext"
import { ApprovalProvider } from "@/context/ApprovalContext"
import AuthGate from "@/components/AuthGate"
import AppShell from "@/components/AppShell"

export const metadata: Metadata = {
  title: "Support MTO",
  description: "Upload support schedules, review data, and generate PDFs",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate>
              <SettingsProvider>
              <ProjectProvider>
              <BillingProvider>
              <ApprovalProvider>
              <SupportProvider>
              <ProjectTableProvider>
                <AppShell>{children}</AppShell>
              </ProjectTableProvider>
              </SupportProvider>
              </ApprovalProvider>
              </BillingProvider>
              </ProjectProvider>
              </SettingsProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
