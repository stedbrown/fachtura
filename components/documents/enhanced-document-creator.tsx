'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { logger } from '@/lib/logger'
import { DocumentWizard } from './document-wizard'
import { ClientInfoStep } from './steps/client-info-step'
import { ItemsStep, type ItemInput } from './steps/items-step'
import { NotesStep } from './steps/notes-step'
import { ActionsStep } from './steps/actions-step'
import type { Client, Product } from '@/lib/types/database'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { createClient } from '@/lib/supabase/client'
import { ClientDialog } from '@/components/clients/client-dialog'
import type { ClientInput } from '@/lib/validations/client'
import { safeAsync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { useSubscription } from '@/hooks/use-subscription'

interface EnhancedDocumentCreatorProps {
  type: 'invoice' | 'quote'
  clients: Client[]
  products: Product[]
  locale: string
  onSave: (data: DocumentData) => Promise<any>
  previewComponent?: React.ReactNode | ((data: DocumentData) => React.ReactNode)
  onCreateClient?: () => void
  onClientsChange?: (clients: Client[]) => void
}

interface DocumentData {
  clientId: string
  date: string
  dueDate?: string
  validUntil?: string
  status: string
  items: ItemInput[]
  notes: string
}

export function EnhancedDocumentCreator({
  type,
  clients,
  products,
  locale,
  onSave,
  previewComponent,
  onCreateClient,
  onClientsChange,
}: EnhancedDocumentCreatorProps) {
  const router = useRouter()
  const t = useTranslations(type === 'invoice' ? 'invoices' : 'quotes')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations(`${type === 'invoice' ? 'invoices' : 'quotes'}.status`)
  const tClients = useTranslations('clients')
  const tSubscription = useTranslations('subscription')
  const tErrors = useTranslations('errors')

  const { settings } = useCompanySettings()
  const { checkLimits } = useSubscription()
  
  const [clientId, setClientId] = React.useState('')
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = React.useState('')
  const [validUntil, setValidUntil] = React.useState('')
  const [status, setStatus] = React.useState('draft')
  const [items, setItems] = React.useState<ItemInput[]>([
    { id: `item-${Date.now()}`, description: '', quantity: 1, unit_price: 0, tax_rate: 8.1 },
  ])
  const [notes, setNotes] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [savedDocumentId, setSavedDocumentId] = React.useState<string | undefined>()
  const [savedDocumentNumber, setSavedDocumentNumber] = React.useState<string | undefined>()
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0)
  const [clientDialogOpen, setClientDialogOpen] = React.useState(false)
  const [isCreatingClient, setIsCreatingClient] = React.useState(false)

  // Handle client creation
  const handleCreateClient = React.useCallback(async () => {
    // Check subscription limits
    const limitsResult = await checkLimits('client')
    logger.debug('Client limits check', { limitsResult })

    if (!limitsResult.allowed) {
      toast.error(tSubscription('toast.limitReached'), {
        description: tSubscription('toast.limitReachedDescription', {
          max: limitsResult.max_count || 0,
          resource: tCommon('client'),
          plan: limitsResult.plan_name || 'Free',
        }),
        duration: 5000,
      })
      return
    }

    setClientDialogOpen(true)
  }, [checkLimits, tSubscription, tCommon])

  const handleClientSubmit = React.useCallback(async (data: ClientInput) => {
    setIsCreatingClient(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(tErrors('generic') || 'Utente non autenticato')
      }

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          ...data,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return newClient
    }, 'Error creating client')

    setIsCreatingClient(false)

    if (result.success && result.data) {
      const newClient = result.data as Client
      toast.success(tSubscription('toast.clientCreated'), {
        description: tSubscription('toast.clientCreatedDescription', { name: data.name }),
      })
      setClientDialogOpen(false)
      
      // Update clients list
      const updatedClients = [...clients, newClient].sort((a, b) => a.name.localeCompare(b.name))
      onClientsChange?.(updatedClients)
      
      // Select the new client
      setClientId(newClient.id)
    } else if (!result.success) {
      logger.error('Error creating client', result.details)
      toast.error(tCommon('error'), {
        description: getSupabaseErrorMessage(result.details) || tClients('createError') || tCommon('error'),
      })
    }
  }, [clients, onClientsChange, tSubscription, tCommon, tClients, tErrors])

  // Calculate default due date / valid until from company settings
  const getDefaultDays = React.useCallback(() => {
    if (!settings) return 30
    return type === 'invoice' 
      ? (settings.invoice_default_due_days || 30)
      : (settings.quote_default_validity_days || 30)
  }, [settings, type])

  // Load default notes from company settings
  React.useEffect(() => {
    if (settings && !notes) {
      const defaultNotes = type === 'invoice' 
        ? settings.invoice_default_notes 
        : settings.quote_default_notes
      if (defaultNotes) {
        setNotes(defaultNotes)
      }
    }
  }, [settings, type, notes])

  const statusOptions = React.useMemo(() => {
    if (type === 'invoice') {
      return ['draft', 'issued', 'paid', 'overdue'].map((s) => ({
        value: s,
        label: tStatus(s),
      }))
    } else {
      return ['draft', 'sent', 'accepted', 'rejected'].map((s) => ({
        value: s,
        label: tStatus(s),
      }))
    }
  }, [type, tStatus])

  const calculateLineTotal = React.useCallback((item: ItemInput) => {
    const subtotal = item.quantity * item.unit_price
    const tax = subtotal * (item.tax_rate / 100)
    return subtotal + tax
  }, [])

  // Validation
  const isStep1Valid = React.useMemo(() => {
    return !!clientId && !!date
  }, [clientId, date])

  const isStep2Valid = React.useMemo(() => {
    return (
      items.length > 0 &&
      items.every(
        (item) =>
          item.description?.trim() &&
          item.quantity > 0 &&
          item.unit_price > 0
      )
    )
  }, [items])

  const handleSaveDocument = React.useCallback(async () => {
    if (!isStep1Valid || !isStep2Valid) {
      toast.error('Compila tutti i campi obbligatori')
      return
    }

    if (isSaving || savedDocumentId) return // Already saving or saved

    setIsSaving(true)
    try {
      const result = await onSave({
        clientId,
        date,
        dueDate: type === 'invoice' ? dueDate : undefined,
        validUntil: type === 'quote' ? validUntil : undefined,
        status,
        items,
        notes,
      })
      
      // Store saved document info for actions step
      if (result && typeof result === 'object' && 'id' in result) {
        setSavedDocumentId(result.id as string)
        if ('invoice_number' in result) {
          setSavedDocumentNumber(result.invoice_number as string)
        } else if ('quote_number' in result) {
          setSavedDocumentNumber(result.quote_number as string)
        }
        setIsSaving(false)
        toast.success(type === 'invoice' ? 'Fattura creata con successo' : 'Preventivo creato con successo')
      } else {
        setIsSaving(false)
      }
    } catch (error: any) {
      toast.error(error?.message || tCommon('error'))
      setIsSaving(false)
    }
  }, [isStep1Valid, isStep2Valid, isSaving, savedDocumentId, clientId, date, dueDate, validUntil, status, items, notes, type, onSave, tCommon])

  // Auto-save when moving from Notes to Actions step
  React.useEffect(() => {
    // Actions step is always index 3 (client=0, items=1, notes=2, actions=3)
    const actionsStepIndex = 3
    
    // If we're moving to actions step and document not saved yet
    if (currentStepIndex === actionsStepIndex && !savedDocumentId) {
      // Check if form is valid
      if (isStep1Valid && isStep2Valid && !isSaving) {
        handleSaveDocument()
      }
    }
  }, [currentStepIndex, savedDocumentId, isStep1Valid, isStep2Valid, isSaving, handleSaveDocument])

  const handleComplete = async () => {
    // If we're on the actions step (index 3), navigate away
    if (currentStepIndex === 3) {
      router.push(`/${locale}/dashboard/${type === 'invoice' ? 'invoices' : 'quotes'}`)
      return
    }

    // Otherwise, save the document (shouldn't happen normally as auto-save handles it)
    await handleSaveDocument()
  }

  const steps = React.useMemo(
    () => [
      {
        id: 'client',
        label: 'Cliente',
        description: 'Seleziona cliente e date',
        component: (
          <ClientInfoStep
            clients={clients}
            selectedClientId={clientId}
            onClientChange={setClientId}
            date={date}
            onDateChange={setDate}
            dueDate={type === 'invoice' ? dueDate : undefined}
            onDueDateChange={type === 'invoice' ? setDueDate : undefined}
            validUntil={type === 'quote' ? validUntil : undefined}
            onValidUntilChange={type === 'quote' ? setValidUntil : undefined}
            status={status}
            onStatusChange={setStatus}
            statusOptions={statusOptions}
            type={type}
            onCreateClient={handleCreateClient}
            defaultDays={getDefaultDays()}
            t={t}
          />
        ),
        isValid: isStep1Valid,
      },
      {
        id: 'items',
        label: 'Articoli',
        description: 'Aggiungi prodotti e servizi',
        component: (
          <ItemsStep
            items={items}
            onItemsChange={setItems}
            products={products}
            calculateLineTotal={calculateLineTotal}
            t={t}
          />
        ),
        isValid: isStep2Valid,
      },
      {
        id: 'notes',
        label: 'Note',
        description: 'Aggiungi note opzionali',
        component: (
          <NotesStep
            notes={notes}
            onNotesChange={setNotes}
            placeholder={t('form.notesPlaceholder')}
            t={tCommon}
          />
        ),
        isValid: true,
      },
      {
        id: 'actions',
        label: 'Azioni',
        description: 'Condividi e gestisci',
        component: (
          <ActionsStep
            documentId={savedDocumentId}
            documentNumber={savedDocumentNumber}
            documentType={type}
            onDownload={() => {
              if (savedDocumentId) {
                window.open(`/${locale}/dashboard/${type === 'invoice' ? 'invoices' : 'quotes'}/${savedDocumentId}?download=true`, '_blank')
              }
            }}
            onEmail={() => {
              if (savedDocumentId) {
                window.open(`/${locale}/dashboard/${type === 'invoice' ? 'invoices' : 'quotes'}/${savedDocumentId}?email=true`, '_blank')
              }
            }}
            onView={() => {
              if (savedDocumentId) {
                router.push(`/${locale}/dashboard/${type === 'invoice' ? 'invoices' : 'quotes'}/${savedDocumentId}`)
              }
            }}
            locale={locale}
          />
        ),
        isValid: !!savedDocumentId,
      },
    ],
    [
      clients,
      clientId,
      date,
      dueDate,
      validUntil,
      status,
      statusOptions,
      type,
      onCreateClient,
      items,
      products,
      calculateLineTotal,
      notes,
      isStep1Valid,
      isStep2Valid,
      savedDocumentId,
      savedDocumentNumber,
      type,
      locale,
      router,
      t,
      tCommon,
    ]
  )

  const currentData: DocumentData = React.useMemo(() => {
    const data = {
      clientId,
      date,
      dueDate: type === 'invoice' ? dueDate : undefined,
      validUntil: type === 'quote' ? validUntil : undefined,
      status,
      items,
      notes,
    }
    
    // Dev logging
    if (process.env.NODE_ENV === 'development') {
      logger.debug('EnhancedDocumentCreator: currentData updated', {
        clientId,
        itemsCount: items.length,
        items: items.map(item => ({
          id: item.id,
          description: item.description?.substring(0, 30),
          quantity: item.quantity,
          unit_price: item.unit_price,
          product_id: item.product_id,
        })),
      })
    }
    
    return data
  }, [clientId, date, dueDate, validUntil, status, items, notes, type])

  // Show preview only when client is selected
  // Preview will update in real-time as user fills the form
  const shouldShowPreview = React.useMemo(() => {
    return !!(clientId && previewComponent)
  }, [clientId, previewComponent])

  return (
    <>
      <DocumentWizard
        steps={steps}
        onComplete={handleComplete}
        onCancel={() => router.push(`/${locale}/dashboard/${type === 'invoice' ? 'invoices' : 'quotes'}`)}
        showPreview={shouldShowPreview}
        previewComponent={previewComponent}
        previewData={currentData}
        className="h-screen flex flex-col"
        isSaving={isSaving}
        onStepChange={setCurrentStepIndex}
      />
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSubmit={handleClientSubmit}
        client={null}
        loading={isCreatingClient}
      />
    </>
  )
}

