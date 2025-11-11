'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSubscription } from '@/hooks/use-subscription'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  ExternalLink,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

export default function ManageSubscriptionPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('subscription.manage')
  const tCommon = useTranslations('common')
  const { subscription, loading, openCustomerPortal } = useSubscription()
  const [cancelling, setCancelling] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)

  const handleCancelSubscription = async () => {
    setCancelling(true)
    try {
      // TODO: Implementare la cancellazione dell'abbonamento
      toast.success(t('cancelSuccess'))
      router.push(`/${locale}/dashboard/subscription`)
    } catch (error) {
      toast.error(t('cancelError'))
      console.error(error)
    } finally {
      setCancelling(false)
    }
  }

  const handleManagePayment = async () => {
    setOpeningPortal(true)
    try {
      await openCustomerPortal()
    } catch (error) {
      toast.error(t('portalError'))
      console.error(error)
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/dashboard/subscription`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('noSubscription')}</AlertTitle>
          <AlertDescription>
            {t('noSubscriptionDescription')}
          </AlertDescription>
        </Alert>

        <Button onClick={() => router.push(`/${locale}/dashboard/subscription`)}>
          {t('viewPlans')}
        </Button>
      </div>
    )
  }

  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const isCanceled = subscription.status === 'canceled'
  const isPastDue = subscription.status === 'past_due'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/subscription`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Status Alert */}
      {isCanceled && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{t('statusCanceled')}</AlertTitle>
          <AlertDescription>
            {t('statusCanceledDescription', { 
              date: subscription.current_period_end ? formatDate(subscription.current_period_end, locale) : '' 
            })}
          </AlertDescription>
        </Alert>
      )}

      {isPastDue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('statusPastDue')}</AlertTitle>
          <AlertDescription>
            {t('statusPastDueDescription')}
          </AlertDescription>
        </Alert>
      )}

      {isActive && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>{t('statusActive')}</AlertTitle>
          <AlertDescription>
            {t('statusActiveDescription')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t('currentPlan')}
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {subscription.plan?.name || 'Free'}
              </Badge>
            </CardTitle>
            <CardDescription>{t('currentPlanDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('price')}</span>
              </div>
              <span className="text-2xl font-bold">
                CHF {subscription.plan?.price || 0}
                <span className="text-sm font-normal text-muted-foreground">/mese</span>
              </span>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('statusLabel')}</span>
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {t(`status.${subscription.status}`)}
                </Badge>
              </div>

              {subscription.current_period_start && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('startDate')}</span>
                  <span className="font-medium">
                    {formatDate(subscription.current_period_start, locale)}
                  </span>
                </div>
              )}

              {subscription.current_period_end && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isCanceled ? t('endsOn') : t('renewsOn')}
                  </span>
                  <span className="font-medium">
                    {formatDate(subscription.current_period_end, locale)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push(`/${locale}/dashboard/subscription`)}
            >
              {t('changePlan')}
            </Button>
          </CardFooter>
        </Card>

        {/* Payment & Billing Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('paymentBilling')}</CardTitle>
            <CardDescription>{t('paymentBillingDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('managePaymentDescription')}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button
              className="w-full"
              variant="outline"
              onClick={handleManagePayment}
              disabled={openingPortal}
            >
              {openingPortal ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('managePayment')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Usage Limits Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('usageLimits')}</CardTitle>
          <CardDescription>{t('usageLimitsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('clients')}</span>
                <span className="text-sm text-muted-foreground">
                  {subscription.plan?.max_clients === null
                    ? t('unlimited')
                    : `0 / ${subscription.plan?.max_clients || 0}`}
                </span>
              </div>
              {subscription.plan?.max_clients !== null && (
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: '0%' }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('invoices')}</span>
                <span className="text-sm text-muted-foreground">
                  {subscription.plan?.max_invoices === null
                    ? t('unlimited')
                    : `0 / ${subscription.plan?.max_invoices || 0}`}
                </span>
              </div>
              {subscription.plan?.max_invoices !== null && (
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: '0%' }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('quotes')}</span>
                <span className="text-sm text-muted-foreground">
                  {subscription.plan?.max_quotes === null
                    ? t('unlimited')
                    : `0 / ${subscription.plan?.max_quotes || 0}`}
                </span>
              </div>
              {subscription.plan?.max_quotes !== null && (
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: '0%' }}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isActive && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
            <CardDescription>{t('dangerZoneDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('cancelWarning')}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('cancelSubscription')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('cancelConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('cancelConfirmDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tCommon('loading')}
                      </>
                    ) : (
                      t('confirmCancel')
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

