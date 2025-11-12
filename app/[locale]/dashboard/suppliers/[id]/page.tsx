'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building, Mail, Phone, MapPin, Globe, FileText, ShoppingCart, Loader2, Calendar } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import Link from 'next/link'
import type { Supplier } from '@/lib/types/database'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

interface Order {
  id: string
  order_number: string
  date: string
  total: number
  status: string
}

export default function SupplierDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const supplierId = params.id as string
  const t = useTranslations('suppliers')
  const tCommon = useTranslations('common')
  const tOrders = useTranslations('orders')
  const tStatus = useTranslations('orders.status')

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const dateLocale = localeMap[locale] || it

  useEffect(() => {
    loadSupplierData()
  }, [supplierId])

  async function loadSupplierData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/${locale}/dashboard/suppliers`)
      return
    }

    // Load supplier
    const { data: supplierData, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('user_id', user.id)
      .single()

    if (supplierError || !supplierData) {
      console.error('Error loading supplier:', supplierError)
      router.push(`/${locale}/dashboard/suppliers`)
      return
    }

    setSupplier(supplierData)

    // Load orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, order_number, date, total, status')
      .eq('supplier_id', supplierId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(10)

    if (ordersData) {
      setOrders(ordersData)
    }

    setLoading(false)
  }

  function getOrderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'received':
        return 'default'
      case 'ordered':
      case 'partial':
        return 'outline'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{tCommon('loading')}...</p>
        </div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <p>{t('notFound') || 'Fornitore non trovato'}</p>
        <Button onClick={() => router.push(`/${locale}/dashboard/suppliers`)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    )
  }

  const totalOrders = orders.reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/suppliers`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{supplier.name}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('detail') || 'Dettaglio fornitore'}
          </p>
        </div>
        <Badge variant={supplier.is_active ? 'default' : 'secondary'} className="text-sm">
          {supplier.is_active ? t('active') || 'Attivo' : t('inactive') || 'Inattivo'}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Supplier Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {t('information') || 'Informazioni'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {supplier.contact_person && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.contactPerson')}</p>
                  <p className="text-sm text-muted-foreground">{supplier.contact_person}</p>
                </div>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{supplier.email}</p>
                </div>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.phone')}</p>
                  <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                </div>
              </div>
            )}
            {(supplier.address || supplier.city || supplier.postal_code) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.address')}</p>
                  <p className="text-sm text-muted-foreground">
                    {supplier.address}
                    {supplier.city && `, ${supplier.city}`}
                    {supplier.postal_code && ` ${supplier.postal_code}`}
                    {supplier.country && `, ${supplier.country}`}
                  </p>
                </div>
              </div>
            )}
            {supplier.vat_number && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.vatNumber')}</p>
                  <p className="text-sm text-muted-foreground">{supplier.vat_number}</p>
                </div>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.website')}</p>
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {supplier.website}
                  </a>
                </div>
              </div>
            )}
            {supplier.payment_terms && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('fields.paymentTerms')}</p>
                  <p className="text-sm text-muted-foreground">{supplier.payment_terms}</p>
                </div>
              </div>
            )}
            {supplier.notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{tCommon('notes')}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('statistics') || 'Statistiche'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-sm text-muted-foreground">{tOrders('title') || 'Ordini'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums">
                  CHF {totalOrders.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">{tCommon('total')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {tOrders('title') || 'Ordini'}
          </CardTitle>
          <CardDescription>
            {orders.length} {orders.length === 1 ? tOrders('order') || 'ordine' : tOrders('orders') || 'ordini'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tOrders('noOrders') || 'Nessun ordine'}</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/${locale}/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(order.date), 'dd MMM yyyy', { locale: dateLocale })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      CHF {Number(order.total).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <Badge variant={getOrderStatusVariant(order.status)} className="mt-1">
                      {tStatus(order.status)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

