'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Package, Edit3 } from 'lucide-react'
import type { Client, InvoiceWithClient, Product, QuoteWithClient } from '@/lib/types/database'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import { calculateQuoteTotals, generateQuoteNumber } from '@/lib/utils/quote-utils'
import { SetupAlert } from '@/components/setup-alert'
import { toast } from 'sonner'
import { logger, getErrorMessage } from '@/lib/logger'

type DocumentStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'sent' | 'accepted' | 'rejected'
type DocumentTable = 'invoices' | 'quotes'
type DocumentItemsTable = 'invoice_items' | 'quote_items'
type DocumentForeignKey = 'invoice_id' | 'quote_id'
type DocumentNumberField = 'invoice_number' | 'quote_number'
type DocumentDeadlineColumn = 'due_date' | 'valid_until'

interface DocumentItemInput {
  product_id?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
}

const DEFAULT_ITEM: DocumentItemInput = {
  description: '',
  quantity: 1,
  unit_price: 0,
  tax_rate: 8.1,
}

interface BaseDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type InvoiceDocumentDialogProps = BaseDocumentDialogProps & {
  type: 'invoice'
  document?: InvoiceWithClient | null
}

type QuoteDocumentDialogProps = BaseDocumentDialogProps & {
  type: 'quote'
  document?: QuoteWithClient | null
}

export type DocumentDialogProps = InvoiceDocumentDialogProps | QuoteDocumentDialogProps

export function DocumentDialog(props: DocumentDialogProps) {
  const { open, onOpenChange, onSuccess } = props
  const document = props.document ?? null

  const isInvoice = props.type === 'invoice'
  const namespace = isInvoice ? 'invoices' : 'quotes'

  const t = useTranslations(namespace)
  const tStatus = useTranslations(`${namespace}.status`)
  const tCommon = useTranslations('common')
  const tProducts = useTranslations('products')

  const statusOptions: DocumentStatus[] = isInvoice
    ? ['draft', 'issued', 'paid', 'overdue']
    : ['draft', 'sent', 'accepted', 'rejected']

  const documentTable: DocumentTable = isInvoice ? 'invoices' : 'quotes'
  const itemsTable: DocumentItemsTable = isInvoice ? 'invoice_items' : 'quote_items'
  const foreignKey: DocumentForeignKey = isInvoice ? 'invoice_id' : 'quote_id'
  const numberField: DocumentNumberField = isInvoice ? 'invoice_number' : 'quote_number'
  const deadlineColumn: DocumentDeadlineColumn = isInvoice ? 'due_date' : 'valid_until'

  const dateFieldId = isInvoice ? 'due_date' : 'valid_until'
  const dateFieldLabel = t(`fields.${isInvoice ? 'dueDate' : 'validUntil'}`)
  const editTitle = t(isInvoice ? 'editInvoice' : 'editQuote')

  const calculateTotals = useMemo(
    () => (isInvoice ? calculateInvoiceTotals : calculateQuoteTotals),
    [isInvoice]
  )
  const generateNumber = useMemo(
    () => (isInvoice ? generateInvoiceNumber : generateQuoteNumber),
    [isInvoice]
  )

  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [deadline, setDeadline] = useState('')
  const [status, setStatus] = useState<DocumentStatus>('draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DocumentItemInput[]>([DEFAULT_ITEM])

  const totals = useMemo(() => calculateTotals(items), [calculateTotals, items])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadClients()
    void loadProducts()

    if (document) {
      void loadDocumentData(document)
    } else {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, document?.id, isInvoice])

  const resetForm = () => {
    setClientId('')
    setDate(new Date().toISOString().split('T')[0])
    setDeadline('')
    setStatus('draft')
    setNotes('')
    setItems([DEFAULT_ITEM])
  }

  const loadDocumentData = async (doc: InvoiceWithClient | QuoteWithClient) => {
    setClientId(doc.client_id)
    setDate(doc.date)
    setDeadline(
      isInvoice
        ? (doc as InvoiceWithClient).due_date || ''
        : (doc as QuoteWithClient).valid_until || ''
    )
    setStatus((doc.status as DocumentStatus) ?? 'draft')
    setNotes(doc.notes || '')

    const supabase = createClient()
    const { data: itemsData } = await supabase
      .from(itemsTable)
      .select('*')
      .eq(foreignKey, doc.id)
      .order('created_at')

    if (itemsData && itemsData.length > 0) {
      setItems(
        itemsData.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          product_id: item.product_id || undefined,
        }))
      )
    } else {
      setItems([DEFAULT_ITEM])
    }
  }

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

  const addItem = () => {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM }])
  }

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const updateItem = (
    index: number,
    field: keyof DocumentItemInput,
    value: DocumentItemInput[typeof field]
  ) => {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const fillFromProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    setItems((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        description: product.name,
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
        product_id: product.id,
      }
      return updated
    })

    logger.debug('Filled item from product', { productId })
  }

  const calculateLineTotal = (item: DocumentItemInput) => {
    const subtotal = item.quantity * item.unit_price
    const tax = subtotal * (item.tax_rate / 100)
    return subtotal + tax
  }

  const handleSubmit = async () => {
    if (!clientId) {
      toast.error(t('form.errorSelectClient'))
      return
    }

    if (items.length === 0) {
      toast.error(
        isInvoice
          ? 'Aggiungi almeno un articolo alla fattura'
          : 'Aggiungi almeno un articolo al preventivo'
      )
      return
    }

    const hasEmptyDescriptions = items.some((item) => !item.description?.trim())
    if (hasEmptyDescriptions) {
      toast.error(
        isInvoice
          ? 'Compila la descrizione per tutti gli articoli della fattura'
          : 'Compila la descrizione per tutti gli articoli del preventivo'
      )
      return
    }

    const hasInvalidQuantity = items.some((item) => item.quantity <= 0)
    if (hasInvalidQuantity) {
      toast.error('La quantità deve essere maggiore di 0 per tutti gli articoli')
      return
    }

    const hasInvalidPrice = items.some((item) => item.unit_price <= 0)
    if (hasInvalidPrice) {
      toast.error('Il prezzo unitario deve essere maggiore di 0 per tutti gli articoli')
      return
    }

    const hasInvalidTax = items.some((item) => item.tax_rate < 0)
    if (hasInvalidTax) {
      toast.error("L'IVA non può essere negativa")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error(tCommon('error'))
      setLoading(false)
      return
    }

    try {
      const currentTotals = calculateTotals(items)

      if (document) {
        const updatePayload: Record<string, unknown> = {
          client_id: clientId,
          date,
          status,
          notes: notes || null,
          subtotal: currentTotals.subtotal,
          tax_amount: currentTotals.totalTax,
          total: currentTotals.total,
        }

        updatePayload[deadlineColumn] = deadline || null

        const { error: documentError } = await supabase
          .from(documentTable)
          .update(updatePayload)
          .eq('id', document.id)

        if (documentError) throw documentError

        await supabase.from(itemsTable).delete().eq(foreignKey, document.id)

        const itemsToInsert = items.map((item) => ({
          [foreignKey]: document.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        }))

        const { error: itemsError } = await supabase.from(itemsTable).insert(itemsToInsert)

        if (itemsError) {
          throw new Error(`Errore aggiornamento articoli: ${itemsError.message}`)
        }

        toast.success(t('updateSuccess'))
      } else {
        const documentNumber = generateNumber()

        const insertPayload: Record<string, unknown> = {
          user_id: user.id,
          client_id: clientId,
          [numberField]: documentNumber,
          date,
          status,
          notes: notes || null,
          subtotal: currentTotals.subtotal,
          tax_amount: currentTotals.totalTax,
          total: currentTotals.total,
        }

        insertPayload[deadlineColumn] = deadline || null

        const {
          data: createdDocument,
          error: createError,
        } = await supabase.from(documentTable).insert(insertPayload).select().single()

        if (createError || !createdDocument) throw createError

        const itemsToInsert = items.map((item) => ({
          [foreignKey]: createdDocument.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        }))

        const { error: itemsError } = await supabase.from(itemsTable).insert(itemsToInsert)

        if (itemsError) {
          throw new Error(`Errore inserimento articoli: ${itemsError.message}`)
        }

        toast.success(t('createSuccess'))
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      logger.error(`Error saving ${isInvoice ? 'invoice' : 'quote'}`, error, {
        documentId: document?.id,
      })
      toast.error(
        getErrorMessage(error) || (document ? t('updateError') : t('createError'))
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1800px] max-h-[92vh] overflow-y-auto w-[98vw]">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg md:text-xl lg:text-2xl">
            {document ? editTitle : t('form.title')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t('form.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <SetupAlert />

        <div className="space-y-4">
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
                <Label htmlFor="date" className="text-xs font-medium">
                  {t('fields.date')}
                </Label>
                <Input
                  id="date"
                  type="date"
                  className="h-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={dateFieldId} className="text-xs font-medium">
                  {dateFieldLabel}
                </Label>
                <Input
                  id={dateFieldId}
                  type="date"
                  className="h-9"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">
                  {tCommon('status')}
                </Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as DocumentStatus)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((documentStatus) => (
                      <SelectItem key={documentStatus} value={documentStatus}>
                        {tStatus(documentStatus)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-3"></div>

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
                            {tProducts('fillFromCatalog')}
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
                              onChange={(e) =>
                                updateItem(index, 'quantity', parseFloat(e.target.value) || 1)
                              }
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
                              onChange={(e) =>
                                updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                              }
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
                              onChange={(e) =>
                                updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)
                              }
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
                              {tProducts('selectProductToFill') || 'Seleziona prodotto'}
                            </Label>
                            <Select onValueChange={(value) => fillFromProduct(index, value)}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Cerca nel catalogo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex items-center justify-between w-full gap-3">
                                      <span className="font-medium text-sm">{product.name}</span>
                                      <span className="text-muted-foreground text-xs tabular-nums">
                                        CHF {product.unit_price.toFixed(2)}
                                      </span>
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
                                  <p className="font-medium tabular-nums">
                                    CHF {item.unit_price.toFixed(2)}
                                  </p>
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

          <div className="border-t pt-3"></div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
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

            <Card className="border-primary/20 bg-primary/5 order-1 lg:order-2 lg:min-w-[320px]">
              <CardContent className="pt-3 pb-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">{t('form.subtotal')}</span>
                    <span className="font-semibold text-sm tabular-nums">
                      CHF {totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">{t('form.tax')}</span>
                    <span className="font-semibold text-sm tabular-nums">
                      CHF {totals.totalTax.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-primary/20 pt-2 flex justify-between items-center">
                    <span className="text-sm font-bold">{t('form.total')}</span>
                    <span className="text-xl font-bold text-primary tabular-nums">
                      CHF {totals.total.toFixed(2)}
                    </span>
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
            {loading ? tCommon('loading') : document ? tCommon('save') : t('form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


