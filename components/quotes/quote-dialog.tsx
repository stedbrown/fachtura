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
import { Badge } from '@/components/ui/badge'
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

  const calculateLineTotal = (item: QuoteItemInput) => {
    const subtotal = item.quantity * item.unit_price
    const tax = subtotal * (item.tax_rate / 100)
    return subtotal + tax
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

            <div className="space-y-3">
              {items.map((item, index) => (
                <Card key={index} className="relative border-border/60 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-semibold">
                          #{index + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {t('form.item')}
                        </span>
                        {calculateLineTotal(item) > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs font-medium">
                            CHF {calculateLineTotal(item).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 sm:px-6 pb-4">
                    {/* Fill from Catalog */}
                    {products.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                          <Package className="h-3.5 w-3.5" />
                          {t('form.fillFromCatalog')}
                        </Label>
                        <Select onValueChange={(v) => fillFromProduct(index, v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder={t('form.selectProduct')} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                <div className="flex items-center justify-between w-full gap-3">
                                  <span>{product.name}</span>
                                  <span className="text-muted-foreground">CHF {product.unit_price.toFixed(2)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t('form.description')}</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="resize-none text-sm min-h-[60px]"
                        rows={2}
                        placeholder="Descrizione del servizio o prodotto..."
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t('form.quantity')}</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          className="h-9 text-sm"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t('form.unitPrice')} (CHF)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-9 text-sm"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t('form.taxRate')} (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="h-9 text-sm"
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
          <div className="border-t"></div>

          {/* Totals Section */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5 pb-5">
              <div className="space-y-3">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">{t('form.subtotal')}</span>
                  <span className="font-semibold text-base">CHF {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">{t('form.tax')}</span>
                  <span className="font-semibold text-base">CHF {totals.totalTax.toFixed(2)}</span>
                </div>
                <div className="border-t border-primary/20 pt-3 flex justify-between items-center">
                  <span className="text-base font-bold">{t('form.total')}</span>
                  <span className="text-2xl font-bold text-primary">CHF {totals.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {tCommon('notes')}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
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

