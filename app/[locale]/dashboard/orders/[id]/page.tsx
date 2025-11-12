'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ShoppingCart, Calendar, Package, Building, FileText, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import type { OrderWithSupplier } from '@/lib/types/database'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
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

interface OrderItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
  product_id: string | null
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const orderId = params.id as string
  const t = useTranslations('orders')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('orders.status')

  const [order, setOrder] = useState<OrderWithSupplier | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const dateLocale = localeMap[locale] || it

  useEffect(() => {
    loadOrderData()
  }, [orderId])

  async function loadOrderData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/${locale}/dashboard/orders`)
      return
    }

    // Load order with supplier
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (orderError || !orderData) {
      console.error('Error loading order:', orderError)
      router.push(`/${locale}/dashboard/orders`)
      return
    }

    setOrder(orderData as OrderWithSupplier)

    // Load order items
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (itemsData) {
      setOrderItems(itemsData)
    }

    setLoading(false)
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

  if (!order) {
    return (
      <div className="p-6">
        <p>{t('notFound') || 'Ordine non trovato'}</p>
        <Button onClick={() => router.push(`/${locale}/dashboard/orders`)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/orders`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{order.order_number}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('detail') || 'Dettaglio ordine'}
          </p>
        </div>
        <Badge variant={getOrderStatusVariant(order.status)} className="text-sm">
          {tStatus(order.status)}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {t('information') || 'Informazioni Ordine'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.supplier && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('supplier')}</p>
                  <p className="text-sm text-muted-foreground">{order.supplier.name}</p>
                  {order.supplier.email && (
                    <p className="text-xs text-muted-foreground mt-1">{order.supplier.email}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('orderDate')}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(order.date), 'dd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
            {order.expected_delivery_date && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('deliveryDate')}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.expected_delivery_date), 'dd MMM yyyy', { locale: dateLocale })}
                  </p>
                </div>
              </div>
            )}
            {order.notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{tCommon('notes')}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('totals') || 'Totali'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t('subtotal') || 'Subtotale'}</p>
              <p className="text-sm font-medium tabular-nums">
                CHF {Number(order.subtotal).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t('tax') || 'IVA'}</p>
              <p className="text-sm font-medium tabular-nums">
                CHF {Number(order.tax_amount).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">{t('totalAmount')}</p>
              <p className="text-lg font-bold tabular-nums">
                CHF {Number(order.total).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('items') || 'Articoli'}
          </CardTitle>
          <CardDescription>
            {orderItems.length} {orderItems.length === 1 ? t('item') || 'articolo' : t('items') || 'articoli'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orderItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noItems') || 'Nessun articolo'}</p>
          ) : (
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <p className="font-medium text-sm">{item.description}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                      <div>
                        <span className="font-medium">{t('quantity') || 'Qtà'}:</span> {item.quantity}
                      </div>
                      <div>
                        <span className="font-medium">{t('unitPrice') || 'Prezzo unit.'}:</span>{' '}
                        CHF {Number(item.unit_price).toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">{t('taxRate') || 'IVA'}:</span> {item.tax_rate}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-sm tabular-nums">
                      CHF {Number(item.line_total).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

