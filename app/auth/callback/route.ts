import { NextResponse } from 'next/server'
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next')

  const redirectPath = next && next.startsWith('/') ? next : '/'
  const redirectUrl = new URL(redirectPath, requestUrl.origin)

  if (code) {
    redirectUrl.searchParams.set('code', code)
  }
  if (error) {
    redirectUrl.searchParams.set('error', error)
  }
  if (errorDescription) {
    redirectUrl.searchParams.set('error_description', errorDescription)
  }

  return NextResponse.redirect(redirectUrl)
}

