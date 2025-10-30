'use client'

import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
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
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader user={user} />
          <main className="flex-1 container py-4 md:py-6 px-4 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

