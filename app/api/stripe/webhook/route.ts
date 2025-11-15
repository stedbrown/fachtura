import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
};

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription;
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;

        if (userId && planId) {
          await supabase
            .from('user_subscriptions')
            .update({
              stripe_subscription_id: session.subscription as string,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
            })
            .eq('user_id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;

        if (subscription.object === 'subscription') {
          const sub = subscription as SubscriptionWithPeriod;
          await supabase
            .from('user_subscriptions')
            .update({
              status: sub.status,
              current_period_start: new Date(
                sub.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                sub.current_period_end * 1000
              ).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end,
            })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        if (subscription.object === 'subscription') {
          const sub = subscription as SubscriptionWithPeriod;
          // Ottieni il piano Free
          const { data: freePlan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('name', 'Free')
            .single();

          await supabase
            .from('user_subscriptions')
            .update({
              status: 'canceled',
              plan_id: freePlan?.id,
              stripe_subscription_id: null,
              current_period_end: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as InvoiceWithSubscription;

        if (invoice.subscription) {
          const subscriptionId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription?.id;

          if (subscriptionId) {
            const subscription = (await stripe.subscriptions.retrieve(
              subscriptionId
            )) as unknown as SubscriptionWithPeriod;

            await supabase
              .from('user_subscriptions')
              .update({
                status: 'active',
                current_period_start: new Date(
                  subscription.current_period_start * 1000
                ).toISOString(),
                current_period_end: new Date(
                  subscription.current_period_end * 1000
                ).toISOString(),
              })
              .eq('stripe_subscription_id', subscription.id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as InvoiceWithSubscription;

        if (invoice.subscription) {
          const subscriptionId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription?.id;

          if (subscriptionId) {
            await supabase
              .from('user_subscriptions')
              .update({
                status: 'past_due',
              })
              .eq('stripe_subscription_id', subscriptionId);
          }
        }
        break;
      }

      // ============================================
      // INVOICE PAYMENT EVENTS (for customer invoices)
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is for an invoice payment (not subscription)
        const invoiceId = session.metadata?.invoice_id;
        
        if (invoiceId && !session.subscription) {
          // This is a one-time invoice payment
          const { error: updateError } = await supabase
            .from('invoices')
            .update({
              status: 'paid',
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: typeof session.payment_intent === 'string' 
                ? session.payment_intent 
                : session.payment_intent?.id || null,
            })
            .eq('id', invoiceId);

          if (updateError) {
            logger.error('Error updating invoice payment status', updateError, { invoiceId, sessionId: session.id });
          } else {
            // Create notification for user
            const { data: invoice } = await supabase
              .from('invoices')
              .select('user_id, invoice_number, total')
              .eq('id', invoiceId)
              .single();

            if (invoice) {
              await supabase.rpc('create_notification', {
                p_user_id: invoice.user_id,
                p_type: 'invoice_paid',
                p_title: 'Fattura pagata',
                p_message: `La fattura ${invoice.invoice_number} di ${invoice.total} CHF è stata pagata!`,
                p_entity_type: 'invoice',
                p_entity_id: invoiceId,
                p_priority: 'high',
                p_channels: '["in_app", "email"]'::jsonb,
                p_metadata: {
                  invoice_number: invoice.invoice_number,
                  total: invoice.total,
                  payment_method: session.payment_method_types?.[0] || 'unknown',
                },
                p_action_url: `/dashboard/invoices/${invoiceId}`,
                p_action_label: 'Visualizza fattura'
              });
            }

            logger.info('Invoice payment completed', { invoiceId, sessionId: session.id });
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          // Update invoice if not already updated by checkout.session.completed
          const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('payment_status')
            .eq('id', invoiceId)
            .single();

          if (existingInvoice && existingInvoice.payment_status !== 'paid') {
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                status: 'paid',
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntent.id,
              })
              .eq('id', invoiceId);

            if (!updateError) {
              logger.info('Invoice payment confirmed via payment_intent', { invoiceId, paymentIntentId: paymentIntent.id });
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({
              payment_status: 'failed',
            })
            .eq('id', invoiceId);

          if (!updateError) {
            logger.info('Invoice payment failed', { invoiceId, paymentIntentId: paymentIntent.id });
          }
        }
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`, { eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook', error, { eventType: event?.type });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

