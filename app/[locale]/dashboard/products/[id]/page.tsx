'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { Product } from '@/lib/types/database'
import type { ProductInput } from '@/lib/validations/product'

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const productId = params.id as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)

  const [formData, setFormData] = useState<ProductInput>({
    name: '',
    description: '',
    sku: '',
    category: '',
    unit_price: 0,
    tax_rate: 8.1,
    track_inventory: false,
    stock_quantity: 0,
    low_stock_threshold: 10,
    is_active: true,
  })

  useEffect(() => {
    loadProduct()
  }, [productId])

  async function loadProduct() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/${locale}/auth/login`)
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      console.error('Error loading product:', error)
      toast.error(t('loadError') || 'Errore nel caricamento del prodotto')
      router.push(`/${locale}/dashboard/products`)
      return
    }

    setProduct(data)
    setFormData({
      name: data.name,
      description: data.description || '',
      sku: data.sku || '',
      category: data.category || '',
      unit_price: Number(data.unit_price),
      tax_rate: Number(data.tax_rate),
      track_inventory: data.track_inventory,
      stock_quantity: data.stock_quantity,
      low_stock_threshold: data.low_stock_threshold,
      is_active: data.is_active,
    })
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = createClient()

      // Update product
      const { error } = await supabase
        .from('products')
        .update(formData)
        .eq('id', productId)

      if (error) throw error

      toast.success(t('updateSuccess') || 'Prodotto aggiornato con successo')
      router.push(`/${locale}/dashboard/products`)
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error(t('updateError') || 'Errore nell\'aggiornamento del prodotto')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon('back') || 'Indietro'}
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('editProduct') || 'Modifica Prodotto'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {product?.name}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('basicInfo') || 'Informazioni Base'}</CardTitle>
            <CardDescription>
              {t('basicInfoDescription') || 'Informazioni principali del prodotto'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('name') || 'Nome'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('namePlaceholder') || 'es. Consulenza IT'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">{t('sku') || 'SKU/Codice'}</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  ℹ️ {t('skuReadonly') || 'Lo SKU è stato generato automaticamente e non può essere modificato'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('description') || 'Descrizione'}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('descriptionPlaceholder') || 'Descrizione dettagliata del prodotto o servizio'}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('category') || 'Categoria'}</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder={t('categoryPlaceholder') || 'es. Servizi, Hardware, Software'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pricing') || 'Prezzi e Tasse'}</CardTitle>
            <CardDescription>
              {t('pricingDescription') || 'Imposta il prezzo e l\'aliquota IVA'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unit_price">
                  {t('price') || 'Prezzo Unitario (CHF)'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_rate">{t('taxRate') || 'Aliquota IVA (%)'}</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 8.1 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>{t('inventory') || 'Gestione Inventario'}</CardTitle>
            <CardDescription>
              {t('inventoryDescription') || 'Traccia la quantità disponibile (opzionale)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('trackInventory') || 'Traccia Inventario'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('trackInventoryDescription') || 'Attiva per monitorare le scorte disponibili'}
                </p>
              </div>
              <Switch
                checked={formData.track_inventory}
                onCheckedChange={(checked) => setFormData({ ...formData, track_inventory: checked })}
              />
            </div>

            {formData.track_inventory && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity">{t('stockQuantity') || 'Quantità in Magazzino'}</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">{t('lowStockThreshold') || 'Soglia Scorta Minima'}</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('lowStockThresholdDescription') || 'Riceverai un avviso quando la quantità scende sotto questa soglia'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>{t('status') || 'Stato'}</CardTitle>
            <CardDescription>
              {t('statusDescription') || 'Gestisci la visibilità del prodotto'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('active') || 'Prodotto Attivo'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('activeDescription') || 'I prodotti attivi sono disponibili per la selezione in fatture e preventivi'}
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            {tCommon('cancel') || 'Annulla'}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (tCommon('saving') || 'Salvataggio...') : (tCommon('save') || 'Salva Modifiche')}
          </Button>
        </div>
      </form>
    </div>
  )
}

