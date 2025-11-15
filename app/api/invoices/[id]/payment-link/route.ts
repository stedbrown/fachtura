import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { logger } from '@/lib/logger'
import { safeAsync } from '@/lib/error-handler'

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

    // Get company settings for currency
    const { data: company } = await supabase
      .from('company_settings')
      .select('currency')
      .eq('user_id', user.id)
      .single()

    const currency = company?.currency || 'CHF'

    // Convert total to cents (Stripe uses minor currency units)
    const amountInCents = Math.round(invoice.total * 100)

    // Create Stripe product for this invoice
    const product = await stripe.products.create({
      name: `Fattura ${invoice.invoice_number}`,
      description: `Fattura ${invoice.invoice_number} per ${invoice.client?.name || 'Cliente'}`,
    })

    // Create Stripe price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountInCents,
      currency: currency.toLowerCase(),
    })

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        user_id: user.id,
      },
    })

    logger.debug('Payment link created', {
      invoiceId: invoice.id,
      paymentLinkId: paymentLink.id,
      url: paymentLink.url,
    })

    // Store payment link in invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
      })
      .eq('id', invoice.id)

    if (updateError) {
      logger.warn('Error updating invoice with payment link', updateError, { invoiceId: invoice.id })
      // Continue anyway as payment link was created successfully
    }

    return {
      paymentLinkUrl: paymentLink.url,
      paymentLinkId: paymentLink.id,
    }
  }, 'Error creating payment link')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    logger.error('Error creating payment link', result.details, { invoiceId: id })
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }
}

