"use client";

import { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubscriptionPage() {
  const { subscription, plans, loading, createCheckoutSession, openCustomerPortal } = useSubscription();
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planId: string) => {
    try {
      setProcessingPlanId(planId);
      await createCheckoutSession(priceId, planId);
    } catch (error) {
      toast.error('Errore durante la creazione della sessione di checkout');
      setProcessingPlanId(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      toast.error('Errore durante l\'apertura del portale clienti');
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
        <h1 className="text-3xl font-bold mb-2">Abbonamenti</h1>
        <p className="text-muted-foreground">
          Scegli il piano perfetto per la tua attività
        </p>
      </div>

      {subscription?.cancel_at_period_end && (
        <Card className="mb-8 border-orange-500">
          <CardHeader>
            <CardTitle className="text-orange-600">Il tuo abbonamento verrà cancellato</CardTitle>
            <CardDescription>
              Il tuo abbonamento {currentPlan} terminerà il{' '}
              {subscription.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString('it-IT')
                : ''}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {subscription && isActiveSubscription && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Abbonamento Corrente</CardTitle>
            <CardDescription>
              Stai utilizzando il piano {currentPlan}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {subscription.current_period_end && (
                <>
                  Il tuo abbonamento si rinnova il{' '}
                  {new Date(subscription.current_period_end).toLocaleDateString('it-IT')}
                </>
              )}
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleManageSubscription} variant="outline">
              Gestisci Abbonamento
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
                  <Badge>Piano Corrente</Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">
                    {plan.price === 0 ? 'Gratis' : `CHF ${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">
                      /{plan.interval === 'month' ? 'mese' : 'anno'}
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
                          ? 'Clienti illimitati'
                          : `Fino a ${plan.max_clients} clienti`}
                      </span>
                    </li>
                  )}
                  {plan.max_invoices !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {plan.max_invoices === null
                          ? 'Fatture illimitate'
                          : `Fino a ${plan.max_invoices} fatture/mese`}
                      </span>
                    </li>
                  )}
                  {plan.max_quotes !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {plan.max_quotes === null
                          ? 'Preventivi illimitati'
                          : `Fino a ${plan.max_quotes} preventivi/mese`}
                      </span>
                    </li>
                  )}
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button disabled className="w-full">
                    Piano Corrente
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
                        Caricamento...
                      </>
                    ) : (
                      `Passa a ${plan.name}`
                    )}
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    Piano Gratuito
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Domande Frequenti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Posso cambiare piano in qualsiasi momento?</h3>
            <p className="text-sm text-muted-foreground">
              Sì, puoi aggiornare o declassare il tuo piano in qualsiasi momento. Le modifiche
              avranno effetto immediato e verrà calcolato un credito proporzionale.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Come vengono conteggiati i limiti?</h3>
            <p className="text-sm text-muted-foreground">
              I limiti di fatture e preventivi si rinnovano ogni mese. I clienti sono un limite
              totale per il piano Free e Pro.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Cosa succede se cancello il mio abbonamento?</h3>
            <p className="text-sm text-muted-foreground">
              Potrai continuare a utilizzare il piano a pagamento fino alla fine del periodo di
              fatturazione. Dopo, tornerai automaticamente al piano gratuito.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

