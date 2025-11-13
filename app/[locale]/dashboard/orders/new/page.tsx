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
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import type { Supplier, Product } from '@/lib/types/database'
import type { OrderItemInput } from '@/lib/validations/order'
import { calculateOrderTotals, generateOrderNumber } from '@/lib/utils/order-utils'
import { toast } from 'sonner'

const orderStatuses = ['draft', 'ordered', 'partial', 'received', 'cancelled'] as const
type OrderStatus = (typeof orderStatuses)[number]
const isOrderStatus = (value: string): value is OrderStatus =>
  orderStatuses.includes(value as OrderStatus)

export default function NewOrderPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('orders')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('orders.status')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [status, setStatus] = useState<OrderStatus>('draft')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [items, setItems] = useState<OrderItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
  ])

  const handleStatusChange = (value: string) => {
    if (isOrderStatus(value)) {
      setStatus(value)
    }
  }

  useEffect(() => {
    loadSuppliers()
    loadProducts()
  }, [])

  const loadSuppliers = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')

    if (data) setSuppliers(data)
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

  const addProductItem = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    setItems([...items, {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: Number(product.unit_price),
      tax_rate: Number(product.tax_rate),
    }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof OrderItemInput, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/${locale}/auth/login`)
        return
      }

      const orderNumber = generateOrderNumber()
      const totals = calculateOrderTotals(items)

      // Insert order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          supplier_id: supplierId,
          order_number: orderNumber,
          date,
          expected_delivery_date: deliveryDate || null,
          status,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total,
          notes,
          internal_notes: internalNotes,
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Insert order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      toast.success(t('createSuccess') || 'Ordine creato con successo')
      router.push(`/${locale}/dashboard/orders`)
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error(t('createError') || 'Errore nella creazione dell\'ordine')
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateOrderTotals(items)

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon('back') || 'Indietro'}
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('newOrder') || 'Nuovo Ordine'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('newOrderDescription') || 'Crea un nuovo ordine cliente'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tCommon('details') || 'Dettagli Ordine'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier_id">
                  {t('supplier') || 'Fornitore'} <span className="text-destructive">*</span>
                </Label>
                <Select value={supplierId} onValueChange={setSupplierId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectSupplier') || 'Seleziona Fornitore'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{tCommon('status') || 'Stato'}</Label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatuses.map((orderStatus) => (
                      <SelectItem key={orderStatus} value={orderStatus}>
                        {tStatus(orderStatus)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">{t('orderDate') || 'Data Ordine'}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_date">{t('deliveryDate') || 'Data Consegna Prevista'}</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('orderItems') || 'Articoli Ordine'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="add_product">{t('addFromCatalog') || 'Aggiungi da Catalogo'}</Label>
                <Select onValueChange={addProductItem}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectProduct') || 'Seleziona Prodotto'} />
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

            {items.map((item, index) => (
              <Card key={index}>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>{t('description') || 'Descrizione'}</Label>
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>{t('quantity') || 'Quantità'}</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('unitPrice') || 'Prezzo Unit.'}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('taxRate') || 'IVA %'}</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.tax_rate}
                        onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 8.1)}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {t('addItem') || 'Aggiungi Articolo'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tCommon('totals') || 'Totali'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>{t('subtotal') || 'Subtotale'}</span>
              <span className="font-mono">CHF {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('tax') || 'IVA'}</span>
              <span className="font-mono">CHF {totals.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>{t('total') || 'Totale'}</span>
              <span className="font-mono">CHF {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes') || 'Note Cliente'}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder') || 'Note visibili al cliente'}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_notes">{t('internalNotes') || 'Note Interne'}</Label>
              <Textarea
                id="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder={t('internalNotesPlaceholder') || 'Note private, non visibili al cliente'}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            {tCommon('cancel') || 'Annulla'}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (tCommon('saving') || 'Salvataggio...') : (t('create') || 'Crea Ordine')}
          </Button>
        </div>
      </form>
    </div>
  )
}

