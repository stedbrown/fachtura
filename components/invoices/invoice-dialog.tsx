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
import type { InvoiceWithClient, Client, Product } from '@/lib/types/database'
import type { InvoiceItemInput } from '@/lib/validations/invoice'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { SetupAlert } from '@/components/setup-alert'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { toast } from 'sonner'

interface InvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  invoice?: InvoiceWithClient | null
}

export function InvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  invoice,
}: InvoiceDialogProps) {
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('invoices.status')
  const tProducts = useTranslations('products')
  const { hasRequiredFields } = useCompanySettings()
  
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'draft' | 'issued' | 'paid' | 'overdue'>('draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
  ])

  useEffect(() => {
    if (open) {
      loadClients()
      loadProducts()
      if (invoice) {
        // TODO: Load invoice data
      } else {
        resetForm()
      }
    }
  }, [open, invoice])

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

  const updateItem = (index: number, field: keyof InvoiceItemInput, value: any) => {
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

  const calculateLineTotal = (item: InvoiceItemInput) => {
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
      toast.error('Aggiungi almeno un articolo alla fattura')
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
      const invoiceNumber = generateInvoiceNumber()
      const totals = calculateInvoiceTotals(items)

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          date,
          due_date: dueDate || null,
          status,
          notes: notes || null,
          subtotal: totals.subtotal,
          tax_amount: totals.totalTax,
          total: totals.total,
        })
        .select()
        .single()

      if (invoiceError || !invoiceData) throw invoiceError

      const itemsToInsert = items.map((item) => ({
        invoice_id: invoiceData.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      console.log('Inserting invoice items:', itemsToInsert)
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
      
      if (itemsError) {
        console.error('Error inserting invoice items:', itemsError)
        throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
      }

      toast.success(t('createSuccess') || 'Fattura creata con successo')
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error('Error creating invoice:', error)
      toast.error(error?.message || t('createError'))
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateInvoiceTotals(items)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1800px] max-h-[92vh] overflow-y-auto w-[98vw]">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl">
            {invoice ? t('editInvoice') : t('form.title')}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">{tCommon('status')}</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['draft', 'issued', 'paid', 'overdue'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {tStatus(s as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="due_date" className="text-sm font-medium">{t('fields.dueDate')}</Label>
                <Input
                  id="due_date"
                  type="date"
                  className="h-10"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
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
                    <Tabs defaultValue="manual" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="manual" className="text-xs">
                          <Edit3 className="h-3 w-3 mr-1.5" />
                          Inserimento Manuale
                        </TabsTrigger>
                        {products.length > 0 && (
                          <TabsTrigger value="catalog" className="text-xs">
                            <Package className="h-3 w-3 mr-1.5" />
                            Dal Catalogo
                          </TabsTrigger>
                        )}
                      </TabsList>

                      <TabsContent value="manual" className="space-y-3 mt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            {t('form.description')} <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="resize-none text-sm min-h-[60px]"
                            rows={2}
                            placeholder="Es: Sviluppo sito web, Consulenza, Servizio..."
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              {t('form.quantity')} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className="h-9 text-sm"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              {t('form.unitPrice')} (CHF) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-9 text-sm"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              {t('form.taxRate')} (%)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className="h-9 text-sm"
                              value={item.tax_rate}
                              onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              placeholder="8.1"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      {products.length > 0 && (
                        <TabsContent value="catalog" className="space-y-3 mt-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              Seleziona un prodotto
                            </Label>
                            <Select onValueChange={(v) => fillFromProduct(index, v)}>
                              <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="Cerca nel tuo catalogo prodotti..." />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex items-center justify-between w-full gap-3">
                                      <span className="font-medium">{product.name}</span>
                                      <span className="text-muted-foreground text-xs">CHF {product.unit_price.toFixed(2)}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Il prodotto selezionato compilerà automaticamente tutti i campi
                            </p>
                          </div>

                          {/* Show filled fields preview */}
                          {item.description && (
                            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                              <p className="text-xs font-medium">Anteprima:</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Descrizione:</span>
                                  <p className="font-medium truncate">{item.description}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Prezzo:</span>
                                  <p className="font-medium">CHF {item.unit_price.toFixed(2)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Quantità:</span>
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

