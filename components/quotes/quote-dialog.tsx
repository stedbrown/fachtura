'use client'

import { useEffect, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Package } from 'lucide-react'
import type { QuoteWithClient, Client, Product } from '@/lib/types/database'
import type { QuoteItemInput } from '@/lib/validations/quote'
import { calculateQuoteTotals, generateQuoteNumber } from '@/lib/utils/quote-utils'
import { SetupAlert } from '@/components/setup-alert'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { toast } from 'sonner'

interface QuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  quote?: QuoteWithClient | null
}

export function QuoteDialog({
  open,
  onOpenChange,
  onSuccess,
  quote,
}: QuoteDialogProps) {
  const t = useTranslations('quotes')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('quotes.status')
  const tProducts = useTranslations('products')
  const { hasRequiredFields } = useCompanySettings()
  
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'draft' | 'sent' | 'accepted' | 'rejected'>('draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<QuoteItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
  ])

  useEffect(() => {
    if (open) {
      loadClients()
      loadProducts()
      if (quote) {
        // TODO: Load quote data
      } else {
        resetForm()
      }
    }
  }, [open, quote])

  const resetForm = () => {
    setClientId('')
    setDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setStatus('draft')
    setNotes('')
    setItems([{ description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 }])
  }

  const loadClients = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name')

    if (data) setClients(data)
  }

  const loadProducts = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')

    if (data) setProducts(data)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof QuoteItemInput, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const fillFromProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      updateItem(index, 'description', product.name)
      updateItem(index, 'unit_price', product.unit_price)
      updateItem(index, 'tax_rate', product.tax_rate)
      updateItem(index, 'product_id', product.id)
    }
  }

  const handleSubmit = async () => {
    if (!clientId) {
      toast.error(t('form.errorSelectClient'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error(tCommon('error'))
      setLoading(false)
      return
    }

    try {
      const quoteNumber = generateQuoteNumber()
      const totals = calculateQuoteTotals(items)

      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          client_id: clientId,
          quote_number: quoteNumber,
          date,
          valid_until: dueDate || null,
          status,
          notes: notes || null,
          subtotal: totals.subtotal,
          total_tax: totals.totalTax,
          total: totals.total,
        })
        .select()
        .single()

      if (quoteError || !quoteData) throw quoteError

      const itemsToInsert = items.map((item) => ({
        quote_id: quoteData.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      await supabase.from('quote_items').insert(itemsToInsert)

      toast.success(t('createSuccess') || 'Preventivo creato con successo')
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error('Error creating quote:', error)
      toast.error(t('createError'))
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateQuoteTotals(items)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl">
            {quote ? t('editQuote') : t('form.title')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t('form.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <SetupAlert />

        <div className="space-y-6">
          {/* General Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('form.generalInfo')}
            </h3>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label htmlFor="valid_until" className="text-sm font-medium">{t('fields.validUntil')}</Label>
                <Input
                  id="valid_until"
                  type="date"
                  className="h-10"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">{tCommon('status')}</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['draft', 'sent', 'accepted', 'rejected'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {tStatus(s as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t pt-4"></div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('form.items')}
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                {t('form.addItem')}
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <Card key={index} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {t('form.item')} #{index + 1}
                      </CardTitle>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Fill from Catalog */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {t('form.fillFromCatalog')}
                      </Label>
                      <Select onValueChange={(v) => fillFromProduct(index, v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={t('form.selectProduct')} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - CHF {product.unit_price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t('form.description')}</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('form.quantity')}</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          className="h-10"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('form.unitPrice')} (CHF)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-10"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('form.taxRate')} (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="h-10"
                          value={item.tax_rate}
                          onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="border-t pt-4"></div>

          {/* Totals Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {tCommon('totals')}
            </h3>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('form.subtotal')}</span>
                    <span className="font-medium">CHF {totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t('form.tax')}</span>
                    <span className="font-medium">CHF {totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-base font-semibold">
                    <span>{t('form.total')}</span>
                    <span>CHF {totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Separator */}
          <div className="border-t pt-4"></div>

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {tCommon('notes')}
            </h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder={t('form.notesPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row pt-4 border-t sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[120px]"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[180px]"
          >
            {loading ? tCommon('loading') : t('form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

