'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { supplierSchema, type SupplierInput } from '@/lib/validations/supplier'
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
import type { Supplier } from '@/lib/types/database'
import { useTranslations } from 'next-intl'

interface SupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: SupplierInput) => Promise<void>
  supplier?: Supplier | null
  loading: boolean
}

export function SupplierDialog({
  open,
  onOpenChange,
  onSubmit,
  supplier,
  loading,
}: SupplierDialogProps) {
  const t = useTranslations('suppliers')
  const tCommon = useTranslations('common')
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
      country: '',
      vat_number: '',
      website: '',
      payment_terms: '',
      notes: '',
      is_active: true,
    }
  })

  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        postal_code: supplier.postal_code || '',
        country: supplier.country || '',
        vat_number: supplier.vat_number || '',
        website: supplier.website || '',
        payment_terms: supplier.payment_terms || '',
        notes: supplier.notes || '',
        is_active: supplier.is_active,
      })
    } else {
      reset({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: '',
        vat_number: '',
        website: '',
        payment_terms: '',
        notes: '',
        is_active: true,
      })
    }
  }, [supplier, reset])

  const handleFormSubmit = async (data: SupplierInput) => {
    await onSubmit(data)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl md:text-2xl">
            {supplier ? t('form.editTitle') : t('form.title')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {supplier
              ? 'Modifica le informazioni del fornitore'
              : 'Inserisci i dati del nuovo fornitore'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Sezione Informazioni Base */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Informazioni Base
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                {t('fields.name')} <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="name" 
                {...register('name')} 
                className="h-10"
                placeholder="es. ABC Forniture Srl"
              />
              {errors.name && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <span>⚠</span> {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person" className="text-sm font-medium">{t('fields.contact')}</Label>
                <Input 
                  id="contact_person" 
                  {...register('contact_person')} 
                  className="h-10"
                  placeholder="es. Mario Rossi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_number" className="text-sm font-medium">{t('fields.vatNumber')}</Label>
                <Input 
                  id="vat_number" 
                  {...register('vat_number')} 
                  className="h-10"
                  placeholder="es. CHE-123.456.789"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">{t('fields.email')}</Label>
                <Input 
                  id="email" 
                  type="email" 
                  {...register('email')} 
                  className="h-10"
                  placeholder="info@esempio.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span>⚠</span> {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">{t('fields.phone')}</Label>
                <Input 
                  id="phone" 
                  {...register('phone')} 
                  className="h-10"
                  placeholder="+41 91 123 45 67"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm font-medium">{t('fields.website')}</Label>
                <Input 
                  id="website" 
                  type="url" 
                  {...register('website')} 
                  className="h-10"
                  placeholder="https://www.esempio.com"
                />
                {errors.website && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span>⚠</span> {errors.website.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms" className="text-sm font-medium">{t('fields.paymentTerms')}</Label>
                <Input 
                  id="payment_terms" 
                  {...register('payment_terms')} 
                  className="h-10"
                  placeholder="es. 30 giorni"
                />
              </div>
            </div>
          </div>

          {/* Separatore */}
          <div className="border-t pt-4"></div>

          {/* Sezione Indirizzo */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Indirizzo
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">{t('fields.address')}</Label>
              <Input 
                id="address" 
                {...register('address')} 
                className="h-10"
                placeholder="Via Roma 123"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code" className="text-sm font-medium">{t('fields.postalCode')}</Label>
                <Input 
                  id="postal_code" 
                  {...register('postal_code')} 
                  className="h-10"
                  placeholder="6900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">{t('fields.city')}</Label>
                <Input 
                  id="city" 
                  {...register('city')} 
                  className="h-10"
                  placeholder="Lugano"
                />
              </div>
              <div className="space-y-2 sm:col-span-2 md:col-span-1">
                <Label htmlFor="country" className="text-sm font-medium">{t('fields.country')}</Label>
                <Input 
                  id="country" 
                  {...register('country')} 
                  className="h-10"
                  placeholder="Svizzera"
                />
              </div>
            </div>
          </div>

          {/* Separatore */}
          <div className="border-t pt-4"></div>

          {/* Sezione Note e Stato */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Informazioni Aggiuntive
            </h3>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">{tCommon('notes')}</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
                className="resize-none"
                placeholder="Note aggiuntive sul fornitore..."
              />
            </div>

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

