import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next')

  const redirectPath = next && next.startsWith('/') ? next : '/'
  const redirectUrl = new URL(redirectPath, requestUrl.origin)

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll().map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll(cookieList: { name: string; value: string; options: CookieOptions }[]) {
            cookieList.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  if (error) {
    redirectUrl.searchParams.set('error', error)
  }
  if (errorDescription) {
    redirectUrl.searchParams.set('error_description', errorDescription)
  }

  return NextResponse.redirect(redirectUrl)
}

