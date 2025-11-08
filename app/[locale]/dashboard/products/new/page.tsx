'use client'

import { useState } from 'react'
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
import type { ProductInput } from '@/lib/validations/product'

export default function NewProductPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return
      }

      // Insert product
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          ...formData,
        })
        .select()
        .single()

      if (error) throw error

      toast.success(t('createSuccess') || 'Prodotto creato con successo')
      router.push(`/${locale}/dashboard/products`)
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error(t('createError') || 'Errore nella creazione del prodotto')
    } finally {
      setLoading(false)
    }
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
          {t('newProduct') || 'Nuovo Prodotto'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('newProductDescription') || 'Aggiungi un nuovo prodotto o servizio al tuo catalogo'}
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
                <Label htmlFor="sku">{t('sku') || 'SKU/Codice'} <span className="text-xs text-muted-foreground">({t('optional') || 'opzionale'})</span></Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder={t('skuPlaceholder') || 'Lascia vuoto per generazione automatica (es. PRD-202501-001)'}
                />
                <p className="text-xs text-muted-foreground">
                  {t('skuAutoGenerate') || 'Se lasciato vuoto, verrà generato automaticamente'}
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
            disabled={loading}
          >
            {tCommon('cancel') || 'Annulla'}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (tCommon('saving') || 'Salvataggio...') : (t('create') || 'Crea Prodotto')}
          </Button>
        </div>
      </form>
    </div>
  )
}

