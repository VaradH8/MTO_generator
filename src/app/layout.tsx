import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/context/ThemeProvider"
import { AuthProvider } from "@/context/AuthContext"
import { SupportProvider } from "@/context/SupportContext"
import { BillingProvider } from "@/context/BillingContext"
import AuthGate from "@/components/AuthGate"
import AppHeader from "@/components/AppHeader"

export const metadata: Metadata = {
  title: "Support PDF Generator",
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
              <BillingProvider>
              <SupportProvider>
                <AppHeader />
                <main
                  style={{
                    maxWidth: "var(--container-max)",
                    paddingLeft: "var(--container-pad-x)",
                    paddingRight: "var(--container-pad-x)",
                    paddingTop: "var(--space-10)",
                    paddingBottom: "var(--space-10)",
                    margin: "0 auto",
                    minHeight: "calc(100vh - 56px)",
                  }}
                >
                  {children}
                </main>
              </SupportProvider>
              </BillingProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
