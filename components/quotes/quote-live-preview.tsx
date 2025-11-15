'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Client } from '@/lib/types/database'
import type { QuoteItemInput } from '@/lib/validations/quote'
import { calculateQuoteTotals } from '@/lib/utils/quote-utils'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

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
    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      logger.debug('QuoteLivePreview: pdfData recalculating', {
        clientId,
        itemsCount: items.length,
        items: items.map(item => ({
          description: item.description?.substring(0, 30),
          quantity: item.quantity,
          unit_price: item.unit_price,
          hasDescription: !!item.description?.trim(),
        })),
      })
    }

    // Show preview as soon as client is selected, even without items
    if (!client || !clientId) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('QuoteLivePreview: No client selected', { clientId, hasClient: !!client })
      }
      return null
    }
    
    // Filter out empty items for calculation
    const validItems = items.filter(item => item.description?.trim() && item.quantity > 0 && item.unit_price > 0)
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('QuoteLivePreview: Valid items', {
        totalItems: items.length,
        validItemsCount: validItems.length,
        validItems: validItems.map(item => ({
          description: item.description?.substring(0, 30),
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      })
    }
    
    // If no valid items, return basic preview with client info only
    if (validItems.length === 0) {
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
        items: [],
        subtotal: 0,
        tax_amount: 0,
        total: 0,
        locale,
      }
    }

    const totals = calculateQuoteTotals(validItems)

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
      items: validItems.map(item => ({
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
    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      logger.debug('QuoteLivePreview: useEffect triggered', {
        hasPdfData: !!pdfData,
        pdfDataItemsCount: pdfData?.items?.length || 0,
        clientName: pdfData?.client?.name,
      })
    }

    // Abort any pending request when dependencies change
    pendingAbortRef.current?.abort()
    pendingAbortRef.current = null

    if (!pdfData) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('QuoteLivePreview: No pdfData, clearing preview')
      }
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

    if (process.env.NODE_ENV === 'development') {
      logger.debug('QuoteLivePreview: Starting PDF generation', {
        itemsCount: pdfData.items.length,
        total: pdfData.total,
      })
    }

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
        if (err instanceof DOMException && err.name === 'AbortError') {
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
      <div className={cn('relative w-full h-full bg-background rounded-xl border-2 border-border/50 shadow-xl flex items-center justify-center', compact && 'py-0')}>
        {isGenerating && renderOverlay()}
        <div className="text-center space-y-3 max-w-md px-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Compila il form per vedere l'anteprima del PDF
          </p>
          <p className="text-xs text-muted-foreground">
            Seleziona un cliente e aggiungi almeno un articolo
          </p>
          {error && (
            <p className="text-xs text-destructive mt-2 font-medium">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full h-full bg-background rounded-xl border-2 border-border/50 shadow-2xl overflow-hidden', compact && 'py-0')}>
      <iframe
        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=page-fit`}
        className={cn(
          'w-full h-full border-0 rounded-xl',
          'bg-white'
        )}
        title="Quote Preview"
        style={{ minHeight: '100%' }}
      />
      {(isGenerating || error) && renderOverlay(error ?? undefined)}
    </div>
  )
}

