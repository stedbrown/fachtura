'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { AlertCircle, Loader2, Mail, Receipt } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (signInError) {
        // Handle common errors with user-friendly messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError(t('invalidCredentials'))
        } else if (signInError.message.includes('Email not confirmed')) {
          setError(t('emailNotConfirmed'))
        } else {
          setError(signInError.message)
        }
        return
      }

      router.push(`/${locale}/dashboard`)
      router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

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
            <CardTitle className="text-2xl font-bold text-center">{t('login')}</CardTitle>
            <CardDescription className="text-center">
              {t('loginTitle')}
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                    {error === t('emailNotConfirmed') && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {t('checkYourEmail')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@esempio.com"
                {...register('email')}
                disabled={loading}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')}</Label>
                {/* Future: Add forgot password link */}
                {/* <Link href={`/${locale}/auth/forgot-password`} className="text-xs text-primary hover:underline">
                  Password dimenticata?
                </Link> */}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={loading}
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
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
                t('login')
              )}
            </Button>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              {t('dontHaveAccount')}{' '}
              <Link href={`/${locale}/auth/register`} className="text-primary hover:underline font-medium">
                {t('registerHere')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
