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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Package, Edit3, ArrowLeft, ChevronDown } from 'lucide-react'
import type { Client, Product } from '@/lib/types/database'
import type { InvoiceItemInput } from '@/lib/validations/invoice'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { SetupAlert } from '@/components/setup-alert'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { toast } from 'sonner'
import { InvoiceLivePreview } from '@/components/invoices/invoice-live-preview'

export default function NewInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('invoices.status')
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [invoiceNumber] = useState(generateInvoiceNumber())

  useEffect(() => {
    loadClients()
    loadProducts()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const handlePreview = (event: MediaQueryListEvent) => {
      setIsPreviewOpen(event.matches)
    }
    setIsPreviewOpen(mq.matches)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handlePreview)
      return () => mq.removeEventListener('change', handlePreview)
    } else {
      mq.addListener(handlePreview)
      return () => mq.removeListener(handlePreview)
    }
  }, [])

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

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert)
      
      if (itemsError) {
        throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
      }

      toast.success(t('createSuccess') || 'Fattura creata con successo')
      router.push(`/${locale}/dashboard/invoices`)
    } catch (error: any) {
      console.error('Error saving invoice:', error)
      toast.error(error?.message || t('createError'))
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateInvoiceTotals(items)

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/dashboard/invoices`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
            <div className="leading-tight">
              <span className="block text-xs font-medium text-muted-foreground uppercase sm:hidden">
                {t('title')}
              </span>
              <h1 className="text-lg font-semibold sm:text-xl">{t('form.title')}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{t('form.subtitle')}</p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${locale}/dashboard/invoices`)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? tCommon('loading') : t('form.create')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        {/* Form Section */}
        <div className="w-full xl:w-1/2 xl:border-r border-border/60 overflow-y-auto bg-background flex-1">
          <div className="p-4 lg:p-6 space-y-4">
            <SetupAlert />

            {/* General Info Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('form.generalInfo')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
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
                  <Label htmlFor="due_date" className="text-xs font-medium">{t('fields.dueDate')}</Label>
                  <Input
                    id="due_date"
                    type="date"
                    className="h-9"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-medium">{tCommon('status')}</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger className="h-9">
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          #{index + 1}
                        </span>
                        {calculateLineTotal(item) > 0 && (
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            CHF {calculateLineTotal(item).toFixed(2)}
                          </span>
                        )}
                        <div className="ml-auto">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
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
                              className="h-8 text-sm w-full tabular-nums"
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
                              className="h-8 text-sm w-full tabular-nums"
                              value={item.tax_rate}
                              onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              placeholder="8.1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Totale
                            </Label>
                            <div className="h-8 flex items-center px-2 text-sm font-medium tabular-nums bg-muted/50 rounded-md border w-full">
                              CHF {calculateLineTotal(item).toFixed(2)}
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

            {/* Notes Section */}
            <div className="space-y-1.5">
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
        </div>

        {/* Mobile Preview Toggle */}
        <div className="xl:hidden border-t border-border/60 bg-muted/30 px-4 py-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={() => setIsPreviewOpen((prev) => !prev)}
          >
            <span className="text-sm font-medium">
              {isPreviewOpen ? t('preview.toggleClose') : t('preview.toggleOpen')}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isPreviewOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>

        {/* Preview Section */}
        <div
          className={`border-border/60 bg-muted/30 flex-shrink-0 overflow-hidden xl:w-1/2 xl:border-l xl:border-t-0 xl:h-full xl:block ${
            isPreviewOpen ? 'block border-t h-[45vh] sm:h-[55vh] lg:h-[60vh]' : 'hidden border-t'
          }`}
        >
          <InvoiceLivePreview
            clientId={clientId}
            clients={clients}
            date={date}
            dueDate={dueDate}
            status={status}
            notes={notes}
            items={items}
            locale={locale}
            invoiceNumber={invoiceNumber}
            compact
          />
        </div>
      </div>
    </div>
  )
}

