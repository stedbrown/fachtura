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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? t('editClient') : t('createClient')}
          </DialogTitle>
          <DialogDescription>
            {client
              ? 'Modifica le informazioni del cliente'
              : 'Inserisci i dati del nuovo cliente'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fields.name')} *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('fields.email')}</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('fields.phone')}</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('fields.address')}</Label>
              <Input id="address" {...register('address')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">{t('fields.postalCode')}</Label>
                <Input id="postal_code" {...register('postal_code')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t('fields.city')}</Label>
                <Input id="city" {...register('city')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t('fields.country')}</Label>
              <Input id="country" {...register('country')} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon('loading') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
