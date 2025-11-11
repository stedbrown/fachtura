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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Package, Edit3 } from 'lucide-react'
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
        loadQuoteData()
      } else {
        resetForm()
      }
    }
  }, [open, quote])

  const loadQuoteData = async () => {
    if (!quote) return

    // Load quote data into form
    setClientId(quote.client_id)
    setDate(quote.date)
    setDueDate(quote.valid_until || '')
    setStatus(quote.status as 'draft' | 'sent' | 'accepted' | 'rejected')
    setNotes(quote.notes || '')

    // Load quote items
    const supabase = createClient()
    const { data: itemsData } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('created_at')

    if (itemsData && itemsData.length > 0) {
      setItems(itemsData.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        product_id: item.product_id || undefined
      })))
    }
  }

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
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1, product_id: undefined }])
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
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        description: product.name,
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
        product_id: product.id
      }
      setItems(newItems)
      console.log('Filled from product:', product.name, newItems[index])
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

    // Validate items
    if (items.length === 0) {
      toast.error('Aggiungi almeno un articolo al preventivo')
      return
    }

    const emptyDescriptions = items.filter(item => !item.description?.trim())
    if (emptyDescriptions.length > 0) {
      toast.error('Compila la descrizione per tutti gli articoli')
      return
    }

    const invalidQuantity = items.filter(item => item.quantity <= 0)
    if (invalidQuantity.length > 0) {
      toast.error('La quantità deve essere maggiore di 0 per tutti gli articoli')
      return
    }

    const invalidPrice = items.filter(item => item.unit_price <= 0)
    if (invalidPrice.length > 0) {
      toast.error('Il prezzo unitario deve essere maggiore di 0 per tutti gli articoli')
      return
    }

    const invalidTax = items.filter(item => item.tax_rate < 0)
    if (invalidTax.length > 0) {
      toast.error('L\'IVA non può essere negativa')
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
      const totals = calculateQuoteTotals(items)

      if (quote) {
        // UPDATE existing quote
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            client_id: clientId,
            date,
            valid_until: dueDate || null,
            status,
            notes: notes || null,
            subtotal: totals.subtotal,
            tax_amount: totals.totalTax,
            total: totals.total,
          })
          .eq('id', quote.id)

        if (quoteError) throw quoteError

        // Delete old items
        await supabase.from('quote_items').delete().eq('quote_id', quote.id)

        // Insert new items
        const itemsToInsert = items.map((item) => ({
          quote_id: quote.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        }))

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert)
        
        if (itemsError) {
          throw new Error(`Errore aggiornamento articoli: ${itemsError.message}`)
        }

        toast.success('Preventivo aggiornato con successo')
      } else {
        // CREATE new quote
        const quoteNumber = generateQuoteNumber()

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
            tax_amount: totals.totalTax,
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

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert)
        
        if (itemsError) {
          throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
        }

        toast.success(t('createSuccess') || 'Preventivo creato con successo')
      }

      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error('Error saving quote:', error)
      toast.error(error?.message || (quote ? 'Errore aggiornamento preventivo' : t('createError')))
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateQuoteTotals(items)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1800px] max-h-[92vh] overflow-y-auto w-[98vw] p-3 sm:p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg md:text-xl lg:text-2xl">
            {quote ? t('editQuote') : t('form.title')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t('form.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <SetupAlert />

        <div className="space-y-4">
          {/* General Info Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('form.generalInfo')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="client" className="text-xs font-medium">
                  {t('fields.client')} <span className="text-red-500">*</span>
                </Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-xs font-medium">{t('fields.date')}</Label>
                <Input
                  id="date"
                  type="date"
                  className="h-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valid_until" className="text-xs font-medium">{t('fields.validUntil')}</Label>
                <Input
                  id="valid_until"
                  type="date"
                  className="h-9"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">{tCommon('status')}</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="h-9">
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
          <div className="border-t pt-3"></div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('form.items')}
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t('form.addItem')}
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <Card key={index} className="relative border-border/60">
                  <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          #{index + 1}
                        </Badge>
                        {calculateLineTotal(item) > 0 && (
                          <Badge variant="secondary" className="text-xs font-medium px-2 py-0 tabular-nums">
                            CHF {calculateLineTotal(item).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-destructive/10"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 px-3 sm:px-4 pb-3">
                    <Tabs defaultValue="manual" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="manual" className="text-xs py-1">
                          <Edit3 className="h-3 w-3 mr-1" />
                          Manuale
                        </TabsTrigger>
                        {products.length > 0 && (
                          <TabsTrigger value="catalog" className="text-xs py-1">
                            <Package className="h-3 w-3 mr-1" />
                            Catalogo
                          </TabsTrigger>
                        )}
                      </TabsList>

                      <TabsContent value="manual" className="space-y-2.5 mt-2.5">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">
                            {t('form.description')} <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="resize-none text-sm min-h-[50px]"
                            rows={2}
                            placeholder="Es: Sviluppo sito web, Consulenza..."
                          />
                        </div>

                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {t('form.quantity')} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className="h-8 text-sm w-full"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {t('form.unitPrice')} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 text-sm w-28 tabular-nums"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {t('form.taxRate')}
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className="h-8 text-sm w-20 tabular-nums"
                              value={item.tax_rate}
                              onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              placeholder="8.1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Totale
                            </Label>
                            <div className="h-8 flex items-center px-2 text-sm font-medium tabular-nums bg-muted/50 rounded-md border">
                              {calculateLineTotal(item).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      {products.length > 0 && (
                        <TabsContent value="catalog" className="space-y-2 mt-2.5">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Seleziona prodotto
                            </Label>
                            <Select onValueChange={(v) => fillFromProduct(index, v)}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Cerca nel catalogo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex items-center justify-between w-full gap-3">
                                      <span className="font-medium text-sm">{product.name}</span>
                                      <span className="text-muted-foreground text-xs tabular-nums">CHF {product.unit_price.toFixed(2)}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Show filled fields preview */}
                          {item.description && (
                            <div className="p-2 bg-muted/50 rounded-md border">
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Desc:</span>
                                  <p className="font-medium truncate text-xs">{item.description}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Prezzo:</span>
                                  <p className="font-medium tabular-nums">CHF {item.unit_price.toFixed(2)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Qtà:</span>
                                  <p className="font-medium">{item.quantity}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">IVA:</span>
                                  <p className="font-medium">{item.tax_rate}%</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                      )}
                    </Tabs>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="border-t pt-3"></div>

          {/* Totals and Notes Section */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
            {/* Notes Section */}
            <div className="space-y-1.5 order-2 lg:order-1">
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

            {/* Totals Section */}
            <Card className="border-primary/20 bg-primary/5 order-1 lg:order-2 lg:min-w-[320px]">
              <CardContent className="pt-3 pb-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">{t('form.subtotal')}</span>
                    <span className="font-semibold text-sm tabular-nums">CHF {totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">{t('form.tax')}</span>
                    <span className="font-semibold text-sm tabular-nums">CHF {totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-primary/20 pt-2 flex justify-between items-center">
                    <span className="text-sm font-bold">{t('form.total')}</span>
                    <span className="text-xl font-bold text-primary tabular-nums">CHF {totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row pt-3 border-t sm:justify-end">
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
            {loading ? tCommon('loading') : (quote ? tCommon('save') : t('form.create'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

