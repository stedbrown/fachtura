'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { productFormSchema, type ProductFormInput } from '@/lib/validations/product'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Product } from '@/lib/types/database'
import { useTranslations } from 'next-intl'

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ProductFormInput) => Promise<void>
  product?: Product | null
  loading: boolean
}

export function ProductDialog({
  open,
  onOpenChange,
  onSubmit,
  product,
  loading,
}: ProductDialogProps) {
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      unit_price: 0,
      tax_rate: 8.1,
      track_inventory: false,
      stock_quantity: 0,
      low_stock_threshold: 10,
      is_active: true,
    }
  })

  const trackInventory = watch('track_inventory')

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description || '',
        category: product.category || '',
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
        track_inventory: product.track_inventory || false,
        stock_quantity: product.stock_quantity || 0,
        low_stock_threshold: product.low_stock_threshold || 10,
        is_active: product.is_active,
      })
    } else {
      reset({
        name: '',
        description: '',
        category: '',
        unit_price: 0,
        tax_rate: 8.1,
        track_inventory: false,
        stock_quantity: 0,
        low_stock_threshold: 10,
        is_active: true,
      })
    }
  }, [product, reset])

  const handleFormSubmit = async (data: ProductFormInput) => {
    await onSubmit(data)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl">
            {product ? t('edit') : t('create')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {product
              ? 'Modifica le informazioni del prodotto'
              : 'Inserisci i dati del nuovo prodotto'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Sezione Informazioni Base */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Informazioni Base
            </h3>
            
            {!product && (
              <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md border">
                ℹ️ {t('skuAutoInfo') || 'Lo SKU verrà generato automaticamente al salvataggio'}
              </p>
            )}

            {product && (
              <div className="space-y-2">
                <Label htmlFor="sku" className="text-sm font-medium">SKU/Codice</Label>
                <Input
                  id="sku"
                  value={product.sku || ''}
                  readOnly
                  disabled
                  className="h-10 bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  ℹ️ {t('skuReadonly') || 'Lo SKU è stato generato automaticamente e non può essere modificato'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                {t('fields.name')} <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="name" 
                {...register('name')} 
                className="h-10"
                placeholder="es. Consulenza IT"
              />
              {errors.name && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <span>⚠</span> {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">{t('fields.description')}</Label>
              <Textarea
                id="description"
                {...register('description')}
                rows={3}
                className="resize-none"
                placeholder="Descrizione dettagliata del prodotto/servizio..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">{t('fields.category')}</Label>
                <Input 
                  id="category" 
                  {...register('category')} 
                  className="h-10"
                  placeholder="es. Servizi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price" className="text-sm font-medium">
                  {t('fields.unitPrice')} (CHF) <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="unit_price" 
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('unit_price', { valueAsNumber: true })} 
                  className="h-10"
                  placeholder="0.00"
                />
                {errors.unit_price && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span>⚠</span> {errors.unit_price.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_rate" className="text-sm font-medium">{t('fields.taxRate')} (%)</Label>
              <Input 
                id="tax_rate" 
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register('tax_rate', { valueAsNumber: true })} 
                className="h-10"
                placeholder="8.1"
              />
            </div>
          </div>

          {/* Separatore */}
          <div className="border-t pt-4"></div>

          {/* Sezione Inventario */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Inventario
            </h3>

            <div className="flex items-center space-x-2">
              <Switch
                id="track_inventory"
                checked={trackInventory}
                onCheckedChange={(checked) => setValue('track_inventory', checked)}
              />
              <Label htmlFor="track_inventory" className="text-sm font-medium cursor-pointer">
                {t('fields.trackInventory')}
              </Label>
            </div>

            {trackInventory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity" className="text-sm font-medium">{t('fields.stockQuantity')}</Label>
                  <Input 
                    id="stock_quantity" 
                    type="number"
                    min="0"
                    {...register('stock_quantity', { valueAsNumber: true })} 
                    className="h-10"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold" className="text-sm font-medium">{t('fields.lowStockThreshold')}</Label>
                  <Input 
                    id="low_stock_threshold" 
                    type="number"
                    min="0"
                    {...register('low_stock_threshold', { valueAsNumber: true })} 
                    className="h-10"
                    placeholder="10"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
              <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                {t('fields.isActive')}
              </Label>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {tCommon('cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? tCommon('loading') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

