'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { clientSchema, type ClientInput } from '@/lib/validations/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Client } from '@/lib/types/database'
import { useTranslations } from 'next-intl'

interface ClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ClientInput) => Promise<void>
  client?: Client | null
  loading: boolean
}

export function ClientDialog({
  open,
  onOpenChange,
  onSubmit,
  client,
  loading,
}: ClientDialogProps) {
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
  })

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        postal_code: client.postal_code || '',
        country: client.country || '',
      })
    } else {
      reset({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: '',
      })
    }
  }, [client, reset])

  const handleFormSubmit = async (data: ClientInput) => {
    await onSubmit(data)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl md:text-2xl">
            {client ? t('editClient') : t('createClient')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {client
              ? 'Modifica le informazioni del cliente'
              : 'Inserisci i dati del nuovo cliente'}
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
                placeholder="es. Mario Rossi"
              />
              {errors.name && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <span>⚠</span> {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">{t('fields.email')}</Label>
                <Input 
                  id="email" 
                  type="email" 
                  {...register('email')} 
                  className="h-10"
                  placeholder="mario.rossi@email.com"
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
                  placeholder="+41 79 123 45 67"
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
