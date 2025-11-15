'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function PaymentCancelPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const invoiceId = searchParams.get('invoice_id')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Pagamento annullato</CardTitle>
          <CardDescription>
            Il pagamento è stato annullato. Nessun addebito è stato effettuato.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Puoi riprovare quando vuoi dalla pagina della fattura.
          </p>
          <div className="flex gap-2">
            {invoiceId && (
              <Button
                onClick={() => router.push(`/dashboard/invoices/${invoiceId}`)}
                className="flex-1"
              >
                Vai alla fattura
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/invoices')}
              className="flex-1"
            >
              Torna alle fatture
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

