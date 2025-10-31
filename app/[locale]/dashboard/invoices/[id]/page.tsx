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
import { ArrowLeft, Download, Trash2, ChevronDown } from 'lucide-react'
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

// Helper function to get badge variant based on invoice status
function getInvoiceStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid':
      return 'default'
    case 'issued':
      return 'outline'
    case 'overdue':
      return 'destructive'
    default:
      return 'secondary'
  }
}

interface Invoice {
  id: string
  invoice_number: string
  date: string
  due_date: string
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

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const invoiceId = params.id as string
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadInvoice()
  }, [invoiceId])

  async function loadInvoice() {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', invoiceId)
      .single()

    if (data) {
      // Get invoice items
      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at')

      setInvoice({
        ...data,
        items: items || []
      } as Invoice)
    }

    setLoading(false)
  }

  async function handleDownloadPDF() {
    try {
      console.log('📄 Starting PDF download for invoice:', invoiceId)
      const url = `/api/invoices/${invoiceId}/pdf?locale=${locale}`
      console.log('📄 Fetching from:', url)
      
      const response = await fetch(url)
      console.log('📄 Response status:', response.status, response.statusText)
      console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ PDF generation failed:', errorText)
        alert(`Errore ${response.status}: ${errorText}`)
        return
      }
      
      const blob = await response.blob()
      console.log('📄 Blob received, size:', blob.size, 'type:', blob.type)
      
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${invoice?.invoice_number || 'fattura'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
      
      console.log('✅ PDF downloaded successfully')
    } catch (error) {
      console.error('❌ Error downloading PDF:', error)
      alert('Errore durante il download del PDF')
    }
  }


  async function handleDelete() {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('invoices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', invoiceId)

    setIsDeleting(false)

    if (!error) {
      router.push(`/${locale}/dashboard/invoices`)
    }
  }

  async function handleStatusChange(newStatus: string) {
    const supabase = createClient()

    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoiceId)

    if (!error) {
      setInvoice(prev => prev ? { ...prev, status: newStatus } : null)
      toast.success(t(`status.${newStatus}`), {
        description: 'Stato aggiornato con successo'
      })
    } else {
      toast.error('Errore durante l\'aggiornamento dello stato')
    }
  }

  if (loading) {
    return <div className="p-6">{tCommon('loading')}</div>
  }

  if (!invoice) {
    return <div className="p-6">Fattura non trovata</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/dashboard/invoices`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground">{invoice.client.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Badge variant={getInvoiceStatusVariant(invoice.status)} className="mr-2">
                  {t(`status.${invoice.status}`)}
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
              <DropdownMenuItem onClick={() => handleStatusChange('issued')}>
                {t('status.issued')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('paid')}>
                {t('status.paid')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('overdue')}>
                {t('status.overdue')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <p className="font-semibold">{invoice.client.name}</p>
              {invoice.client.email && <p className="text-sm text-muted-foreground">{invoice.client.email}</p>}
              {invoice.client.phone && <p className="text-sm text-muted-foreground">{invoice.client.phone}</p>}
              {invoice.client.address && (
                <p className="text-sm text-muted-foreground">
                  {invoice.client.address}, {invoice.client.city} {invoice.client.postal_code}
                </p>
              )}
              {invoice.client.vat_number && (
                <p className="text-sm text-muted-foreground">P.IVA: {invoice.client.vat_number}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('fields.date')}</span>
              <span className="font-medium">
                {format(new Date(invoice.date), 'dd MMMM yyyy', {
                  locale: localeMap[locale] || enUS,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('fields.dueDate')}</span>
              <span className="font-medium">
                {format(new Date(invoice.due_date), 'dd MMMM yyyy', {
                  locale: localeMap[locale] || enUS,
                })}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tCommon('subtotal')}</span>
              <span>CHF {invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tCommon('tax')}</span>
              <span>CHF {invoice.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>{tCommon('total')}</span>
              <span>CHF {invoice.total.toFixed(2)}</span>
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
            {invoice.items?.map((item: any, index: number) => (
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
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{tCommon('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteInvoice')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />
    </div>
  )
}

