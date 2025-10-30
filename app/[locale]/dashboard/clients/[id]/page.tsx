'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, FileText, Receipt, Mail, Phone, MapPin, Building, User, Calendar, Euro } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import Link from 'next/link'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

// Helper function to get badge variant based on status
function getStatusVariant(status: string, type: 'quote' | 'invoice'): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type === 'quote') {
    switch (status) {
      case 'accepted':
        return 'default' // Green
      case 'sent':
        return 'outline' // Blue
      case 'rejected':
        return 'destructive' // Red
      default:
        return 'secondary' // Gray for draft
    }
  } else {
    switch (status) {
      case 'paid':
        return 'default' // Green
      case 'issued':
        return 'outline' // Blue
      case 'overdue':
        return 'destructive' // Red
      default:
        return 'secondary' // Gray for draft
    }
  }
}

interface Client {
  id: string
  name: string
  email: string
  phone: string
  pec: string
  sdi_code: string
  address: string
  city: string
  postal_code: string
  province: string
  country: string
  vat_number: string
  tax_code: string
  notes: string
}

interface Quote {
  id: string
  quote_number: string
  date: string
  total: number
  status: string
}

interface Invoice {
  id: string
  invoice_number: string
  date: string
  total: number
  status: string
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const clientId = params.id as string
  const t = useTranslations('clients')
  const tNav = useTranslations('navigation')
  const tCommon = useTranslations('common')
  const tQuotes = useTranslations('quotes')
  const tInvoices = useTranslations('invoices')

  const [client, setClient] = useState<Client | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClientData()
  }, [clientId])

  async function loadClientData() {
    const supabase = createClient()

    // Load client
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientData) {
      setClient(clientData)
    }

    // Load quotes
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('id, quote_number, date, total, status')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('date', { ascending: false })

    if (quotesData) {
      setQuotes(quotesData)
    }

    // Load invoices
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('id, invoice_number, date, total, status')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('date', { ascending: false })

    if (invoicesData) {
      setInvoices(invoicesData)
    }

    setLoading(false)
  }

  const totalQuotes = quotes.reduce((sum, q) => sum + q.total, 0)
  const totalInvoices = invoices.reduce((sum, i) => sum + i.total, 0)

  if (loading) {
    return <div className="p-6">{tCommon('loading')}</div>
  }

  if (!client) {
    return <div className="p-6">Cliente non trovato</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/clients`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground">{t('detail')}</p>
        </div>
        <Button onClick={() => router.push(`/${locale}/dashboard/clients`)}>
          {tCommon('edit')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('information')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{client.email}</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.phone')}</p>
                  <p className="text-sm text-muted-foreground">{client.phone}</p>
                </div>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.address')}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.address}
                    {client.city && `, ${client.city}`}
                    {client.postal_code && ` ${client.postal_code}`}
                  </p>
                </div>
              </div>
            )}
            {client.vat_number && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.vatNumber')}</p>
                  <p className="text-sm text-muted-foreground">{client.vat_number}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('statistics')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{quotes.length}</p>
                  <p className="text-sm text-muted-foreground">{tNav('quotes')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">€{totalQuotes.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{tCommon('total')}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Receipt className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                  <p className="text-sm text-muted-foreground">{tNav('invoices')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">€{totalInvoices.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{tCommon('total')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quotes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {tNav('quotes')}
            </CardTitle>
            <CardDescription>
              {quotes.length} {tNav('quotes').toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tQuotes('noQuotes')}</p>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/${locale}/dashboard/quotes/${quote.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{quote.quote_number}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(quote.date), 'dd/MM/yyyy', {
                          locale: localeMap[locale] || enUS,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">€{quote.total.toFixed(2)}</p>
                      <Badge variant={getStatusVariant(quote.status, 'quote')}>
                        {tQuotes(`status.${quote.status}`)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {tNav('invoices')}
            </CardTitle>
            <CardDescription>
              {invoices.length} {tNav('invoices').toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tInvoices('noInvoices')}</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/${locale}/dashboard/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(invoice.date), 'dd/MM/yyyy', {
                          locale: localeMap[locale] || enUS,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">€{invoice.total.toFixed(2)}</p>
                      <Badge variant={getStatusVariant(invoice.status, 'invoice')}>
                        {tInvoices(`status.${invoice.status}`)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

