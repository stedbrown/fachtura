'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { useTranslations } from 'next-intl'

interface StripeAccount {
  id: string
  user_id: string
  stripe_account_id: string
  stripe_account_type: 'express' | 'standard' | 'custom'
  is_active: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  email: string | null
  country: string | null
}

export function StripeConnectSection() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [stripeAccount, setStripeAccount] = React.useState<StripeAccount | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)

  React.useEffect(() => {
    loadStripeAccount()
  }, [])

  const loadStripeAccount = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setStripeAccount(data)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await fetch('/api/stripe/connect?return_url=' + encodeURIComponent(window.location.href))
      
      if (!response.ok) {
        throw new Error('Errore nella connessione a Stripe')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error: any) {
      logger.error('Error connecting Stripe', error)
      toast.error('Errore nella connessione a Stripe')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Sei sicuro di voler disconnettere il tuo account Stripe?')) {
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('stripe_accounts')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        throw error
      }

      setStripeAccount(null)
      toast.success('Account Stripe disconnesso')
    } catch (error: any) {
      logger.error('Error disconnecting Stripe', error)
      toast.error('Errore nella disconnessione')
    } finally {
      setLoading(false)
    }
  }

  // Check if account was just connected (from URL params)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accountId = params.get('account_id')
    
    if (accountId) {
      // Save account after onboarding
      fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            loadStripeAccount()
            toast.success('Account Stripe connesso con successo!')
            // Remove query params
            window.history.replaceState({}, '', window.location.pathname)
          }
        })
        .catch(err => {
          logger.error('Error saving Stripe account', err)
        })
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamenti Stripe
        </CardTitle>
        <CardDescription>
          Collega il tuo account Stripe per accettare pagamenti online dalle fatture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stripeAccount ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Collega il tuo account Stripe per permettere ai clienti di pagare le fatture online.
              I pagamenti verranno accreditati direttamente sul tuo account Stripe.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full sm:w-auto"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connessione in corso...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Collega Account Stripe
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Account Stripe Connesso</p>
                  {stripeAccount.is_active && stripeAccount.charges_enabled ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Attivo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      In attesa
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Tipo: {stripeAccount.stripe_account_type === 'express' ? 'Express' : stripeAccount.stripe_account_type}
                  {stripeAccount.country && ` • ${stripeAccount.country}`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Disconnetti'
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm font-medium mb-1">Pagamenti</p>
                <div className="flex items-center gap-2">
                  {stripeAccount.charges_enabled ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Abilitati</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Non abilitati</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Prelievi</p>
                <div className="flex items-center gap-2">
                  {stripeAccount.payouts_enabled ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Abilitati</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Non abilitati</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!stripeAccount.charges_enabled && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Completare l'onboarding su Stripe per abilitare i pagamenti. 
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 ml-1 text-yellow-800 dark:text-yellow-200"
                    onClick={handleConnect}
                  >
                    Continua onboarding
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

