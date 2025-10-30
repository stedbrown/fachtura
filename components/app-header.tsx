'use client'

import dynamic from 'next/dynamic'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import { locales, localeNames, localeFlags, type Locale } from '@/i18n.config'

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
      <div className="flex h-14 items-center px-4 md:px-6 gap-2 md:gap-4">
        <SidebarTrigger className="shrink-0" />
        
        {/* Search bar - centered on desktop */}
        <div className="flex-1 flex items-center justify-center max-w-2xl mx-auto">
          <div className="w-full max-w-md">
            <GlobalSearch />
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {user?.email && (
            <span className="hidden lg:block text-sm text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
