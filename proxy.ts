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

// Export as "proxy" function for Next.js 16
export async function proxy(request: NextRequest) {
  // First handle i18n (this may return a redirect)
  const intlResponse = intlMiddleware(request)
  
  // If intl middleware returns a redirect, return it immediately
  if (intlResponse && (intlResponse.status === 307 || intlResponse.status === 308 || intlResponse.headers.get('location'))) {
    return intlResponse
  }
  
  // Handle Supabase session
  const supabaseResponse = await updateSession(request)
  
  // Use intl response as base, or supabase response if no intl response
  const response = intlResponse || supabaseResponse
  
  // Merge Supabase session headers into the response
  if (supabaseResponse && response) {
    supabaseResponse.headers.forEach((value, key) => {
      // Only copy Supabase-specific headers, don't override location or content-type
      if (key.toLowerCase().startsWith('set-cookie') || key.toLowerCase().includes('supabase')) {
        response.headers.set(key, value)
      }
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

