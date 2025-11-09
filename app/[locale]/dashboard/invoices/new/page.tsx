'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import type { Client } from '@/lib/types/database'
import type { InvoiceItemInput } from '@/lib/validations/invoice'
import type { Product } from '@/lib/types/database'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { SetupAlert } from '@/components/setup-alert'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { toast } from 'sonner'

export default function NewInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('invoices.status')
  const tSubscription = useTranslations('subscription')
  const tErrors = useTranslations('errors')
  const tProducts = useTranslations('products')
  const { hasRequiredFields } = useCompanySettings()
  const { subscription, checkLimits } = useSubscription()
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'draft' | 'issued' | 'paid' | 'overdue'>('draft')
  const [notes, setNotes] = useState('')
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
  ])

  useEffect(() => {
    loadClients()
    loadProducts()
    loadCompanyDefaults()
    loadInvoiceCount()
  }, [])

  const loadClients = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name')

    if (data) {
      setClients(data)
    }
  }

  const loadProducts = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')

    if (data) {
      setProducts(data)
    }
  }

  const loadInvoiceCount = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setInvoiceCount(count || 0)
  }

  const loadCompanyDefaults = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: company } = await supabase
      .from('company_settings')
      .select('invoice_default_notes, invoice_default_due_days')
      .eq('user_id', user.id)
      .single()

    if (company) {
      // Set default notes
      if (company.invoice_default_notes) {
        setNotes(company.invoice_default_notes)
      }
      
      // Calculate and set default due date
      if (company.invoice_default_due_days) {
        const dueDays = company.invoice_default_due_days
        const dueDateCalc = new Date()
        dueDateCalc.setDate(dueDateCalc.getDate() + dueDays)
        setDueDate(dueDateCalc.toISOString().split('T')[0])
      }
    }
  }

  const addItem = () => {
    setItems([
      ...items,
      { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
    ])
  }

  const addProductItem = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    setItems([...items, {
      description: product.name + (product.description ? `\n${product.description}` : ''),
      quantity: 1,
      unit_price: Number(product.unit_price),
      tax_rate: Number(product.tax_rate),
    }])
  }

  const fillFromProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const newItems = [...items]
    newItems[index] = {
      description: product.name + (product.description ? `\n${product.description}` : ''),
      quantity: newItems[index].quantity || 1,
      unit_price: Number(product.unit_price),
      tax_rate: Number(product.tax_rate),
    }
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (
    index: number,
    field: keyof InvoiceItemInput,
    value: string | number
  ) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      alert(t('form.errorSelectClient'))
      return
    }

    // Verifica limiti prima di creare la fattura
    const limitsResult = await checkLimits('invoice')
    if (!limitsResult.allowed) {
      // Aggiorna i parametri per il dialog
      setUpgradeDialogParams({
        currentCount: limitsResult.current_count,
        maxCount: limitsResult.max_count || 0,
        planName: limitsResult.plan_name || 'Free'
      })
      setShowUpgradeDialog(true)
      const resourceLabel = tSubscription('resources.invoice')
      toast.error(tSubscription('toast.limitReached'), {
        description: tSubscription('toast.limitReachedDescription', { 
          max: limitsResult.max_count || 0,
          resource: resourceLabel,
          plan: limitsResult.plan_name || 'Free'
        }),
        duration: 5000,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Avviso se si sta avvicinando al limite (80%)
    const currentCount = limitsResult.current_count
    const maxCount = limitsResult.max_count || 0
    if (maxCount > 0 && currentCount >= maxCount * 0.8 && currentCount < maxCount) {
      const resourceLabel = tSubscription('resources.invoice')
      toast.warning(tSubscription('toast.warning'), {
        description: tSubscription('toast.warningDescription', {
          current: currentCount,
          max: maxCount,
          resource: resourceLabel
        }),
        duration: 4000,
      })
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const totals = calculateInvoiceTotals(items)
      const invoiceNumber = generateInvoiceNumber()

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          date,
          due_date: dueDate || null,
          status: status,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total,
          notes: notes || null,
        })
        .select()
        .single()

      if (invoiceError) {
        console.error('Errore creazione fattura:', invoiceError)
        // Se il database trigger blocca l'inserimento
        setUpgradeDialogParams({
          currentCount: limitsResult.current_count,
          maxCount: limitsResult.max_count || 0,
          planName: limitsResult.plan_name || 'Free'
        })
        setShowUpgradeDialog(true)
        toast.error(tSubscription('toast.limitReached'), {
          description: tSubscription('toast.limitReachedDescription', { 
            max: limitsResult.max_count || 0,
            resource: tSubscription('resources.invoice'),
            plan: limitsResult.plan_name || 'Free'
          }),
          duration: 5000,
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      
      if (!invoice) {
        alert(t('form.errorCreating'))
        return
      }

      // Create invoice items
      const itemsToInsert = items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      await supabase.from('invoice_items').insert(itemsToInsert)

      toast.success(tSubscription('toast.invoiceCreated'), {
        description: tSubscription('toast.invoiceCreatedDescription'),
      })
      router.push(`/${locale}/dashboard/invoices`)
    } catch (error) {
      console.error('Errore durante la creazione della fattura:', error)
      toast.error(tCommon('error'), {
        description: tErrors('invoiceSaveError'),
      })
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateInvoiceTotals(items)

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('form.title')}</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          {t('form.subtitle')}
        </p>
      </div>

      {/* Alert for missing company settings */}
      <SetupAlert />

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">{t('form.generalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client" className="text-sm font-medium">
                {t('fields.client')} <span className="text-red-500">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={t('form.selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium">{t('fields.date')}</Label>
                <Input
                  id="date"
                  type="date"
                  className="h-10"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-sm font-medium">{t('fields.dueDate')}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  className="h-10"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">{tCommon('status')}</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={t('form.selectStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{tStatus('draft')}</SelectItem>
                  <SelectItem value="issued">{tStatus('issued')}</SelectItem>
                  <SelectItem value="paid">{tStatus('paid')}</SelectItem>
                  <SelectItem value="overdue">{tStatus('overdue')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">{tCommon('notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Note aggiuntive sulla fattura..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg md:text-xl">{t('fields.items')}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t('fields.addItem')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length > 0 && (
              <div className="space-y-3 p-4 bg-muted/30 border border-dashed rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="add_product" className="text-sm font-semibold">
                      {tProducts('addFromCatalog') || 'Aggiungi dal Catalogo'}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tProducts('addFromCatalogHint') || 'Aggiungi rapidamente prodotti dal tuo catalogo'}
                    </p>
                  </div>
                </div>
                <Select onValueChange={addProductItem}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={tProducts('selectProduct') || 'Seleziona Prodotto'} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{product.name}</span>
                          <span className="text-muted-foreground ml-4">CHF {Number(product.unit_price).toFixed(2)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {items.map((item, index) => (
              <div
                key={index}
                className="p-4 md:p-5 border-2 rounded-lg space-y-4 relative bg-card hover:border-primary/30 transition-colors"
              >
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                
                {/* Header Item */}
                <div className="flex items-center gap-2 pr-10">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Articolo #{index + 1}
                  </h4>
                </div>

                {products.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/20 rounded-md border">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {tProducts('fillFromCatalog') || 'Compila dal Catalogo (opzionale)'}
                    </Label>
                    <Select onValueChange={(productId) => fillFromProduct(index, productId)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={tProducts('selectProductToFill') || 'Seleziona per compilare'} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - CHF {Number(product.unit_price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('fields.description')}</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, 'description', e.target.value)
                    }
                    placeholder={t('form.itemDescription')}
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('fields.quantity')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="h-10"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('fields.unitPrice')} (CHF)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('fields.taxRate')} (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="h-10"
                      value={item.tax_rate}
                      onChange={(e) =>
                        updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm font-medium text-muted-foreground">{t('fields.lineTotal')}:</span>
                  <span className="text-lg font-bold">
                    CHF {(item.quantity * item.unit_price * (1 + item.tax_rate / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">{t('form.totals')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm md:text-base text-muted-foreground">{tCommon('subtotal')}:</span>
              <span className="text-sm md:text-base font-medium">CHF {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm md:text-base text-muted-foreground">{tCommon('tax')}:</span>
              <span className="text-sm md:text-base font-medium">CHF {totals.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-primary/5 -mx-6 px-6 rounded-b-lg">
              <span className="text-base md:text-lg font-bold">{tCommon('total')}:</span>
              <span className="text-xl md:text-2xl font-bold text-primary">CHF {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/invoices`)}
            className="w-full sm:w-auto"
          >
            {tCommon('cancel')}
          </Button>
          <Button 
            type="submit" 
            disabled={loading || !hasRequiredFields}
            title={!hasRequiredFields ? 'Configura prima i dati aziendali nelle impostazioni' : ''}
            className="w-full sm:flex-1"
          >
            {loading ? t('form.saving') : t('form.createButton')}
          </Button>
        </div>
      </form>

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="invoice"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />
    </div>
  )
}

