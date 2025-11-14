'use client'

import dynamic from 'next/dynamic'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationsDropdown } from '@/components/notifications-dropdown'
import { SubscriptionBadge } from '@/components/subscription-badge'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe, Search, Receipt } from 'lucide-react'
import { locales, localeNames, localeFlags, type Locale } from '@/i18n.config'
import Link from 'next/link'

// Dynamic import to avoid hydration mismatch with Dialog IDs
const GlobalSearch = dynamic(() => import('@/components/global-search').then(mod => ({ default: mod.GlobalSearch })), {
  ssr: false,
})

interface AppHeaderProps {
  user?: {
    email?: string
  }
}

export function AppHeader({ user }: AppHeaderProps) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const currentLocale = params.locale as Locale

  const switchLocale = (newLocale: Locale) => {
    // Replace the current locale in the pathname with the new one
    const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`)
    router.push(newPathname)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-3 md:gap-6">
        {/* Left side: Sidebar Trigger + Logo (mobile) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SidebarTrigger className="shrink-0" />
          {/* Logo - visible on mobile */}
          <Link href={`/${currentLocale}/dashboard`} className="flex items-center gap-2 sm:hidden">
            <div className="flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-green-500 p-1.5">
              <Receipt className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-base font-semibold text-foreground">fachtura</span>
          </Link>
        </div>
        
        {/* Center: Search bar - hidden on mobile, shown on tablet+ */}
        <div className="hidden sm:flex flex-1 items-center min-w-0 max-w-3xl mx-4">
          <div className="w-full">
            <GlobalSearch />
          </div>
        </div>

        {/* Right side controls - all aligned to right */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0 ml-auto">
          {/* Mobile: Search icon button - moved to right */}
          <div className="sm:hidden">
            <GlobalSearch />
          </div>
          
          {user?.email && (
            <span className="hidden xl:block text-sm text-muted-foreground truncate max-w-[180px]">
              {user.email}
            </span>
          )}
          
          {/* Subscription badge - hidden on mobile */}
          <div className="hidden sm:block">
            <SubscriptionBadge />
          </div>
          
          {/* Notifications - with outline style */}
          <NotificationsDropdown />
          
          {/* Language selector - hidden on mobile */}
          <div className="hidden sm:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {locales.map((locale) => (
                  <DropdownMenuItem
                    key={locale}
                    onClick={() => switchLocale(locale)}
                    className={currentLocale === locale ? 'bg-accent' : ''}
                  >
                    <span className="mr-2">{localeFlags[locale]}</span>
                    {localeNames[locale]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
