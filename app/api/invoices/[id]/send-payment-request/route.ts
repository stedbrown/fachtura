import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { safeAsync } from '@/lib/error-handler'

/**
 * POST /api/invoices/[id]/send-payment-request
 * Invia email al cliente con PDF fattura e link pagamento
 */
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

    if (!invoice.client?.email) {
      throw new Error('Client email is required to send payment request')
    }

    // Check if payment link exists, if not create it
    let paymentUrl = invoice.stripe_payment_link_url

    if (!paymentUrl) {
      // Create payment link first
      const paymentLinkResponse = await fetch(`${request.nextUrl.origin}/api/invoices/${id}/payment-link`, {
        method: 'POST',
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
        },
      })

      if (!paymentLinkResponse.ok) {
        const errorData = await paymentLinkResponse.json()
        throw new Error(errorData.error || 'Error creating payment link')
      }

      const { paymentLinkUrl } = await paymentLinkResponse.json()
      paymentUrl = paymentLinkUrl
    }

    // Get company settings
    const { data: company } = await supabase
      .from('company_settings')
      .select('company_name, email')
      .eq('user_id', user.id)
      .single()

    // For now, we'll use mailto link
    // In production, you'd use a service like Resend, SendGrid, or Supabase Edge Functions
    const subject = encodeURIComponent(`Fattura ${invoice.invoice_number} - Richiesta di pagamento`)
    const body = encodeURIComponent(
      `Gentile ${invoice.client.name},\n\n` +
      `Le inviamo la fattura ${invoice.invoice_number} per un importo di ${invoice.total.toFixed(2)} CHF.\n\n` +
      `Scadenza: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('it-IT') : 'Non specificata'}\n\n` +
      `Può pagare online tramite il seguente link:\n${paymentUrl}\n\n` +
      `Oppure può scaricare la fattura in PDF e procedere con il pagamento tradizionale.\n\n` +
      `Cordiali saluti,\n${company?.company_name || 'Il team'}`
    )

    // Update invoice status to 'issued' if still 'draft'
    if (invoice.status === 'draft') {
      await supabase
        .from('invoices')
        .update({
          status: 'issued',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)
    }

    logger.info('Payment request email prepared', {
      invoiceId: invoice.id,
      clientEmail: invoice.client.email,
      paymentUrl,
    })

    // Return mailto link for now
    // In production, you'd actually send the email via a service
    return {
      success: true,
      mailtoLink: `mailto:${invoice.client.email}?subject=${subject}&body=${body}`,
      message: 'Email ready to send. Click the mailto link to open your email client.',
    }
  }, 'Error sending payment request')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    logger.error('Error sending payment request', result.details, { invoiceId: id })
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }
}

