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

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found')
    }

    // Check if invoice has a checkout session
    if (!invoice.stripe_checkout_session_id) {
      return {
        success: false,
        message: 'Invoice does not have a checkout session',
      }
    }

    // Check if invoice has stripe_account_id
    if (!invoice.stripe_account_id) {
      return {
        success: false,
        message: 'Invoice does not have a Stripe Connect account ID',
      }
    }

    // Retrieve checkout session from Stripe Connect account
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(
        invoice.stripe_checkout_session_id,
        {
          expand: ['payment_intent'],
        },
        {
          stripeAccount: invoice.stripe_account_id,
        }
      )
    } catch (error: any) {
      logger.error('Error retrieving checkout session', {
        error: error.message,
        sessionId: invoice.stripe_checkout_session_id,
        stripeAccount: invoice.stripe_account_id,
      })
      throw new Error('Failed to retrieve checkout session from Stripe')
    }

    logger.info('Verifying payment for invoice', {
      invoiceId: id,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
    })

    // Check if payment was successful
    if (session.payment_status === 'paid' && invoice.payment_status !== 'paid') {
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent)?.id || null

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq('id', id)

      if (updateError) {
        logger.error('Error updating invoice status', {
          error: updateError,
          invoiceId: id,
        })
        throw new Error('Failed to update invoice status')
      }

      logger.info('Invoice status updated successfully', {
        invoiceId: id,
        sessionId: session.id,
      })

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: invoice.user_id,
        p_type: 'invoice_paid',
        p_title: 'Fattura pagata',
        p_message: `La fattura ${invoice.invoice_number} di ${invoice.total} CHF è stata pagata!`,
        p_entity_type: 'invoice',
        p_entity_id: id,
        p_priority: 'high',
        p_channels: ['in_app', 'email'],
        p_metadata: {
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          payment_method: session.payment_method_types?.[0] || 'unknown',
        },
        p_action_url: `/dashboard/invoices/${id}`,
        p_action_label: 'Visualizza fattura'
      })

      return {
        success: true,
        paid: true,
        message: 'Invoice status updated to paid',
      }
    } else if (session.payment_status === 'paid' && invoice.payment_status === 'paid') {
      return {
        success: true,
        paid: true,
        message: 'Invoice is already marked as paid',
      }
    } else {
      return {
        success: false,
        paid: false,
        paymentStatus: session.payment_status,
        message: `Payment status: ${session.payment_status}`,
      }
    }
  }, 'Error verifying payment')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    logger.error('Payment verification failed', result.details, { invoiceId: id })
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }
}

