"use client";

import { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { getFeatureTranslationKey } from '@/lib/utils/feature-translator';

export default function SubscriptionPage() {
  const { subscription, plans, loading, createCheckoutSession, openCustomerPortal } = useSubscription();
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const t = useTranslations('subscription.page');
  const tFeatures = useTranslations('subscription.features');
  const params = useParams();
  const locale = params.locale as string;

  const handleSubscribe = async (priceId: string, planId: string) => {
    try {
      setProcessingPlanId(planId);
      await createCheckoutSession(priceId, planId);
    } catch (error) {
      toast.error(t('errorCheckout'));
      setProcessingPlanId(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      toast.error(t('errorPortal'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentPlan = (subscription?.plan as any)?.name || 'Free';
  const isActiveSubscription = subscription?.status === 'active';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {subscription?.cancel_at_period_end && (
        <Card className="mb-8 border-orange-500">
          <CardHeader>
            <CardTitle className="text-orange-600">{t('cancelWarningTitle')}</CardTitle>
            <CardDescription>
              {t('cancelWarningDescription', {
                plan: currentPlan,
                date: subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString(locale)
                  : ''
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {subscription && isActiveSubscription && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('currentSubscriptionTitle')}</CardTitle>
            <CardDescription>
              {t('currentSubscriptionDescription', { plan: currentPlan })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {subscription.current_period_end && (
                t('renewsOn', {
                  date: new Date(subscription.current_period_end).toLocaleDateString(locale)
                })
              )}
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleManageSubscription} variant="outline">
              {t('manageSubscription')}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = plan.name === currentPlan;
          const features = Array.isArray(plan.features) ? plan.features : [];

          return (
            <Card
              key={plan.id}
              className={`relative ${isCurrentPlan ? 'border-primary shadow-lg' : ''}`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge>{t('currentPlanBadge')}</Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">
                    {plan.price === 0 ? t('free') : `CHF ${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">
                      /{plan.interval === 'month' ? t('perMonth') : t('perYear')}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.max_clients !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {plan.max_clients === null
                          ? t('unlimitedClients')
                          : t('upToClients', { count: plan.max_clients })}
                      </span>
                    </li>
                  )}
                  {plan.max_invoices !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {plan.max_invoices === null
                          ? t('unlimitedInvoices')
                          : t('upToInvoices', { count: plan.max_invoices })}
                      </span>
                    </li>
                  )}
                  {plan.max_quotes !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {plan.max_quotes === null
                          ? t('unlimitedQuotes')
                          : t('upToQuotes', { count: plan.max_quotes })}
                      </span>
                    </li>
                  )}
                  {features.map((feature, index) => {
                    const translationKey = getFeatureTranslationKey(feature);
                    const translatedFeature = translationKey ? tFeatures(translationKey) : feature;
                    
                    return (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        <span className="text-sm">{translatedFeature}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button disabled className="w-full">
                    {t('currentPlanBadge')}
                  </Button>
                ) : plan.stripe_price_id ? (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.stripe_price_id!, plan.id)}
                    disabled={processingPlanId === plan.id}
                  >
                    {processingPlanId === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('loading')}
                      </>
                    ) : (
                      t('upgradeTo', { plan: plan.name })
                    )}
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    {t('freePlan')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('faqTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">{t('faq1Question')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('faq1Answer')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">{t('faq2Question')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('faq2Answer')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">{t('faq3Question')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('faq3Answer')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

