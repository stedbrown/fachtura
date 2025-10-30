'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import type { QuoteItemInput } from '@/lib/validations/quote'
import { calculateQuoteTotals, generateQuoteNumber } from '@/lib/utils/quote-utils'

export default function NewQuotePage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState('')
  const [status, setStatus] = useState<'draft' | 'sent' | 'accepted' | 'rejected'>('draft')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<QuoteItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
  ])

  useEffect(() => {
    loadClients()
    loadCompanyDefaults()
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

  const loadCompanyDefaults = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: company } = await supabase
      .from('company_settings')
      .select('quote_default_notes, quote_default_validity_days')
      .eq('user_id', user.id)
      .single()

    if (company) {
      // Set default notes
      if (company.quote_default_notes) {
        setNotes(company.quote_default_notes)
      }
      
      // Calculate and set default valid until date
      if (company.quote_default_validity_days) {
        const validityDays = company.quote_default_validity_days
        const validUntilDate = new Date()
        validUntilDate.setDate(validUntilDate.getDate() + validityDays)
        setValidUntil(validUntilDate.toISOString().split('T')[0])
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
    field: keyof QuoteItemInput,
    value: string | number
  ) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      alert('Seleziona un cliente')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const totals = calculateQuoteTotals(items)
      const quoteNumber = generateQuoteNumber()

      // Create quote
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          client_id: clientId,
          quote_number: quoteNumber,
          date,
          valid_until: validUntil || null,
          status: status,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total,
          notes: notes || null,
        })
        .select()
        .single()

      if (quoteError || !quote) {
        alert('Errore durante la creazione del preventivo')
        return
      }

      // Create quote items
      const itemsToInsert = items.map((item) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
      }))

      await supabase.from('quote_items').insert(itemsToInsert)

      router.push(`/${locale}/dashboard/quotes`)
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateQuoteTotals(items)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nuovo Preventivo</h1>
        <p className="text-muted-foreground">
          Crea un nuovo preventivo per un cliente
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informazioni Generali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente" />
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
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valido fino al</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Stato</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="sent">Inviato</SelectItem>
                  <SelectItem value="accepted">Accettato</SelectItem>
                  <SelectItem value="rejected">Rifiutato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Note</Label>
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
            <CardTitle>Articoli</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi Articolo
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
                  <Label>Descrizione</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, 'description', e.target.value)
                    }
                    placeholder="Descrizione articolo"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantità</Label>
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
                    <Label>Prezzo Unitario (CHF)</Label>
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
                    <Label>IVA (%)</Label>
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
                    Totale riga: CHF{' '}
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
            <CardTitle>Totali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotale:</span>
              <span>CHF {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA:</span>
              <span>CHF {totals.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Totale:</span>
              <span>CHF {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/quotes')}
          >
            Annulla
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvataggio...' : 'Crea Preventivo'}
          </Button>
        </div>
      </form>
    </div>
  )
}

