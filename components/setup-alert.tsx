'use client'

import { AlertCircle, Settings } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useRouter, useParams } from 'next/navigation'
import { useCompanySettings } from '@/hooks/use-company-settings'

export function SetupAlert() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { hasRequiredFields, isLoading } = useCompanySettings()

  // Don't show alert if loading or settings are complete
  if (isLoading || hasRequiredFields) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Configurazione Richiesta</AlertTitle>
      <AlertDescription className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="mb-2">
            Per generare fatture con QR Code svizzero, devi configurare i dati aziendali nelle impostazioni.
          </p>
          <p className="text-sm font-medium">
            Campi richiesti: Nome Azienda, Indirizzo, Città, CAP, Paese, IBAN
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 bg-background hover:bg-accent"
          onClick={() => router.push(`/${locale}/dashboard/settings`)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Vai alle Impostazioni
        </Button>
      </AlertDescription>
    </Alert>
  )
}

