'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { EnhancedDocumentCreator } from '@/components/documents/enhanced-document-creator'
import { QuoteLivePreview } from '@/components/quotes/quote-live-preview'
import type { Client, Product } from '@/lib/types/database'
import type { ItemInput } from '@/components/documents/steps/items-step'
import { calculateQuoteTotals, generateQuoteNumber } from '@/lib/utils/quote-utils'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

export default function NewQuotePage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('quotes')
  const tCommon = useTranslations('common')
  
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quoteNumber] = useState(generateQuoteNumber())

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
    validUntil?: string
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

      const totals = calculateQuoteTotals(
        data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          product_id: item.product_id,
        }))
      )

      // Create quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          client_id: data.clientId,
          quote_number: quoteNumber,
          date: data.date,
          valid_until: data.validUntil || null,
          status: data.status,
          notes: data.notes || null,
          subtotal: totals.subtotal,
          tax_amount: totals.totalTax,
          total: totals.total,
        })
        .select()
        .single()

      if (quoteError || !quoteData) {
        throw quoteError || new Error('Errore creazione preventivo')
      }

      // Create items
      const itemsToInsert = data.items.map((item) => ({
        quote_id: quoteData.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert)

      if (itemsError) {
        // Rollback: delete quote if items insertion fails
        await supabase.from('quotes').delete().eq('id', quoteData.id)
        throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
      }

      return quoteData
    }, 'Error saving quote')

    if (result.success) {
      // Return the quote data instead of navigating immediately
      // Navigation will be handled by the actions step
      return result.data
    } else {
      const errorMessage = getSupabaseErrorMessage(result.error)
      logger.error('Error creating quote', result.details)
      toast.error(errorMessage || t('createError') || tCommon('error'))
      throw new Error(errorMessage || t('createError') || tCommon('error'))
    }
  }

  // Create preview component function
  const previewComponent = useMemo(() => {
    return (data: {
      clientId: string
      date: string
      validUntil?: string
      status: string
      items: ItemInput[]
      notes: string
    }) => (
      <QuoteLivePreview
        clientId={data.clientId}
        clients={clients}
        date={data.date}
        validUntil={data.validUntil || ''}
        status={data.status as 'draft' | 'sent' | 'accepted' | 'rejected'}
        notes={data.notes}
        items={data.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          product_id: item.product_id,
        }))}
        locale={locale}
        quoteNumber={quoteNumber}
        compact
      />
    )
  }, [clients, locale, quoteNumber])

  return (
    <EnhancedDocumentCreator
      type="quote"
      clients={clients}
      products={products}
      locale={locale}
      onSave={handleSave}
      previewComponent={previewComponent}
      onClientsChange={(updatedClients) => {
        setClients(updatedClients)
      }}
    />
  )
}
