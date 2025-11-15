# Esempio di Integrazione - Enhanced Document Creator

## Come usare il nuovo componente

### Per Fatture

```tsx
// app/[locale]/dashboard/invoices/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EnhancedDocumentCreator } from '@/components/documents/enhanced-document-creator'
import { InvoiceLivePreview } from '@/components/invoices/invoice-live-preview'
import type { Client, Product } from '@/lib/types/database'
import type { ItemInput } from '@/components/documents/steps/items-step'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'

export default function NewInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  
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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Utente non autenticato')
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

    if (invoiceError || !invoiceData) throw invoiceError

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
      await supabase.from('invoices').delete().eq('id', invoiceData.id)
      throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
    }

    toast.success('Fattura creata con successo')
    router.push(`/${locale}/dashboard/invoices`)
  }

  // Create preview component
  const previewComponent = (
    <InvoiceLivePreview
      clientId={''} // Will be updated by EnhancedDocumentCreator
      clients={clients}
      date={''}
      dueDate={''}
      status="draft"
      notes={''}
      items={[]}
      locale={locale}
      invoiceNumber={invoiceNumber}
      compact
    />
  )

  return (
    <EnhancedDocumentCreator
      type="invoice"
      clients={clients}
      products={products}
      locale={locale}
      onSave={handleSave}
      previewComponent={previewComponent}
      onCreateClient={() => {
        // Navigate to create client page or open dialog
        router.push(`/${locale}/dashboard/clients?create=true`)
      }}
    />
  )
}
```

### Per Preventivi

Simile a sopra, ma usando:
- `type="quote"`
- `QuoteLivePreview` invece di `InvoiceLivePreview`
- `calculateQuoteTotals` e `generateQuoteNumber`
- Tabella `quotes` e `quote_items`

## Migrazione Graduale

### Opzione 1: Feature Flag
```tsx
const USE_NEW_CREATOR = process.env.NEXT_PUBLIC_USE_NEW_CREATOR === 'true'

return USE_NEW_CREATOR ? (
  <EnhancedDocumentCreator {...props} />
) : (
  <OldInvoiceForm {...props} />
)
```

### Opzione 2: Route Separata
- `/dashboard/invoices/new` - Vecchio form
- `/dashboard/invoices/new-v2` - Nuovo wizard
- Testare e poi sostituire

## Personalizzazioni

### Aggiungere Step Personalizzati
```tsx
const customSteps = [
  ...defaultSteps,
  {
    id: 'custom',
    label: 'Personalizzato',
    component: <CustomStep />,
    isValid: true,
  }
]
```

### Modificare Preview
Il componente preview può essere completamente personalizzato passando `previewComponent`.

## Note

- Il componente gestisce automaticamente la validazione per step
- La preview si aggiorna in tempo reale (se implementata correttamente)
- Mobile-first: funziona perfettamente su tutti i dispositivi
- Accessibile: supporta keyboard navigation e screen readers

