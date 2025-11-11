'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Client } from '@/lib/types/database'
import type { QuoteItemInput } from '@/lib/validations/quote'
import { calculateQuoteTotals } from '@/lib/utils/quote-utils'

interface QuoteLivePreviewProps {
  clientId: string
  clients: Client[]
  date: string
  validUntil: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  notes: string
  items: QuoteItemInput[]
  locale: string
  quoteNumber?: string
  compact?: boolean
}

export function QuoteLivePreview({
  clientId,
  clients,
  date,
  validUntil,
  status,
  notes,
  items,
  locale,
  quoteNumber,
  compact = false,
}: QuoteLivePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeBlobUrlRef = useRef<string | null>(null)
  const pendingAbortRef = useRef<AbortController | null>(null)

  const client = clients.find(c => c.id === clientId)

  const pdfData = useMemo(() => {
    if (!client || !clientId || items.length === 0 || !items.some(item => item.description?.trim())) {
      return null
    }

    const totals = calculateQuoteTotals(items)

    return {
      quote_number: quoteNumber || 'QT-XXXX-XXX',
      date,
      valid_until: validUntil || undefined,
      status,
      notes: notes || undefined,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        city: client.city,
        postal_code: client.postal_code,
        country: client.country,
      },
      items: items
        .filter(item => item.description?.trim())
        .map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        })),
      subtotal: totals.subtotal,
      tax_amount: totals.totalTax,
      total: totals.total,
      locale,
    }
  }, [clientId, client, date, validUntil, status, notes, items, quoteNumber, locale])

  useEffect(() => {
    pendingAbortRef.current?.abort()
    pendingAbortRef.current = null

    if (!pdfData) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current)
        activeBlobUrlRef.current = null
      }
      setPdfUrl(null)
      setIsGenerating(false)
      return
    }

    const controller = new AbortController()
    pendingAbortRef.current = controller

    setIsGenerating(true)
    setError(null)

    let generatedUrl: string | null = null

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch('/api/quotes/preview-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pdfData),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Errore nella generazione del PDF')
        }

        const blob = await response.blob()
        if (controller.signal.aborted) return

        generatedUrl = URL.createObjectURL(blob)

        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current)
        }

        activeBlobUrlRef.current = generatedUrl
        setPdfUrl(generatedUrl)
        setError(null)
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          return
        }
        console.error('Error generating PDF:', err)
        setError(err instanceof Error ? err.message : 'Errore sconosciuto')
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false)
        }
      }
    }, 400)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
      if (generatedUrl && generatedUrl !== activeBlobUrlRef.current) {
        URL.revokeObjectURL(generatedUrl)
      }
    }
  }, [pdfData])

  useEffect(() => {
    return () => {
      pendingAbortRef.current?.abort()
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current)
      }
    }
  }, [])

  const renderOverlay = (message?: string) => (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center bg-background/65 backdrop-blur-sm z-10 pointer-events-none px-6 text-center space-y-2',
        compact && 'px-4'
      )}
    >
      {isGenerating && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{message ?? 'Aggiornamento anteprima…'}</p>
        </>
      )}
      {!isGenerating && message && (
        <p className="text-sm text-destructive">{message}</p>
      )}
    </div>
  )

  if (!pdfUrl) {
    return (
      <div className={cn('relative h-full bg-background', compact && 'py-4')}>
        {isGenerating && renderOverlay()}
        <div className="flex items-center justify-center h-full">
          <div className={cn('text-center space-y-2 max-w-md px-4', compact && 'px-3')}>
            <p className="text-sm text-muted-foreground">
              Compila il form per vedere l'anteprima del PDF
            </p>
            <p className="text-xs text-muted-foreground">
              Seleziona un cliente e aggiungi almeno un articolo
            </p>
            {error && (
              <p className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative h-full bg-background', compact && 'py-4')}>
      <iframe
        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
        className={cn(
          'w-full h-full border-0',
          compact && 'rounded-lg border border-border shadow-sm'
        )}
        title="Quote Preview"
      />
      {(isGenerating || error) && renderOverlay(error ?? undefined)}
    </div>
  )
}

