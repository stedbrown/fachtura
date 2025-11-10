'use client'

import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import dynamic from 'next/dynamic'

// Dynamic import to avoid hydration mismatch with DropdownMenu IDs
const AppHeader = dynamic(
  () => import('@/components/app-header').then(mod => ({ default: mod.AppHeader })),
  { ssr: false }
)

interface DashboardLayoutClientProps {
  children: React.ReactNode
  user: {
    email?: string
  }
  defaultOpen: boolean
}

export function DashboardLayoutClient({ children, user, defaultOpen }: DashboardLayoutClientProps) {
  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          <AppHeader user={user} />
          <main className="flex-1 overflow-auto py-4 md:py-6 px-4 md:px-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}

