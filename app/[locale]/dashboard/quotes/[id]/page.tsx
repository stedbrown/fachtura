'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Download, Eye, Trash2, FileText, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { DeleteDialog } from '@/components/delete-dialog'
import { toast } from 'sonner'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

// Helper function to get badge variant based on quote status
function getQuoteStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default'
    case 'sent':
      return 'outline'
    case 'rejected':
      return 'destructive'
    default:
      return 'secondary'
  }
}

interface Quote {
  id: string
  quote_number: string
  date: string
  valid_until: string
  status: string
  subtotal: number
  tax_amount: number
  total: number
  notes: string
  items: any[]
  client: {
    id: string
    name: string
    email: string
    phone: string
    address: string
    city: string
    postal_code: string
    vat_number: string
  }
}

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const quoteId = params.id as string
  const t = useTranslations('quotes')
  const tCommon = useTranslations('common')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadQuote()
  }, [quoteId])

  async function loadQuote() {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', quoteId)
      .single()

    if (data) {
      // Get quote items
      const { data: items } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at')

      setQuote({
        ...data,
        items: items || []
      } as Quote)
    }

    setLoading(false)
  }

  async function handleDownloadPDF() {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pdf?locale=${locale}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quote?.quote_number || 'preventivo'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }


  async function handleDelete() {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('quotes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', quoteId)

    setIsDeleting(false)

    if (!error) {
      router.push(`/${locale}/dashboard/quotes`)
    }
  }

  async function handleStatusChange(newStatus: string) {
    const supabase = createClient()

    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quoteId)

    if (!error) {
      setQuote(prev => prev ? { ...prev, status: newStatus } : null)
      toast.success(t(`status.${newStatus}`), {
        description: 'Stato aggiornato con successo'
      })
    } else {
      toast.error('Errore durante l\'aggiornamento dello stato')
    }
  }

  async function handleConvertToInvoice() {
    if (!quote) return

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    try {
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`

      // Calculate due date (30 days from now)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: quote.client.id,
          invoice_number: invoiceNumber,
          date: new Date().toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          status: 'draft',
          subtotal: quote.subtotal,
          tax_amount: quote.tax_amount,
          total: quote.total,
          notes: quote.notes,
        })
        .select()
        .single()

      if (invoiceError || !invoice) {
        throw new Error('Errore durante la creazione della fattura')
      }

      // Copy quote items to invoice items
      const invoiceItems = quote.items.map(item => ({
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
        throw new Error('Errore durante la copia degli articoli')
      }

      toast.success('Fattura creata con successo!', {
        description: 'Reindirizzamento alla fattura...',
        duration: 2000,
      })

      // Redirect to new invoice
      setTimeout(() => {
        router.push(`/${locale}/dashboard/invoices/${invoice.id}`)
      }, 1000)
    } catch (error) {
      console.error('Error converting to invoice:', error)
      toast.error('Errore durante la conversione in fattura')
    }
  }

  if (loading) {
    return <div className="p-6">{tCommon('loading')}</div>
  }

  if (!quote) {
    return <div className="p-6">Preventivo non trovato</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/dashboard/quotes`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{quote.quote_number}</h1>
            <p className="text-muted-foreground">{quote.client.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Badge variant={getQuoteStatusVariant(quote.status)} className="mr-2">
                  {t(`status.${quote.status}`)}
                </Badge>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('changeStatus')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStatusChange('draft')}>
                {t('status.draft')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('sent')}>
                {t('status.sent')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('accepted')}>
                {t('status.accepted')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('rejected')}>
                {t('status.rejected')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Convert to Invoice Button */}
          {quote.status === 'accepted' && (
            <Button variant="default" onClick={handleConvertToInvoice}>
              <FileText className="h-4 w-4 mr-2" />
              Converti in Fattura
            </Button>
          )}

          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            {tCommon('download')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('fields.client')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="font-semibold">{quote.client.name}</p>
              {quote.client.email && <p className="text-sm text-muted-foreground">{quote.client.email}</p>}
              {quote.client.phone && <p className="text-sm text-muted-foreground">{quote.client.phone}</p>}
              {quote.client.address && (
                <p className="text-sm text-muted-foreground">
                  {quote.client.address}, {quote.client.city} {quote.client.postal_code}
                </p>
              )}
              {quote.client.vat_number && (
                <p className="text-sm text-muted-foreground">P.IVA: {quote.client.vat_number}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quote Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('fields.date')}</span>
              <span className="font-medium">
                {format(new Date(quote.date), 'dd MMMM yyyy', {
                  locale: localeMap[locale] || enUS,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('fields.validUntil')}</span>
              <span className="font-medium">
                {format(new Date(quote.valid_until), 'dd MMMM yyyy', {
                  locale: localeMap[locale] || enUS,
                })}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tCommon('subtotal')}</span>
              <span>CHF {quote.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tCommon('tax')}</span>
              <span>CHF {quote.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>{tCommon('total')}</span>
              <span>CHF {quote.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t('fields.items')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quote.items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-start pb-4 border-b last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} x CHF {item.unit_price.toFixed(2)} ({item.tax_rate}% IVA)
                  </p>
                </div>
                <p className="font-semibold">CHF {item.line_total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{tCommon('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteQuote')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />
    </div>
  )
}

