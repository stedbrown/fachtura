'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'

type LoginFormProps = {
  locale: string
}

export function LoginForm({ locale }: LoginFormProps) {
  const router = useRouter()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false)

  const supabase = useMemo(() => {
    logger.debug('login: creating supabase client instance')
    return createClient()
  }, [])

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

  useEffect(() => {
    const checkSession = async () => {
      logger.info('login: checking for existing session')
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        logger.info('login: existing session found, redirecting', { locale })
        router.replace(`/${locale}/dashboard`)
      }
    }

    void checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('login: auth state change received', { event })
      if (session) {
        logger.info('login: session present after auth change, redirecting', { locale })
        router.replace(`/${locale}/dashboard`)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [locale, router, supabase])

  const handleLogin = async (formData: LoginInput) => {
    logger.info('login: user submitted credentials', { email: formData.email })
    setLoading(true)
    setError('')

    const result = await safeAsync(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (signInError) {
        throw signInError
      }
    }, 'Error signing in with email')

    if (result.success) {
      logger.info('login: email authentication successful, redirecting to dashboard', { locale })
      router.replace(`/${locale}/dashboard`)
      router.refresh()
      return
    }

    setLoading(false)
    const message = extractErrorMessage(result.error, result.details)

    if (message.includes('Invalid login credentials')) {
      setError(t('invalidCredentials'))
    } else if (message.includes('Email not confirmed')) {
      setError(t('emailNotConfirmed'))
    } else {
      setError(getSupabaseErrorMessage(result.details) || message || tErrors('generic'))
    }

    logger.error('login: email authentication failed', result.details, { email: formData.email })
  }

  const handleGoogleAuth = async () => {
    if (typeof window === 'undefined') return

    logger.info('login: initiating google oauth flow')
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
    }, 'Error logging in with Google')

    if (!result.success) {
      setGoogleAuthLoading(false)
      const message = getSupabaseErrorMessage(result.details) || extractErrorMessage(result.error, result.details)
      logger.error('login: google oauth failed', result.details, { message })
      setError(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleLogin)} className="flex flex-col gap-6">
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t('login')}</h1>
          <p className="text-muted-foreground text-sm text-balance">{t('loginTitle')}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div className="text-sm">
                {error}
                {error === t('emailNotConfirmed') && (
                  <p className="mt-1 flex items-center gap-1 text-xs">
                    <Mail className="h-3 w-3" />
                    {t('checkYourEmail')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            disabled={loading || googleAuthLoading}
            {...register('email')}
          />
          {errors.email && (
            <FieldDescription className="flex items-center gap-1 text-left text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </FieldDescription>
          )}
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
            <Link
              href="#"
              className="ml-auto text-sm text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline"
            >
              {t('forgotPasswordShort')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading || googleAuthLoading}
            {...register('password')}
          />
          {errors.password && (
            <FieldDescription className="flex items-center gap-1 text-left text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </FieldDescription>
          )}
        </Field>

        <Field>
          <Button type="submit" disabled={loading || googleAuthLoading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon('loading')}
              </>
            ) : (
              t('login')
            )}
          </Button>
        </Field>

        <FieldSeparator>{t('orContinueWithEmail')}</FieldSeparator>

        <Field>
          <Button variant="outline" type="button" onClick={handleGoogleAuth} disabled={googleAuthLoading || loading}>
            {googleAuthLoading ? (
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
          <FieldDescription className="text-center">
            {t('dontHaveAccount')}{' '}
            <Link href={`/${locale}/auth/register`} className="font-medium underline underline-offset-4">
              {t('registerHere')}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M12 2.4c2.04 0 3.82.7 5.22 1.86l2.5-2.5C17.5.54 14.9-.29 12-.29 6.84-.29 2.45 2.87.66 7.36l2.98 2.32C4.57 5.93 7.95 2.4 12 2.4zM23.64 12.27c0-.85-.08-1.67-.22-2.45H12v4.62h6.54a5.6 5.6 0 0 1-2.42 3.67l3.72 2.89c2.16-2 3.4-4.94 3.4-8.73zM3.64 14.32a8.58 8.58 0 0 1 0-4.63L.66 7.36a11.94 11.94 0 0 0-.01 9.27l2.99-2.31zM12 24c3.24 0 5.96-1.07 7.95-2.91l-3.72-2.89c-1.03.69-2.34 1.1-3.96 1.1-3.05 0-5.64-2.06-6.56-4.83l-2.99 2.31C4.51 21.35 7.96 24 12 24z"
      />
    </svg>
  )
}
