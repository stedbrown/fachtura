'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from 'next-intl'
import { AlertCircle, Loader2, Mail, Receipt } from 'lucide-react'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export default function LoginPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [googleAuthLoading, setGoogleAuthLoading] = useState<'login' | 'signup' | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const extractErrorMessage = (fallback: string, details?: unknown) => {
    if (
      details &&
      typeof details === 'object' &&
      'message' in details &&
      typeof (details as { message?: unknown }).message === 'string'
    ) {
      return (details as { message: string }).message
    }
    return fallback
  }

  const getRedirectUrl = () => {
    if (typeof window === 'undefined') {
      return `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/${locale}/dashboard`
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    return `${base.replace(/\/$/, '')}/${locale}/dashboard`
  }

  const onSubmit = async (data: LoginInput) => {
    setLoading(true)
    setError('')

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (signInError) {
        throw signInError
      }
    }, 'Error signing in with email')

    setLoading(false)

    if (result.success) {
      router.push(`/${locale}/dashboard`)
      router.refresh()
      return
    }

    const message = extractErrorMessage(result.error, result.details)

    if (message.includes('Invalid login credentials')) {
      setError(t('invalidCredentials'))
    } else if (message.includes('Email not confirmed')) {
      setError(t('emailNotConfirmed'))
    } else {
      setError(getSupabaseErrorMessage(result.details) || message || tErrors('generic'))
    }

    logger.error('Email login failed', result.details)
  }

  const handleGoogleAuth = async (action: 'login' | 'signup') => {
    if (typeof window === 'undefined') return

    setError('')
    setGoogleAuthLoading(action)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl(),
        },
      })

      if (oauthError) {
        throw oauthError
      }
    }, action === 'login' ? 'Error logging in with Google' : 'Error signing up with Google')

    if (!result.success) {
      setGoogleAuthLoading(null)
      logger.error('Google OAuth error', result.details, { action })
      setError(getSupabaseErrorMessage(result.details) || extractErrorMessage(result.error, result.details))
    }
  }

  const loginImage = process.env.NEXT_PUBLIC_LOGIN_IMAGE_URL

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold">
            <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg">
              <Receipt className="h-5 w-5" />
            </div>
            Fatturup
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleGoogleAuth('login')}
                disabled={googleAuthLoading !== null}
              >
                {googleAuthLoading === 'login' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon('loading')}
                  </>
                ) : (
                  <>
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    {t('googleLogin')}
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleGoogleAuth('signup')}
                disabled={googleAuthLoading !== null}
              >
                {googleAuthLoading === 'signup' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon('loading')}
                  </>
                ) : (
                  <>
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    {t('googleSignup')}
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
              <Separator className="flex-1" />
              <span>{t('orContinueWithEmail')}</span>
              <Separator className="flex-1" />
            </div>

            <Card>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-semibold">{t('login')}</CardTitle>
                <CardDescription>{t('loginTitle')}</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-left dark:border-red-800 dark:bg-red-900/20">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                        <div className="flex-1 text-sm text-red-600 dark:text-red-400">
                          {error}
                          {error === t('emailNotConfirmed') && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                              <Mail className="h-3 w-3" />
                              {t('checkYourEmail')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-left">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@esempio.com"
                      autoComplete="email"
                      disabled={loading || googleAuthLoading !== null}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-left">
                    <Label htmlFor="password">{t('password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading || googleAuthLoading !== null}
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" className="w-full" disabled={loading || googleAuthLoading !== null}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tCommon('loading')}
                      </>
                    ) : (
                      t('login')
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    {t('dontHaveAccount')}{' '}
                    <Link href={`/${locale}/auth/register`} className="font-medium text-primary hover:underline">
                      {t('registerHere')}
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>

      <div className="relative hidden bg-muted lg:block">
        {loginImage ? (
          <>
            <Image src={loginImage} alt="Workspace illustration" fill priority className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 opacity-90" />
        )}
      </div>
    </div>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.8h5.35c-.23 1.47-1.62 4.3-5.35 4.3-3.22 0-5.84-2.62-5.84-5.92s2.62-5.92 5.84-5.92c1.83 0 3.07.78 3.77 1.45l2.04-1.98C16.63 4.38 14.52 3.4 12 3.4 6.98 3.4 3 7.38 3 12.28S6.98 21.16 12 21.16c6.25 0 8.64-4.41 8.64-7.31 0-.49-.05-.87-.14-1.27Z"
      />
    </svg>
  )
}
