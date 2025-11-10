'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from '@/lib/validations/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image'
import { Upload, X, Building2, FileText, Receipt, Palette, CreditCard } from 'lucide-react'
import { ThemeCustomizer } from '@/components/theme-customizer'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tSuccess = useTranslations('success')
  const tErrors = useTranslations('errors')
  
  const [loading, setLoading] = useState(false)
  const [settingsId, setSettingsId] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      quote_default_validity_days: 30,
      invoice_default_due_days: 30,
    },
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settings) {
      setSettingsId(settings.id)
      setLogoUrl(settings.logo_url || '')
      setLogoPreview(settings.logo_url || '')
      
      // Reset form with all fields including customization
      reset({
        company_name: settings.company_name,
        address: settings.address || '',
        city: settings.city || '',
        postal_code: settings.postal_code || '',
        country: settings.country || 'Switzerland',
        vat_number: settings.vat_number || '',
        iban: settings.iban || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
        quote_default_notes: settings.quote_default_notes || '',
        quote_terms_conditions: settings.quote_terms_conditions || '',
        quote_default_validity_days: settings.quote_default_validity_days || 30,
        quote_footer_text: settings.quote_footer_text || '',
        invoice_default_notes: settings.invoice_default_notes || '',
        invoice_payment_terms: settings.invoice_payment_terms || '',
        invoice_default_due_days: settings.invoice_default_due_days || 30,
        invoice_footer_text: settings.invoice_footer_text || '',
        payment_methods: settings.payment_methods || '',
        late_payment_fee: settings.late_payment_fee || '',
      })
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File troppo grande. Max 2MB')
        return
      }
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview('')
    setLogoUrl('')
  }

  const onSubmit = async (data: CompanySettingsInput) => {
    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Utente non autenticato')
        setLoading(false)
        return
      }

      let newLogoUrl = logoUrl

      // Upload logo if changed
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `logos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, logoFile)

        if (uploadError) {
          toast.error(uploadError.message)
          setLoading(false)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('company-logos').getPublicUrl(filePath)

        newLogoUrl = publicUrl

        // Delete old logo if exists
        if (logoUrl) {
          const oldPath = logoUrl.split('/').pop()
          if (oldPath) {
            await supabase.storage
              .from('company-logos')
              .remove([`logos/${oldPath}`])
          }
        }
      }

      const updateData = {
        ...data,
        logo_url: newLogoUrl || null,
      }

      if (settingsId) {
        const { error: updateError } = await supabase
          .from('company_settings')
          .update(updateData)
          .eq('id', settingsId)

        if (updateError) {
          toast.error(updateError.message)
          setLoading(false)
          return
        }
      } else {
        const { data: newSettings, error: insertError } = await supabase
          .from('company_settings')
          .insert({
            user_id: user.id,
            ...updateData,
          })
          .select()
          .single()

        if (insertError) {
          toast.error(insertError.message)
          setLoading(false)
          return
        }

        if (newSettings) {
          setSettingsId(newSettings.id)
        }
      }

      if (newLogoUrl) {
        setLogoUrl(newLogoUrl)
      }

      // Show success toast
      toast.success(tSuccess('saved'), {
        description: tSuccess('settingsSavedDescription'),
        duration: 3000,
      })
    } catch (err) {
      toast.error(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <TabsTrigger value="company" className="flex items-center gap-2 justify-center sm:justify-start text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Azienda</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2 justify-center sm:justify-start text-xs sm:text-sm">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Aspetto</span>
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2 justify-center sm:justify-start text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Preventivi</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2 justify-center sm:justify-start text-xs sm:text-sm">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Fatture</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2 justify-center sm:justify-start text-xs sm:text-sm">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamenti</span>
            </TabsTrigger>
          </TabsList>

          {/* Company Info Tab */}
          <TabsContent value="company">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <CardTitle>{t('companyInfo')}</CardTitle>
                <CardDescription>
                  {t('companyInfoDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('fields.companyName')} *</Label>
                  <Input
                    id="company_name"
                    {...register('company_name')}
                  />
                  {errors.company_name && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.company_name.message}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>{t('fields.logo')}</Label>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {logoPreview ? (
                      <div className="relative w-32 h-32 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <Image
                          src={logoPreview}
                          alt="Logo preview"
                          fill
                          className="object-contain p-2"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                          {t('uploadLogo')}<br />(PNG, JPG, SVG)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {t('logoDescription')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">{t('fields.address')}</Label>
                    <Input id="address" {...register('address')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">{t('fields.city')}</Label>
                    <Input id="city" {...register('city')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">{t('fields.postalCode')}</Label>
                    <Input id="postal_code" {...register('postal_code')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">{t('fields.country')}</Label>
                    <Input id="country" {...register('country')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">{t('fields.vatNumber')}</Label>
                    <Input id="vat_number" {...register('vat_number')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iban">{t('fields.iban')}</Label>
                    <Input id="iban" {...register('iban')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('fields.phone')}</Label>
                    <Input id="phone" {...register('phone')} />
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">{t('fields.website')}</Label>
                  <Input id="website" {...register('website')} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <CardTitle>Personalizzazione Aspetto</CardTitle>
                <CardDescription>
                  Scegli il tema e lo stile dell'applicazione
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeCustomizer />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quotes Customization Tab */}
          <TabsContent value="quotes">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <CardTitle>{t('quoteCustomization')}</CardTitle>
                <CardDescription>
                  {t('quoteCustomizationDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quote_default_notes">{t('fields.quoteDefaultNotes')}</Label>
                  <Textarea
                    id="quote_default_notes"
                    {...register('quote_default_notes')}
                    placeholder={t('fields.quoteDefaultNotesPlaceholder')}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Queste note appariranno automaticamente su ogni nuovo preventivo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote_terms_conditions">{t('fields.quoteTermsConditions')}</Label>
                  <Textarea
                    id="quote_terms_conditions"
                    {...register('quote_terms_conditions')}
                    placeholder={t('fields.quoteTermsConditionsPlaceholder')}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Termini e condizioni stampati sul PDF del preventivo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote_default_validity_days">{t('fields.quoteDefaultValidityDays')}</Label>
                  <Input
                    id="quote_default_validity_days"
                    type="number"
                    min="1"
                    max="365"
                    {...register('quote_default_validity_days', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Giorni di validità predefiniti per i nuovi preventivi
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote_footer_text">{t('fields.quoteFooterText')}</Label>
                  <Textarea
                    id="quote_footer_text"
                    {...register('quote_footer_text')}
                    placeholder={t('fields.quoteFooterTextPlaceholder')}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Testo visualizzato nel footer del PDF preventivo
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Customization Tab */}
          <TabsContent value="invoices">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <CardTitle>{t('invoiceCustomization')}</CardTitle>
                <CardDescription>
                  {t('invoiceCustomizationDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_default_notes">{t('fields.invoiceDefaultNotes')}</Label>
                  <Textarea
                    id="invoice_default_notes"
                    {...register('invoice_default_notes')}
                    placeholder={t('fields.invoiceDefaultNotesPlaceholder')}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Queste note appariranno automaticamente su ogni nuova fattura
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_payment_terms">{t('fields.invoicePaymentTerms')}</Label>
                  <Textarea
                    id="invoice_payment_terms"
                    {...register('invoice_payment_terms')}
                    placeholder={t('fields.invoicePaymentTermsPlaceholder')}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Condizioni di pagamento stampate sul PDF della fattura
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_default_due_days">{t('fields.invoiceDefaultDueDays')}</Label>
                  <Input
                    id="invoice_default_due_days"
                    type="number"
                    min="1"
                    max="365"
                    {...register('invoice_default_due_days', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Giorni di scadenza predefiniti per le nuove fatture
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_footer_text">{t('fields.invoiceFooterText')}</Label>
                  <Textarea
                    id="invoice_footer_text"
                    {...register('invoice_footer_text')}
                    placeholder={t('fields.invoiceFooterTextPlaceholder')}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Testo visualizzato nel footer del PDF fattura
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Info Tab */}
          <TabsContent value="payment">
            <Card className="max-w-2xl w-full">
              <CardHeader>
                <CardTitle>{t('paymentInfo')}</CardTitle>
                <CardDescription>
                  {t('paymentInfoDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_methods">{t('fields.paymentMethods')}</Label>
                  <Textarea
                    id="payment_methods"
                    {...register('payment_methods')}
                    placeholder={t('fields.paymentMethodsPlaceholder')}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Metodi di pagamento accettati, visualizzati nelle fatture
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="late_payment_fee">{t('fields.latePaymentFee')}</Label>
                  <Textarea
                    id="late_payment_fee"
                    {...register('late_payment_fee')}
                    placeholder={t('fields.latePaymentFeePlaceholder')}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Penali per ritardo pagamento (opzionale)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end max-w-2xl mt-6">
          <Button type="submit" disabled={loading}>
            {loading ? tCommon('loading') : tCommon('save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
