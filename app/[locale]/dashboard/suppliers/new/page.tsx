'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

export default function NewSupplierPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('suppliers')
  const tCommon = useTranslations('common')

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push(`/${locale}/auth/login`)
        return
      }

      const { error } = await supabase
        .from('suppliers')
        .insert({
          user_id: user.id,
          ...formData,
        })

      if (error) throw error

      toast.success(t('createSuccess') || 'Fornitore creato con successo')
      router.push(`/${locale}/dashboard/suppliers`)
    } catch (error) {
      console.error('Error creating supplier:', error)
      toast.error(t('createError') || 'Errore nella creazione del fornitore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/suppliers`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('form.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('form.subtitle')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informazioni Base */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">{t('form.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                {t('fields.name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es. ABC Forniture Srl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person" className="text-sm font-medium">{t('fields.contact')}</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="es. Mario Rossi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_number" className="text-sm font-medium">{t('fields.vatNumber')}</Label>
                <Input
                  id="vat_number"
                  value={formData.vat_number}
                  onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
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
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="info@esempio.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">{t('fields.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.esempio.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms" className="text-sm font-medium">{t('fields.paymentTerms')}</Label>
                <Input
                  id="payment_terms"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="es. 30 giorni"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Indirizzo */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">{t('form.address')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">{t('fields.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Via Roma 123"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code" className="text-sm font-medium">{t('fields.postalCode')}</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="6900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">{t('fields.city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Lugano"
                />
              </div>
              <div className="space-y-2 sm:col-span-2 md:col-span-1">
                <Label htmlFor="country" className="text-sm font-medium">{t('fields.country')}</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Svizzera"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Note e Stato */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">{t('form.additionalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">{tCommon('notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="resize-none"
                placeholder="Note aggiuntive sul fornitore..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                {t('fields.isActive')}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/suppliers`)}
            className="w-full sm:w-auto sm:min-w-[120px]"
          >
            {tCommon('cancel')}
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[180px]"
          >
            {loading ? t('form.saving') : t('form.createButton')}
          </Button>
        </div>
      </form>
    </div>
  )
}

