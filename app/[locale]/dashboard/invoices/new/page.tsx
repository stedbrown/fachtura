'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { EnhancedDocumentCreator } from '@/components/documents/enhanced-document-creator'
import { InvoiceLivePreview } from '@/components/invoices/invoice-live-preview'
import type { Client, Product } from '@/lib/types/database'
import type { ItemInput } from '@/components/documents/steps/items-step'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export default function NewInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [invoiceNumber] = useState(generateInvoiceNumber())

  useEffect(() => {
    loadClients()
    loadProducts()
  }, [])

  const loadClients = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name')

    if (data) setClients(data)
  }

  const loadProducts = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')

    if (data) setProducts(data)
  }

  const handleSave = async (data: {
    clientId: string
    date: string
    dueDate?: string
    status: string
    items: ItemInput[]
    notes: string
  }) => {
    const result = await safeAsync(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(tCommon('error') || 'Utente non autenticato')
      }

      const totals = calculateInvoiceTotals(
        data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          product_id: item.product_id,
        }))
      )

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: data.clientId,
          invoice_number: invoiceNumber,
          date: data.date,
          due_date: data.dueDate || null,
          status: data.status,
          notes: data.notes || null,
          subtotal: totals.subtotal,
          tax_amount: totals.totalTax,
          total: totals.total,
        })
        .select()
        .single()

      if (invoiceError || !invoiceData) {
        throw invoiceError || new Error('Errore creazione fattura')
      }

      // Create items
      const itemsToInsert = data.items.map((item) => ({
        invoice_id: invoiceData.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsError) {
        // Rollback: delete invoice if items insertion fails
        await supabase.from('invoices').delete().eq('id', invoiceData.id)
        throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
      }

      return invoiceData
    }, 'Error saving invoice')

    if (result.success) {
      // Return the invoice data instead of navigating immediately
      // Navigation will be handled by the actions step
      return result.data
    } else {
      const errorMessage = getSupabaseErrorMessage(result.error)
      logger.error('Error creating invoice', result.details)
      toast.error(errorMessage || t('createError') || tCommon('error'))
      throw new Error(errorMessage || t('createError') || tCommon('error'))
    }
  }

  // Create preview component function
  const previewComponent = useMemo(() => {
    return (data: {
      clientId: string
      date: string
      dueDate?: string
      status: string
      items: ItemInput[]
      notes: string
    }) => (
      <InvoiceLivePreview
        clientId={data.clientId}
        clients={clients}
        date={data.date}
        dueDate={data.dueDate || ''}
        status={data.status as 'draft' | 'issued' | 'paid' | 'overdue'}
        notes={data.notes}
        items={data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          product_id: item.product_id,
        }))}
        locale={locale}
        invoiceNumber={invoiceNumber}
        compact
      />
    )
  }, [clients, locale, invoiceNumber])

  return (
    <EnhancedDocumentCreator
      type="invoice"
      clients={clients}
      products={products}
      locale={locale}
      onSave={handleSave}
      previewComponent={previewComponent}
      onCreateClient={() => {
        router.push(`/${locale}/dashboard/clients?create=true`)
      }}
    />
  )
}
