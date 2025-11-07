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
  const { hasRequiredFields } = useCompanySettings()
  const { subscription, checkLimits } = useSubscription()
  const [clients, setClients] = useState<Client[]>([])
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
      .order('name')

    if (data) {
      setClients(data)
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
        description: 'Si è verificato un errore durante la creazione della fattura.',
      })
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateInvoiceTotals(items)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('form.title')}</h1>
        <p className="text-muted-foreground">
          {t('form.subtitle')}
        </p>
      </div>

      {/* Alert for missing company settings */}
      <SetupAlert />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('form.generalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">{t('fields.client')} *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">{t('fields.date')}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">{t('fields.dueDate')}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{tCommon('status')}</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger>
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
              <Label htmlFor="notes">{tCommon('notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('fields.items')}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              {t('fields.addItem')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg space-y-4 relative"
              >
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
                <div className="space-y-2">
                  <Label>{t('fields.description')}</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, 'description', e.target.value)
                    }
                    placeholder={t('form.itemDescription')}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('fields.quantity')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('fields.unitPrice')} (CHF)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('fields.taxRate')} (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={item.tax_rate}
                      onChange={(e) =>
                        updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {t('fields.lineTotal')}: CHF{' '}
                    {(
                      item.quantity *
                      item.unit_price *
                      (1 + item.tax_rate / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('form.totals')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>{tCommon('subtotal')}:</span>
              <span>CHF {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{tCommon('tax')}:</span>
              <span>CHF {totals.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>{tCommon('total')}:</span>
              <span>CHF {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/invoices`)}
          >
            {tCommon('cancel')}
          </Button>
          <Button 
            type="submit" 
            disabled={loading || !hasRequiredFields}
            title={!hasRequiredFields ? 'Configura prima i dati aziendali nelle impostazioni' : ''}
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

