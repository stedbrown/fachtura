import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { logger } from '@/lib/logger'
import { safeAsync } from '@/lib/error-handler'
import Stripe from 'stripe'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const result = await safeAsync(async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients (
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found')
    }

    // Check if user has Stripe Connect account
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!stripeAccount || !stripeAccount.charges_enabled) {
      throw new Error('Stripe account not connected or not ready. Please connect your Stripe account in settings.')
    }

    // Get company settings for currency
    const { data: company } = await supabase
      .from('company_settings')
      .select('currency')
      .eq('user_id', user.id)
      .single()

    const currency = company?.currency || 'CHF'

    // Convert total to cents (Stripe uses minor currency units)
    const amountInCents = Math.round(invoice.total * 100)

    // Create Stripe instance for connected account
    const connectedStripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    })

    // Create Stripe product for this invoice (on connected account)
    const product = await connectedStripe.products.create({
      name: `Fattura ${invoice.invoice_number}`,
      description: `Fattura ${invoice.invoice_number} per ${invoice.client?.name || 'Cliente'}`,
    }, {
      stripeAccount: stripeAccount.stripe_account_id,
    })

    // Create Stripe price (on connected account)
    const price = await connectedStripe.prices.create({
      product: product.id,
      unit_amount: amountInCents,
      currency: currency.toLowerCase(),
    }, {
      stripeAccount: stripeAccount.stripe_account_id,
    })

    // Create Checkout Session (better than Payment Link for invoices)
    const checkoutSession = await connectedStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel?invoice_id=${invoice.id}`,
      customer_email: invoice.client?.email || undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        user_id: user.id,
      },
      invoice_creation: {
        enabled: false, // We handle invoices ourselves
      },
    }, {
      stripeAccount: stripeAccount.stripe_account_id,
    })

    if (!checkoutSession.url) {
      logger.error('Checkout session created but URL is missing', {
        invoiceId: invoice.id,
        sessionId: checkoutSession.id,
        session: checkoutSession,
      })
      throw new Error('Impossibile ottenere il link di pagamento. La sessione è stata creata ma l\'URL non è disponibile.')
    }

    logger.debug('Checkout session created', {
      invoiceId: invoice.id,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })

    // Store checkout session info in invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        stripe_account_id: stripeAccount.stripe_account_id,
        stripe_checkout_session_id: checkoutSession.id,
        stripe_payment_link_url: checkoutSession.url,
        payment_status: 'pending',
      })
      .eq('id', invoice.id)

    if (updateError) {
      logger.warn('Error updating invoice with checkout session', { 
        error: updateError, 
        invoiceId: invoice.id 
      })
      // Continue anyway as checkout session was created successfully
    }

    return {
      paymentLinkUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    }
  }, 'Error creating payment link')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    logger.error('Error creating payment link', result.details || result.error, { invoiceId: id })
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }
}

