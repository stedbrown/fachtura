'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export function AppSidebar() {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string
  const t = useTranslations('navigation')
  const tAuth = useTranslations('auth')
  const { setOpenMobile } = useSidebar()

  const menuItems = [
    {
      title: t('dashboard'),
      url: `/${locale}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      title: t('clients'),
      url: `/${locale}/dashboard/clients`,
      icon: Users,
    },
    {
      title: t('quotes'),
      url: `/${locale}/dashboard/quotes`,
      icon: FileText,
    },
    {
      title: t('invoices'),
      url: `/${locale}/dashboard/invoices`,
      icon: Receipt,
    },
    {
      title: t('settings'),
      url: `/${locale}/dashboard/settings`,
      icon: Settings,
    },
  ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/auth/login`)
    router.refresh()
  }

  const handleNavigation = () => {
    // Close mobile sidebar on navigation
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-0">
        <div className="flex items-center gap-2 p-2 h-8 mx-2 my-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xl font-bold group-data-[collapsible=icon]:hidden">
            Fatturup
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} onClick={handleNavigation}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">{tAuth('logout')}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
