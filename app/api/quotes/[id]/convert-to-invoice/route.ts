import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get quote with items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Check if quote is accepted
    if (quote.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Only accepted quotes can be converted to invoices' },
        { status: 400 }
      )
    }

    // Get quote items
    const { data: quoteItems } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', id)

    if (!quoteItems || quoteItems.length === 0) {
      return NextResponse.json(
        { error: 'Quote has no items' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber()

    // Calculate due date (30 days from today)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: quote.client_id,
        invoice_number: invoiceNumber,
        date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'draft',
        subtotal: quote.subtotal,
        tax_amount: quote.tax_amount,
        total: quote.total,
        notes: quote.notes
          ? `${quote.notes}\n\n[Convertito dal preventivo ${quote.quote_number}]`
          : `Convertito dal preventivo ${quote.quote_number}`,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      logger.error('Error creating invoice', invoiceError, { quoteId: id })
      return NextResponse.json(
        { error: 'Error creating invoice' },
        { status: 500 }
      )
    }

    // Create invoice items from quote items
    const invoiceItems = quoteItems.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      line_total: item.line_total,
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems)

    if (itemsError) {
      logger.error('Error creating invoice items', itemsError, { invoiceId: invoice.id, quoteId: id })
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Error creating invoice items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
    })
  } catch (error) {
    logger.error('Error converting quote to invoice', error, { quoteId: id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

