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

export default function RegisterPage() {
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
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true)
    setError('')

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
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (!authData.user) {
        setError(tErrors('generic'))
        return
      }

      // Sign in to establish session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (signInError) {
        setError('Registrazione completata ma errore nel login: ' + signInError.message)
        return
      }

      // Now create company settings with authenticated session
      const { error: companyError } = await supabase
        .from('company_settings')
        .insert({
          user_id: authData.user.id,
          company_name: data.companyName,
          country: 'Switzerland',
        })

      if (companyError) {
        console.error('Error creating company settings:', companyError)
        setError('Errore nella creazione delle impostazioni azienda: ' + companyError.message)
        return
      }

      router.push(`/${locale}/dashboard`)
      router.refresh()
    } catch (err) {
      console.error('Registration error:', err)
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t('register')}</CardTitle>
          <CardDescription>
            {t('registerTitle')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('companyName')}</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="La mia azienda"
                {...register('companyName')}
              />
              {errors.companyName && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.companyName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@esempio.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tCommon('loading') : t('register')}
            </Button>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              {t('alreadyHaveAccount')}{' '}
              <Link href={`/${locale}/auth/login`} className="text-primary hover:underline">
                {t('loginHere')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

