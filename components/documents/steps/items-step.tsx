'use client'

import * as React from 'react'
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Trash2, GripVertical, Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types/database'

export interface ItemInput {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  product_id?: string
}

interface ItemsStepProps {
  items: ItemInput[]
  onItemsChange: (items: ItemInput[]) => void
  products: Product[]
  calculateLineTotal: (item: ItemInput) => number
  t: (key: string) => string
}

export function ItemsStep({
  items,
  onItemsChange,
  products,
  calculateLineTotal,
  t,
}: ItemsStepProps) {
  const [productSearchOpen, setProductSearchOpen] = React.useState<Record<string, boolean>>({})

  const addItem = () => {
    const newItem: ItemInput = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 8.1,
    }
    onItemsChange([...items, newItem])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      onItemsChange(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof ItemInput, value: any) => {
    onItemsChange(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const fillFromProduct = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      updateItem(itemId, 'description', product.name)
      updateItem(itemId, 'unit_price', product.unit_price)
      updateItem(itemId, 'tax_rate', product.tax_rate)
      updateItem(itemId, 'product_id', product.id)
      setProductSearchOpen((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => p.is_active)
  }, [products])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Articoli</h2>
        <p className="text-sm text-muted-foreground">
          Aggiungi i prodotti o servizi da fatturare
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const lineTotal = calculateLineTotal(item)
          const isProductSearchOpen = productSearchOpen[item.id] || false

          return (
            <Card key={item.id} className="relative border-border/60">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Articolo #{index + 1}
                  </span>
                  {lineTotal > 0 && (
                    <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
                      CHF {lineTotal.toFixed(2)}
                    </span>
                  )}
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-destructive/10"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4">
                {/* Product Search / Manual Entry */}
                <div className="space-y-3">
                  {filteredProducts.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Aggiungi da catalogo (opzionale)</Label>
                      <Popover
                        open={isProductSearchOpen}
                        onOpenChange={(open) =>
                          setProductSearchOpen((prev) => ({ ...prev, [item.id]: open }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start h-10 text-sm font-normal"
                          >
                            <Search className="mr-2 h-4 w-4" />
                            {item.product_id
                              ? products.find((p) => p.id === item.product_id)?.name ||
                                'Cerca prodotto...'
                              : 'Cerca prodotto dal catalogo...'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Cerca prodotto..." className="h-9" />
                            <CommandList>
                              <CommandEmpty>Nessun prodotto trovato</CommandEmpty>
                              <CommandGroup>
                                {filteredProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => fillFromProduct(item.id, product.id)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between w-full gap-3">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-sm">{product.name}</span>
                                        {product.sku && (
                                          <span className="text-xs text-muted-foreground">
                                            SKU: {product.sku}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                                        CHF {product.unit_price.toFixed(2)}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground text-center py-1">
                    oppure
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    {t('form.description')} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    className="resize-none text-sm min-h-[60px]"
                    rows={2}
                    placeholder="Es: Sviluppo sito web, Consulenza..."
                  />
                </div>

                {/* Quantity, Price, Tax */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">
                      {t('form.quantity')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="h-10 text-sm"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)
                      }
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">
                      {t('form.unitPrice')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-10 text-sm tabular-nums"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">{t('form.taxRate')}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="h-10 text-sm tabular-nums"
                      value={item.tax_rate}
                      onChange={(e) =>
                        updateItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)
                      }
                      placeholder="8.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Totale</Label>
                    <div className="h-10 flex items-center px-3 text-sm font-semibold tabular-nums bg-muted/50 rounded-md border">
                      CHF {lineTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addItem}
        className="w-full h-11"
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('form.addItem')}
      </Button>
    </div>
  )
}

