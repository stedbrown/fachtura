'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface ClientImportData {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  postal_code?: string
  country?: string
}

interface PreviewClient extends ClientImportData {
  isValid: boolean
  errors: string[]
}

export function ImportClientsDialog({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewClient[]>([])
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview'>('upload')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Formato non supportato. Usa solo file CSV')
      return
    }

    setFile(selectedFile)
    parseCSV(selectedFile)
  }

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[]
        
        // Map and validate data
        const mapped: PreviewClient[] = data.map((row) => {
          const client: ClientImportData = {
            name: row.name || row.Name || row.Nome || '',
            email: row.email || row.Email || '',
            phone: row.phone || row.Phone || row.Telefono || '',
            address: row.address || row.Address || row.Indirizzo || '',
            city: row.city || row.City || row.Città || '',
            postal_code: row.postal_code || row['Postal Code'] || row.CAP || '',
            country: row.country || row.Country || row.Paese || 'Switzerland',
          }

          // Validate
          const errors: string[] = []
          if (!client.name || client.name.trim() === '') {
            errors.push('Nome richiesto')
          }

          return {
            ...client,
            isValid: errors.length === 0,
            errors,
          }
        })

        setPreviewData(mapped)
        setStep('preview')
      },
      error: (error) => {
        toast.error(`Errore nel parsing del file: ${error.message}`)
      },
    })
  }

  const handleImport = async () => {
    setImporting(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error(t('import.notAuthenticated'))
        return
      }

      // Import only valid clients
      const validClients = previewData.filter((c) => c.isValid)
      
      // Verifica limiti per l'import multiplo
      const response = await fetch('/api/subscription/check-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType: 'client' }),
      })
      
      const limitCheck = await response.json()
      
      if (!limitCheck.can_create) {
        toast.error(t('import.limitReached', { 
          remaining: limitCheck.remaining, 
          plan: limitCheck.plan_name 
        }))
        return
      }
      
      // Verifica se si sta tentando di importare più clienti del limite rimanente
      if (validClients.length > limitCheck.remaining) {
        toast.error(t('import.tooMany', { 
          remaining: limitCheck.remaining, 
          excess: validClients.length - limitCheck.remaining 
        }))
        return
      }
      
      const clientsToInsert = validClients.map((client) => ({
        user_id: user.id,
        name: client.name,
        email: client.email || null,
        phone: client.phone || null,
        address: client.address || null,
        city: client.city || null,
        postal_code: client.postal_code || null,
        country: client.country || 'Switzerland',
      }))

      const { error } = await supabase
        .from('clients')
        .insert(clientsToInsert)

      if (error) {
        toast.error(t('import.error', { error: error.message }))
        return
      }

      toast.success(t('import.success', { count: validClients.length }))
      setOpen(false)
      resetDialog()
      onSuccess?.()
    } catch (err) {
      toast.error(t('import.error', { error: String(err) }))
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  const resetDialog = () => {
    setFile(null)
    setPreviewData([])
    setStep('upload')
  }

  const downloadTemplate = () => {
    const csvContent = 'name,email,phone,address,city,postal_code,country\nMario Rossi,mario@example.com,+41791234567,Via Roma 1,Lugano,6900,Switzerland\nLucia Bianchi,lucia@example.com,+41797654321,Via Milano 5,Bellinzona,6500,Switzerland'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_clienti.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const validCount = previewData.filter((c) => c.isValid).length
  const invalidCount = previewData.filter((c) => !c.isValid).length

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetDialog()
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importa Clienti
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa Clienti da CSV</DialogTitle>
          <DialogDescription>
            Carica un file CSV con i dati dei tuoi clienti per importarli velocemente
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Il file CSV deve contenere almeno la colonna <strong>name</strong>. 
                Colonne supportate: name, email, phone, address, city, postal_code, country
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button variant="secondary" asChild>
                    <span>Seleziona File CSV</span>
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {file && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    File selezionato: <strong>{file.name}</strong>
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full gap-2"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4" />
              Scarica Template CSV
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{validCount} validi</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium">{invalidCount} con errori</span>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('upload')}
              >
                Cambia File
              </Button>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Telefono</th>
                    <th className="p-2 text-left">Città</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((client, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        {client.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td className="p-2">
                        {client.name || (
                          <span className="text-red-500">Mancante</span>
                        )}
                      </td>
                      <td className="p-2">{client.email || '-'}</td>
                      <td className="p-2">{client.phone || '-'}</td>
                      <td className="p-2">{client.city || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {invalidCount} clienti hanno errori e verranno saltati durante l'import.
                  Solo i clienti validi verranno importati.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={resetDialog}
                disabled={importing}
              >
                Annulla
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importazione...
                  </>
                ) : (
                  `Importa ${validCount} Clienti`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

