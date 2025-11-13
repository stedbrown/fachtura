'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import type { CompanySettingsInsert } from '@/lib/types/database'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Mail, AlertCircle, Loader2, Receipt } from 'lucide-react'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export default function RegisterPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
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

  const handleGoogleAuth = async () => {
    if (typeof window === 'undefined') return

    setError('')
    setGoogleAuthLoading(true)

    const result = await safeAsync(async () => {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl(),
        },
      })

      if (oauthError) {
        throw oauthError
      }
    }, 'Error signing up with Google')

    if (!result.success) {
      setGoogleAuthLoading(false)
      logger.error('Google signup error', result.details)
      setError(getSupabaseErrorMessage(result.details) || extractErrorMessage(result.error, result.details))
    }
  }

  const handleResendEmail = async () => {
    if (!registeredEmail) return

    setResending(true)

    const result = await safeAsync(async () => {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
      })

      if (resendError) {
        throw resendError
      }
    }, 'Error resending verification email')

    setResending(false)

    if (result.success) {
      setError(t('emailResent'))
      setTimeout(() => setError(''), 3000)
    } else {
      logger.error('Resend verification email failed', result.details, { email: registeredEmail })
      setError(getSupabaseErrorMessage(result.details) || extractErrorMessage(result.error, result.details))
    }
  }

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const checkEmailResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })

      if (!checkEmailResponse.ok) {
        logger.error('Email verification request failed', { status: checkEmailResponse.status })
        setError(tErrors('generic'))
        return
      }

      const emailCheck = await checkEmailResponse.json()

      if (!emailCheck.allowed) {
        setError(emailCheck.message)
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            company_name: data.companyName,
          },
          emailRedirectTo: `${window.location.origin}/${locale}/dashboard`,
        },
      })

      if (authError) {
        const message = authError.message || ''
        if (message.includes('already registered')) {
          setError(t('userAlreadyExists'))
        } else if (message.includes('password')) {
          setError(t('weakPassword'))
        } else {
          setError(message || tErrors('generic'))
        }
        return
      }

      if (!authData.user) {
        setError(tErrors('generic'))
        return
      }

      if (authData.user && !authData.session) {
        setRegisteredEmail(data.email)
        setSuccess(true)
        return
      }

      if (authData.session) {
        const companySettings = {
          user_id: authData.user.id,
          company_name: data.companyName,
          country: 'Switzerland',
        } satisfies CompanySettingsInsert

        const { error: companyError } = await supabase.from('company_settings').insert(companySettings)

        if (companyError) {
          logger.error('Error creating company settings', companyError, { userId: authData.user.id })
          setError(tErrors('generic'))
          return
        }

        router.push(`/${locale}/dashboard`)
        router.refresh()
      }
    } catch (err) {
      logger.error('Registration error', err)
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg">
                <Receipt className="h-5 w-5" />
              </div>
              <span className="text-3xl font-bold tracking-tight">Fatturup</span>
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
                {t('registrationSuccess')}
              </CardTitle>
              <CardDescription>{t('checkYourEmail')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{registeredEmail}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{t('emailVerificationMessageShort')}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-green-50 p-3 text-center text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button variant="outline" className="w-full" onClick={handleResendEmail} disabled={resending}>
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </>
              ) : (
                t('resendEmail')
              )}
            </Button>
            <Link href={`/${locale}/auth/login`} className="w-full">
              <Button variant="ghost" className="w-full">
                {t('backToLogin')}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const registerImage = process.env.NEXT_PUBLIC_REGISTER_IMAGE_URL ?? process.env.NEXT_PUBLIC_LOGIN_IMAGE_URL

  useEffect(() => {
    const handleSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace(`/${locale}/dashboard`)
      }
    }

    void handleSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace(`/${locale}/dashboard`)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [locale, router])

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
            <Button variant="outline" className="w-full" onClick={handleGoogleAuth} disabled={googleAuthLoading || loading}>
              {googleAuthLoading ? (
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

            <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
              <Separator className="flex-1" />
              <span>{t('orContinueWithEmail')}</span>
              <Separator className="flex-1" />
            </div>

            <Card>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-semibold">{t('register')}</CardTitle>
                <CardDescription>{t('registerTitle')}</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4 text-left">
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-left dark:border-red-800 dark:bg-red-900/20">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                        <p className="flex-1 text-sm text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="companyName">{t('companyName')}</Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Acme Inc."
                      disabled={loading || googleAuthLoading}
                      {...register('companyName')}
                    />
                    {errors.companyName && (
                      <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {errors.companyName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@esempio.com"
                      disabled={loading || googleAuthLoading}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      disabled={loading || googleAuthLoading}
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      disabled={loading || googleAuthLoading}
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <p className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" className="w-full" disabled={loading || googleAuthLoading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tCommon('loading')}
                      </>
                    ) : (
                      t('register')
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    {t('alreadyHaveAccount')}{' '}
                    <Link href={`/${locale}/auth/login`} className="font-medium text-primary hover:underline">
                      {t('loginHere')}
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>

      <div className="relative hidden bg-muted lg:block">
        {registerImage ? (
          <>
            <Image src={registerImage} alt="Team working illustration" fill priority className="object-cover" />
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
