'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import type { CompanySettingsInsert } from '@/lib/types/database'

type RegisterFormProps = {
  locale: string
}

export function RegisterForm({ locale }: RegisterFormProps) {
  const router = useRouter()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false)

  const supabase = useMemo(() => {
    logger.debug('register: creating supabase client instance')
    return createClient()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const getRedirectUrl = () => {
    if (typeof window === 'undefined') {
      return `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/${locale}/dashboard`
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    return `${base.replace(/\/$/, '')}/${locale}/dashboard`
  }

  useEffect(() => {
    const checkSession = async () => {
      logger.info('register: checking for existing session')
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        logger.info('register: existing session found, redirecting', { locale })
        router.replace(`/${locale}/dashboard`)
      }
    }

    void checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('register: auth state change received', { event })
      if (session) {
        logger.info('register: session present after auth change, redirecting', { locale })
        router.replace(`/${locale}/dashboard`)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [locale, router, supabase])

  const handleGoogleAuth = async () => {
    if (typeof window === 'undefined') return

    logger.info('register: initiating google oauth flow')
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
      const message = getSupabaseErrorMessage(result.details) || result.error || tErrors('generic')
      logger.error('register: google oauth failed', result.details, { message })
      setError(message)
    }
  }

  const handleResendEmail = async () => {
    if (!registeredEmail) return

    logger.info('register: resend verification email triggered', { email: registeredEmail })
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
      logger.info('register: verification email resent successfully', { email: registeredEmail })
      setError(t('emailResent'))
      setTimeout(() => setError(''), 3000)
    } else {
      logger.error('register: resend verification email failed', result.details, { email: registeredEmail })
      setError(getSupabaseErrorMessage(result.details) || result.error || tErrors('generic'))
    }
  }

  const handleRegister = async (formData: RegisterInput) => {
    logger.info('register: form submitted', { email: formData.email })
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const emailCheckResponse = await safeAsync(async () => {
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        })

        if (!response.ok) {
          throw new Error(`Email check failed with status ${response.status}`)
        }

        return response.json() as Promise<{ allowed: boolean; message?: string }>
      }, 'Error verifying email availability')

      if (!emailCheckResponse.success) {
        logger.error('register: email verification request failed', emailCheckResponse.details)
        setError(getSupabaseErrorMessage(emailCheckResponse.details) || tErrors('generic'))
        return
      }

      const emailCheckResult = emailCheckResponse.data
      if (!emailCheckResult.allowed) {
        logger.info('register: email not allowed to register', { email: formData.email })
        setError(emailCheckResult.message ?? tErrors('generic'))
        return
      }

      logger.info('register: creating supabase user')
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            company_name: formData.companyName,
          },
          emailRedirectTo: getRedirectUrl(),
        },
      })

      if (authError) {
        logger.error('register: supabase sign up failed', authError, { email: formData.email })
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
        logger.error('register: supabase user missing after sign up', authData)
        setError(tErrors('generic'))
        return
      }

      if (!authData.session) {
        logger.info('register: signup requires email verification', { email: formData.email })
        setRegisteredEmail(formData.email)
        setSuccess(true)
        return
      }

      logger.info('register: creating default company settings', { userId: authData.user.id })
      const companySettings = {
        user_id: authData.user.id,
        company_name: formData.companyName,
        country: 'Switzerland',
      } satisfies CompanySettingsInsert

      const { error: companyError } = await supabase.from('company_settings').insert(companySettings)

      if (companyError) {
        logger.error('register: error creating company settings', companyError, { userId: authData.user.id })
        setError(tErrors('generic'))
        return
      }

      logger.info('register: signup complete, redirecting to dashboard', { locale })
      router.push(`/${locale}/dashboard`)
      router.refresh()
    } catch (err) {
      logger.error('register: unexpected error during registration', err)
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-full bg-primary/10 p-4 text-primary">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary">{t('registrationSuccess')}</h1>
          <p className="text-muted-foreground text-sm">{t('emailVerificationMessageShort')}</p>
        </div>
        <div className="w-full rounded-lg border border-border/60 bg-muted/40 p-4 text-left text-sm">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div className="space-y-1">
              <p className="font-medium">{registeredEmail}</p>
              <p className="text-muted-foreground text-xs">{t('checkYourEmail')}</p>
            </div>
          </div>
        </div>
        {error && <p className="rounded-md bg-primary/10 px-4 py-2 text-sm text-primary">{error}</p>}
        <div className="flex w-full flex-col gap-3">
          <Button variant="outline" onClick={handleResendEmail} disabled={resending}>
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon('loading')}
              </>
            ) : (
              t('resendEmail')
            )}
          </Button>
          <Link href={`/${locale}/auth/login`} className="text-sm underline underline-offset-4">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(handleRegister)} className="flex flex-col gap-6">
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t('createAccount')}</h1>
          <p className="text-muted-foreground text-sm text-balance">{t('registerTitle')}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="companyName">{t('companyName')}</FieldLabel>
          <Input
            id="companyName"
            type="text"
            placeholder="Acme Inc."
            autoComplete="organization"
            disabled={loading || googleAuthLoading}
            {...register('companyName')}
          />
          {errors.companyName && (
            <FieldDescription className="flex items-center gap-1 text-left text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.companyName.message}
            </FieldDescription>
          )}
        </Field>

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
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
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
          <FieldLabel htmlFor="confirmPassword">{t('confirmPassword')}</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading || googleAuthLoading}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <FieldDescription className="flex items-center gap-1 text-left text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.confirmPassword.message}
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
              t('register')
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
                {t('googleSignup')}
              </>
            )}
          </Button>
          <FieldDescription className="text-center">
            {t('alreadyHaveAccount')}{' '}
            <Link href={`/${locale}/auth/login`} className="font-medium underline underline-offset-4">
              {t('loginHere')}
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

