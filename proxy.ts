import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n.config'

// Create next-intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function proxy(request: NextRequest) {
  // First handle Supabase session
  const supabaseResponse = await updateSession(request)
  
  // Then handle i18n
  const intlResponse = intlMiddleware(request)
  
  // Merge headers from both middlewares
  const response = intlResponse || supabaseResponse
  
  // Copy Supabase session headers to the final response
  if (supabaseResponse) {
    supabaseResponse.headers.forEach((value, key) => {
      response.headers.set(key, value)
    })
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

