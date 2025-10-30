import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayoutClient } from '@/components/dashboard-layout-client'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  // Read sidebar state from cookies (server-side)
  const cookieStore = await cookies()
  const sidebarState = cookieStore.get('sidebar_state')
  const defaultOpen = sidebarState?.value === 'true'

  return (
    <DashboardLayoutClient user={user} defaultOpen={defaultOpen}>
      {children}
    </DashboardLayoutClient>
  )
}
