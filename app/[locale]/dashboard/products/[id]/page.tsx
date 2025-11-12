'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Package, DollarSign, Percent, Box, AlertTriangle, Loader2, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import type { Product } from '@/lib/types/database'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const productId = params.id as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const dateLocale = localeMap[locale] || it

  useEffect(() => {
    loadProductData()
  }, [productId])

  async function loadProductData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/${locale}/dashboard/products`)
      return
    }

    // Load product
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single()

    if (productError || !productData) {
      console.error('Error loading product:', productError)
      router.push(`/${locale}/dashboard/products`)
      return
    }

    setProduct(productData)
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

  if (!product) {
    return (
      <div className="p-6">
        <p>{t('notFound') || 'Prodotto non trovato'}</p>
        <Button onClick={() => router.push(`/${locale}/dashboard/products`)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    )
  }

  const isLowStock = product.track_inventory && product.stock_quantity <= product.low_stock_threshold

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/products`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('detail') || 'Dettaglio prodotto'}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-sm">
            {product.is_active ? t('active') || 'Attivo' : t('inactive') || 'Inattivo'}
          </Badge>
          {isLowStock && (
            <Badge variant="destructive" className="text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {t('lowStock') || 'Scorta bassa'}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('information') || 'Informazioni'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.description && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('fields.description')}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                </div>
              </div>
            )}
            {product.sku && (
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.sku')}</p>
                  <p className="text-sm text-muted-foreground">{product.sku}</p>
                </div>
              </div>
            )}
            {product.category && (
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.category')}</p>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('fields.unitPrice')}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  CHF {Number(product.unit_price).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Percent className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('fields.taxRate')}</p>
                <p className="text-sm text-muted-foreground">{product.tax_rate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              {t('inventory') || 'Inventario'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('fields.trackInventory') || 'Traccia inventario'}</p>
                <p className="text-lg font-semibold mt-1">
                  {product.track_inventory ? tCommon('yes') || 'Sì' : tCommon('no') || 'No'}
                </p>
              </div>
            </div>
            {product.track_inventory && (
              <>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('fields.stockQuantity') || 'Quantità in magazzino'}</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums">{product.stock_quantity}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('fields.lowStockThreshold') || 'Soglia scorta bassa'}</p>
                    <p className="text-lg font-semibold mt-1 tabular-nums">{product.low_stock_threshold}</p>
                  </div>
                </div>
                {isLowStock && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-destructive font-medium">
                        {t('lowStockWarning') || 'Attenzione: la scorta è bassa!'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

