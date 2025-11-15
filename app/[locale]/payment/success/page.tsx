'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { logger } from '@/lib/logger'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('Session ID mancante')
        setLoading(false)
        return
      }

      // Wait a bit for webhook to process, then verify manually
      setVerifying(true)
      try {
        // Give webhook time to process (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Verify payment status via API
        const response = await fetch(`/api/payment/verify?session_id=${sessionId}`)
        const data = await response.json()

        if (data.success) {
          logger.info('Payment verified successfully', { sessionId })
        } else {
          logger.warn('Payment verification failed or pending', { sessionId, data })
        }
      } catch (err: any) {
        logger.error('Error verifying payment', err)
        // Don't show error to user, webhook might still process it
      } finally {
        setVerifying(false)
        setLoading(false)
      }
    }

    verifyPayment()
  }, [sessionId])

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {verifying ? 'Verifica pagamento in corso...' : 'Caricamento...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Errore</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard/invoices')}>
              Torna alle fatture
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Pagamento completato!</CardTitle>
          <CardDescription>
            Il tuo pagamento è stato elaborato con successo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Riceverai una conferma via email. La fattura è stata aggiornata automaticamente.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/dashboard/invoices')}
              className="flex-1"
            >
              Vai alle fatture
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="flex-1"
            >
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

