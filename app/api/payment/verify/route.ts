import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { logger } from '@/lib/logger'
import { safeAsync } from '@/lib/error-handler'
import Stripe from 'stripe'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    )
  }

  const result = await safeAsync(async () => {
    const supabase = await createClient()
    
    // First, find the invoice with this session ID to get the stripe_account_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, stripe_account_id, stripe_checkout_session_id, payment_status, status, user_id, invoice_number, total')
      .eq('stripe_checkout_session_id', sessionId)
      .single()

    if (invoiceError || !invoice) {
      logger.warn('Invoice not found for session', { sessionId, error: invoiceError })
      return {
        success: false,
        paid: false,
        message: 'Invoice not found for this checkout session',
      }
    }

    if (!invoice.stripe_account_id) {
      logger.error('Invoice missing stripe_account_id', { invoiceId: invoice.id, sessionId })
      return {
        success: false,
        paid: false,
        message: 'Invoice is missing Stripe account information',
      }
    }

    // Retrieve checkout session from Stripe Connect account
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {
        expand: ['payment_intent'],
      },
      {
        stripeAccount: invoice.stripe_account_id,
      }
    )

    logger.info('Verifying payment session', {
      sessionId,
      paymentStatus: session.payment_status,
      status: session.status,
      metadata: session.metadata,
      stripeAccount: invoice.stripe_account_id,
    })

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return {
        success: false,
        paid: false,
        paymentStatus: session.payment_status,
        message: 'Payment not yet completed',
      }
    }

    // Update if not already paid
    if (invoice.payment_status !== 'paid' || invoice.status !== 'paid') {
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
        .eq('id', invoice.id)

      if (updateError) {
        logger.error('Error updating invoice status', {
          error: updateError,
          invoiceId: invoice.id,
          sessionId,
        })
        return {
          success: false,
          paid: true,
          message: 'Payment successful but failed to update invoice status',
        }
      }

      logger.info('Invoice status updated successfully', {
        invoiceId: invoice.id,
        sessionId,
        previousStatus: invoice.status,
        previousPaymentStatus: invoice.payment_status,
      })

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: invoice.user_id,
        p_type: 'invoice_paid',
        p_title: 'Fattura pagata',
        p_message: `La fattura ${invoice.invoice_number} di ${invoice.total} CHF è stata pagata!`,
        p_entity_type: 'invoice',
        p_entity_id: invoice.id,
        p_priority: 'high',
        p_channels: ['in_app', 'email'],
        p_metadata: {
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          payment_method: session.payment_method_types?.[0] || 'unknown',
        },
        p_action_url: `/dashboard/invoices/${invoice.id}`,
        p_action_label: 'Visualizza fattura'
      })
    } else {
      logger.info('Invoice already marked as paid', { invoiceId: invoice.id, sessionId })
    }

    return {
      success: true,
      paid: true,
      invoiceId: invoice.id,
      message: 'Payment verified and invoice updated',
    }
  }, 'Error verifying payment')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    const errorDetails = result.details || result.error
    logger.error('Payment verification failed', errorDetails, { sessionId })
    return NextResponse.json(
      { error: result.error, success: false },
      { status: 500 }
    )
  }
}

