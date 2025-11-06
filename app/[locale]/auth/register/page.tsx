'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Mail, AlertCircle, Loader2, Receipt } from 'lucide-react'

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const handleResendEmail = async () => {
    if (!registeredEmail) return
    
    setResending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
      })

      if (error) {
        setError(error.message)
      } else {
        setError('')
        // Show temporary success message (you could use a toast here)
        const tempMsg = error
        setError(t('emailResent'))
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      console.error('Resend error:', err)
    } finally {
      setResending(false)
    }
  }

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const supabase = createClient()
      
      // Register user
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
        // Handle common errors with user-friendly messages
        if (authError.message.includes('already registered')) {
          setError(t('userAlreadyExists'))
        } else if (authError.message.includes('password')) {
          setError(t('weakPassword'))
        } else {
          setError(authError.message)
        }
        return
      }

      if (!authData.user) {
        setError(tErrors('generic'))
        return
      }

      // Check if email confirmation is required
      if (authData.user && !authData.session) {
        // Email confirmation required - show success message
        setRegisteredEmail(data.email)
        setSuccess(true)
        return
      }

      // If we have a session (email confirmation disabled), create company and redirect
      if (authData.session) {
        const { error: companyError } = await supabase
          .from('company_settings')
          .insert({
            user_id: authData.user.id,
            company_name: data.companyName,
            country: 'Switzerland',
          })

        if (companyError) {
          console.error('Error creating company settings:', companyError)
          setError(tErrors('generic'))
          return
        }

        router.push(`/${locale}/dashboard`)
        router.refresh()
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  // Success state - email verification required
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Receipt className="h-8 w-8 text-primary" />
              </div>
              <span className="text-3xl font-bold">
                Fatturup
              </span>
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
                {t('registrationSuccess')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('checkYourEmail')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                    {registeredEmail}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t('emailVerificationMessageShort')}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-md text-sm text-center">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendEmail}
              disabled={resending}
            >
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

  // Registration form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Receipt className="h-8 w-8 text-primary" />
            </div>
            <span className="text-3xl font-bold">
              Fatturup
            </span>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">{t('register')}</CardTitle>
            <CardDescription className="text-center">
              {t('registerTitle')}
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400 flex-1">
                    {error}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('companyName')}</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Inc."
                {...register('companyName')}
                disabled={loading}
              />
              {errors.companyName && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
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
                {...register('email')}
                disabled={loading}
              />
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
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
                {...register('password')}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
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
                {...register('confirmPassword')}
                disabled={loading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </>
              ) : (
                t('register')
              )}
            </Button>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              {t('alreadyHaveAccount')}{' '}
              <Link href={`/${locale}/auth/login`} className="text-primary hover:underline font-medium">
                {t('loginHere')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
