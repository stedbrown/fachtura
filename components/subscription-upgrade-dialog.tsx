"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useSubscription } from '@/hooks/use-subscription'
import { useTranslations } from 'next-intl'
import { getFeatureTranslationKey } from '@/lib/utils/feature-translator'

interface SubscriptionUpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  limitType: 'client' | 'invoice' | 'quote'
  currentCount: number
  maxCount: number
  planName: string
}

export function SubscriptionUpgradeDialog({
  open,
  onOpenChange,
  limitType,
  currentCount,
  maxCount,
  planName,
}: SubscriptionUpgradeDialogProps) {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { plans, loading } = useSubscription()
  const [upgrading, setUpgrading] = useState(false)
  const t = useTranslations('subscription')
  const tFeatures = useTranslations('subscription.features')

  const resourceLabel = t(`resources.${limitType}`)

  const handleUpgrade = () => {
    router.push(`/${locale}/dashboard/subscription`)
    onOpenChange(false)
  }

  // Filtra piani disponibili (escludi Free)
  const availablePlans = plans.filter(p => p.name !== 'Free' && p.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            <DialogTitle className="text-2xl">{t('upgradeDialog.title')}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {t('upgradeDialog.description', { max: maxCount, resource: resourceLabel, plan: planName })}
            <br />
            {t('upgradeDialog.subtitle')} 🚀
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 py-4">
          {availablePlans.map((plan) => {
            const isPro = plan.name === 'Pro'
            const isBusiness = plan.name === 'Business'
            
            return (
              <Card 
                key={plan.id} 
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  isPro ? 'border-blue-500 shadow-blue-100' : 'border-purple-500 shadow-purple-100'
                }`}
              >
                {isBusiness && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-pink-600 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                    {t('upgradeDialog.popular')}
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      {isPro ? <Zap className="h-5 w-5 text-blue-500" /> : <TrendingUp className="h-5 w-5 text-purple-500" />}
                      {plan.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-lg font-semibold mt-2">
                    <span className="text-3xl text-foreground">€{plan.price}</span>
                    <span className="text-muted-foreground">{plan.interval === 'month' ? t('upgradeDialog.perMonth') : t('upgradeDialog.perYear')}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        <strong>{plan.max_clients === null ? t('upgradeDialog.unlimited') : plan.max_clients}</strong> {t('upgradeDialog.clients')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        <strong>{plan.max_invoices === null ? t('upgradeDialog.unlimited') : plan.max_invoices}</strong> {t('upgradeDialog.invoices')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        <strong>{plan.max_quotes === null ? t('upgradeDialog.unlimited') : plan.max_quotes}</strong> {t('upgradeDialog.quotes')}
                      </span>
                    </div>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      {plan.features.map((feature, idx) => {
                        const translationKey = getFeatureTranslationKey(feature);
                        const translatedFeature = translationKey ? tFeatures(translationKey) : feature;
                        
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="text-sm">{translatedFeature}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>

                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isBusiness ? "default" : "outline"}
                    size="lg"
                    onClick={handleUpgrade}
                  >
                    {t('upgradeDialog.chooseplan', { plan: plan.name })}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {t('upgradeDialog.changeAnytime')}
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('upgradeDialog.notNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

