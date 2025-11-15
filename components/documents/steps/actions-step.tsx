'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Share2, Download, Mail, Printer, Copy, CheckCircle2, ExternalLink, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface ActionsStepProps {
  documentId?: string
  documentNumber?: string
  documentType: 'invoice' | 'quote'
  onShare?: () => void
  onDownload?: () => void
  onEmail?: () => void
  onPrint?: () => void
  onView?: () => void
  onPayment?: () => void
  locale: string
  total?: number
}

export function ActionsStep({
  documentId,
  documentNumber,
  documentType,
  onShare,
  onDownload,
  onEmail,
  onPrint,
  onView,
  onPayment,
  locale,
  total,
}: ActionsStepProps) {
  const [copied, setCopied] = React.useState(false)
  const [isSharing, setIsSharing] = React.useState(false)

  const handleNativeShare = async () => {
    if (!navigator.share) {
      toast.error('La condivisione nativa non è supportata su questo dispositivo')
      return
    }

    if (!documentId) {
      toast.error('Documento non disponibile per la condivisione')
      return
    }

    setIsSharing(true)
    try {
      // Download PDF
      const pdfUrl = `${window.location.origin}/api/${documentType === 'invoice' ? 'invoices' : 'quotes'}/${documentId}/pdf?locale=${locale}`
      const response = await fetch(pdfUrl)
      
      if (!response.ok) {
        throw new Error('Errore nel download del PDF')
      }

      const blob = await response.blob()
      const file = new File(
        [blob],
        `${documentType === 'invoice' ? 'Fattura' : 'Preventivo'}-${documentNumber}.pdf`,
        { type: 'application/pdf' }
      )

      // Share PDF file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${documentType === 'invoice' ? 'Fattura' : 'Preventivo'} ${documentNumber}`,
          text: `Condivido con te ${documentType === 'invoice' ? 'la fattura' : 'il preventivo'} ${documentNumber}`,
          files: [file],
        })
        toast.success('PDF condiviso con successo')
      } else {
        // Fallback: share URL if file sharing not supported
        await navigator.share({
          title: `${documentType === 'invoice' ? 'Fattura' : 'Preventivo'} ${documentNumber}`,
          text: `Condivido con te ${documentType === 'invoice' ? 'la fattura' : 'il preventivo'} ${documentNumber}`,
          url: pdfUrl,
        })
        toast.success('Link PDF condiviso con successo')
      }
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        logger.error('Error sharing PDF', error)
        toast.error('Errore durante la condivisione del PDF')
      }
    } finally {
      setIsSharing(false)
    }
  }

  const handlePayment = async () => {
    if (!documentId || documentType !== 'invoice') {
      return
    }

    try {
      // Create or get payment link
      const response = await fetch(`/api/invoices/${documentId}/payment-link`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Errore nella creazione del link di pagamento')
      }

      const { paymentLinkUrl } = await response.json()
      
      // Open payment link in new tab
      window.open(paymentLinkUrl, '_blank')
      toast.success('Link di pagamento aperto')
    } catch (error: any) {
      logger.error('Error creating payment link', error)
      toast.error('Errore nella creazione del link di pagamento')
    }
  }

  const handleCopyLink = async () => {
    const link = documentId
      ? `${window.location.origin}/${locale}/dashboard/${documentType === 'invoice' ? 'invoices' : 'quotes'}/${documentId}`
      : window.location.href

    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copiato negli appunti')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Errore durante la copia del link')
    }
  }

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
    } else {
      window.print()
    }
  }

  const actions = [
    {
      id: 'share',
      label: 'Condividi PDF',
      description: 'Condividi il PDF nativamente',
      icon: Share2,
      onClick: handleNativeShare,
      available: !!navigator.share && !!documentId,
      primary: true,
      disabled: isSharing,
    },
    {
      id: 'payment',
      label: 'Paga Online',
      description: total ? `Paga ${total.toFixed(2)} CHF` : 'Crea link di pagamento',
      icon: CreditCard,
      onClick: handlePayment,
      available: documentType === 'invoice' && !!documentId,
      primary: documentType === 'invoice',
    },
    {
      id: 'download',
      label: 'Scarica PDF',
      description: 'Scarica il documento',
      icon: Download,
      onClick: onDownload,
      available: !!onDownload,
    },
    {
      id: 'email',
      label: 'Invia Email',
      description: 'Invia via email',
      icon: Mail,
      onClick: onEmail,
      available: !!onEmail,
    },
    {
      id: 'print',
      label: 'Stampa',
      description: 'Stampa il documento',
      icon: Printer,
      onClick: handlePrint,
      available: true,
    },
    {
      id: 'copy',
      label: 'Copia Link',
      description: 'Copia link documento',
      icon: copied ? CheckCircle2 : Copy,
      onClick: handleCopyLink,
      available: true,
    },
    {
      id: 'view',
      label: 'Visualizza',
      description: 'Apri il documento',
      icon: ExternalLink,
      onClick: onView,
      available: !!onView && !!documentId,
    },
  ].filter(action => action.available)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Azioni</h2>
        <p className="text-sm text-muted-foreground">
          Scegli come vuoi procedere con il documento
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Card
              key={action.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
                action.primary && 'border-primary/30 bg-primary/5',
                action.disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={action.disabled ? undefined : action.onClick}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      action.primary
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold">
                      {action.label}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {action.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      {documentNumber && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">
                  {documentType === 'invoice' ? 'Fattura' : 'Preventivo'} creata con successo
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Numero: {documentNumber}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

