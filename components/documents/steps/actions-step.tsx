'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Share2, Download, Mail, Printer, Copy, CheckCircle2, ExternalLink } from 'lucide-react'
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

  const handleSendPaymentRequest = async () => {
    if (!documentId || documentType !== 'invoice') {
      return
    }

    try {
      // Get payment link
      const paymentLinkResponse = await fetch(`/api/invoices/${documentId}/payment-link`, {
        method: 'POST',
      })

      if (!paymentLinkResponse.ok) {
        const errorData = await paymentLinkResponse.json()
        throw new Error(errorData.error || 'Errore nella creazione del link di pagamento')
      }

      const { paymentLinkUrl } = await paymentLinkResponse.json()

      // Get invoice data for email
      const emailResponse = await fetch(`/api/invoices/${documentId}/send-payment-request`, {
        method: 'POST',
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        throw new Error(errorData.error || 'Errore nell\'invio della richiesta di pagamento')
      }

      const { mailtoLink } = await emailResponse.json()

      // Try native share with PDF file first (mobile)
      if (navigator.share) {
        try {
          // Download PDF
          const pdfUrl = `${window.location.origin}/api/invoices/${documentId}/pdf?locale=${locale}`
          const pdfResponse = await fetch(pdfUrl)
          
          if (pdfResponse.ok) {
            const blob = await pdfResponse.blob()
            const file = new File(
              [blob],
              `Fattura-${documentNumber || documentId}.pdf`,
              { type: 'application/pdf' }
            )

            // Check if file sharing is supported
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              // Share PDF file with payment link in text
              await navigator.share({
                title: `Fattura ${documentNumber || documentId} - Richiesta di pagamento`,
                text: `Gentile cliente,\n\nAlleghiamo la fattura ${documentNumber || documentId}.\n\nPuoi pagare online qui: ${paymentLinkUrl}\n\nCordiali saluti.`,
                files: [file],
              })
              toast.success('Fattura condivisa con successo')
              return
            }
          }
        } catch (shareError: any) {
          // If native share fails, fallback to mailto
          if (shareError.name !== 'AbortError') {
            logger.debug('Native share failed, falling back to mailto', shareError)
          }
        }
      }

      // Fallback: Use mailto link (works on all devices)
      // Extract email from mailto link
      const emailMatch = mailtoLink.match(/mailto:([^?]+)/)
      const clientEmail = emailMatch ? emailMatch[1] : null

      if (clientEmail && navigator.share) {
        // Try sharing text with payment link (works on mobile even without file support)
        try {
          await navigator.share({
            title: `Fattura ${documentNumber || documentId}`,
            text: `Gentile cliente,\n\nAlleghiamo la fattura ${documentNumber || documentId}.\n\nPuoi pagare online qui: ${paymentLinkUrl}\n\nCordiali saluti.`,
            url: paymentLinkUrl,
          })
          toast.success('Link pagamento condiviso')
          return
        } catch (shareError: any) {
          if (shareError.name !== 'AbortError') {
            logger.debug('Text share failed, using mailto', shareError)
          }
        }
      }

      // Final fallback: Open mailto (works everywhere)
      // Note: mailto: cannot attach files natively
      // On desktop, user should download PDF first and attach manually
      // The PDF link in email body requires authentication, so it's better to attach manually
      toast.info('Apri il client email. Ricorda di scaricare e allegare il PDF della fattura manualmente.', {
        duration: 5000,
      })
      window.location.href = mailtoLink
    } catch (error: any) {
      logger.error('Error sending payment request', error)
      toast.error(error.message || 'Errore nell\'invio della richiesta di pagamento')
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

  const handleCopyPaymentLink = async () => {
    if (!documentId || documentType !== 'invoice') {
      return
    }

    try {
      const response = await fetch(`/api/invoices/${documentId}/payment-link`, {
        method: 'POST',
      })

      if (!response.ok) {
        let errorMessage = 'Errore nella creazione del link di pagamento'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
          
          // Check if it's a Stripe Connect not configured error
          if (errorMessage.includes('Stripe account not connected') || 
              errorMessage.includes('not ready') ||
              errorMessage.includes('not connected')) {
            toast.error('Collega prima il tuo account Stripe', {
              description: 'Vai in Impostazioni → Pagamenti per collegare Stripe',
              action: {
                label: 'Vai a Impostazioni',
                onClick: () => window.location.href = `/${locale}/dashboard/settings`,
              },
              duration: 8000,
            })
          } else {
            toast.error(errorMessage)
          }
          
          logger.error('Payment link API error', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            invoiceId: documentId,
          })
        } catch (parseError) {
          logger.error('Failed to parse error response', {
            status: response.status,
            statusText: response.statusText,
            parseError,
          })
          toast.error(errorMessage)
        }
        return
      }

      const data = await response.json()
      
      if (!data.paymentLinkUrl) {
        logger.error('Payment link URL missing from response', {
          responseData: data,
          invoiceId: documentId,
        })
        toast.error('Link di pagamento non disponibile nella risposta')
        return
      }

      await navigator.clipboard.writeText(data.paymentLinkUrl)
      toast.success('Link di pagamento copiato negli appunti')
    } catch (error: any) {
      logger.error('Error copying payment link', {
        error: error.message || error,
        errorStack: error.stack,
        invoiceId: documentId,
      })
      toast.error(error.message || 'Errore nella copia del link di pagamento')
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
      id: 'send-payment',
      label: 'Invia e Richiedi Pagamento',
      description: documentType === 'invoice' 
        ? 'Condividi fattura PDF e link pagamento via email'
        : 'Condividi preventivo PDF via email',
      icon: Mail,
      onClick: documentType === 'invoice' ? handleSendPaymentRequest : handleNativeShare,
      available: !!documentId,
      primary: true,
      disabled: isSharing,
    },
    {
      id: 'share',
      label: 'Condividi PDF',
      description: 'Condividi solo il PDF del documento',
      icon: Share2,
      onClick: handleNativeShare,
      available: !!navigator.share && !!documentId,
      primary: false,
      disabled: isSharing,
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
      id: 'copy-payment',
      label: 'Copia Link Pagamento',
      description: 'Copia solo il link per pagare',
      icon: Copy,
      onClick: handleCopyPaymentLink,
      available: documentType === 'invoice' && !!documentId,
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

