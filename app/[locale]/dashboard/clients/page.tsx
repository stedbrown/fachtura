'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { ClientDialog } from '@/components/clients/client-dialog'
import { ImportClientsDialog } from '@/components/clients/import-clients-dialog'
import { DeleteDialog } from '@/components/delete-dialog'
import { ClientFilters, type ClientFilterState } from '@/components/client-filters'
import { exportFormattedToCSV, exportFormattedToExcel } from '@/lib/export-utils'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import type { Client } from '@/lib/types/database'
import type { ClientInput } from '@/lib/validations/client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { toast } from 'sonner'

export default function ClientsPage() {
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  const tSubscription = useTranslations('subscription')
  const tErrors = useTranslations('errors')
  
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filters, setFilters] = useState<ClientFilterState>({})
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  
  const { subscription, checkLimits } = useSubscription()

  // Column visibility configuration
  const columns: ColumnConfig[] = [
    { id: 'name', label: t('fields.name'), defaultVisible: true },
    { id: 'email', label: t('fields.email'), defaultVisible: true },
    { id: 'phone', label: t('fields.phone'), defaultVisible: true },
    { id: 'city', label: t('fields.city'), defaultVisible: true },
    { id: 'actions', label: tCommon('actions'), defaultVisible: true },
  ]

  const { handleVisibilityChange, getColumnClass } = useColumnVisibility(
    columns,
    'clients-table-columns'
  )

  useEffect(() => {
    loadClients()
  }, [showArchived])

  const loadClients = async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    let query = supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)

    // Filter based on archived status
    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (data) {
      setClients(data)
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    // Verifica limiti prima di creare un nuovo cliente
    const limitsResult = await checkLimits('client')
    
    if (!limitsResult.allowed) {
      // Aggiorna i parametri per il dialog
      setUpgradeDialogParams({
        currentCount: limitsResult.current_count,
        maxCount: limitsResult.max_count || 0,
        planName: limitsResult.plan_name || 'Free'
      })
      setShowUpgradeDialog(true)
      // Mostra anche notifica
      const resourceLabel = tCommon('client')
      toast.error(tSubscription('toast.limitReached'), {
        description: tSubscription('toast.limitReachedDescription', { 
          max: limitsResult.max_count || 0,
          resource: resourceLabel,
          plan: limitsResult.plan_name || 'Free'
        }),
        duration: 5000,
      })
      return
    }
    
    // Avviso se si sta avvicinando al limite (80%)
    const currentCount = limitsResult.current_count
    const maxCount = limitsResult.max_count || 0
    if (maxCount > 0 && currentCount >= maxCount * 0.8 && currentCount < maxCount) {
      const resourceLabel = tSubscription('resources.client')
      toast.warning(tSubscription('toast.warning'), {
        description: tSubscription('toast.warningDescription', {
          current: currentCount,
          max: maxCount,
          resource: resourceLabel
        }),
        duration: 4000,
      })
    }
    
    setSelectedClient(null)
    setDialogOpen(true)
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setDialogOpen(true)
  }

  const confirmDelete = (clientId: string) => {
    setClientToDelete(clientId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!clientToDelete) return

    setIsDeleting(true)
    const supabase = createClient()

    // Soft delete: set deleted_at instead of deleting the record
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', clientToDelete)

    if (!error) {
      loadClients()
    } else {
      alert('Errore durante l\'eliminazione del cliente')
    }

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setClientToDelete(null)
  }

  const handleRestore = async (clientId: string) => {
    const supabase = createClient()

    // Restore: remove deleted_at
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: null })
      .eq('id', clientId)

    if (!error) {
      loadClients()
    } else {
      alert('Errore durante il ripristino del cliente')
    }
  }

  const handlePermanentDelete = async (clientId: string) => {
    if (!confirm(t('permanentDeleteWarning'))) {
      return
    }

    const supabase = createClient()

    // Permanently delete
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (!error) {
      loadClients()
    } else {
      alert('Errore durante l\'eliminazione definitiva del cliente')
    }
  }

  const handleSubmit = async (data: ClientInput) => {
    setSubmitting(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    try {
      if (selectedClient) {
        // Update existing client
        await supabase
          .from('clients')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedClient.id)
      } else {
        // Verifica limiti prima di creare
        const limitsResult = await checkLimits('client')
        console.log('[ClientsPage] Limits check result:', limitsResult) // 🔍 DEBUG
        
        if (!limitsResult.allowed) {
          console.log('[ClientsPage] Limit reached, showing upgrade dialog') // 🔍 DEBUG
          // Aggiorna i parametri per il dialog
          setUpgradeDialogParams({
            currentCount: limitsResult.current_count,
            maxCount: limitsResult.max_count || 0,
            planName: limitsResult.plan_name || 'Free'
          })
          setShowUpgradeDialog(true)
          setDialogOpen(false)
          const resourceLabel = tCommon('client')
          toast.error(tSubscription('toast.limitReached'), {
            description: tSubscription('toast.limitReachedDescription', { 
              max: limitsResult.max_count || 0,
              resource: resourceLabel,
              plan: limitsResult.plan_name || 'Free'
            }),
            duration: 5000,
          })
          return
        }
        
        // Create new client
        const { error: insertError } = await supabase.from('clients').insert({
          ...data,
          user_id: user.id,
        })
        
        if (insertError) {
          // Se il database trigger blocca l'inserimento
          console.error('Errore inserimento cliente:', insertError)
          // Aggiorna i parametri per il dialog
          setUpgradeDialogParams({
            currentCount: limitsResult.current_count,
            maxCount: limitsResult.max_count || 0,
            planName: limitsResult.plan_name || 'Free'
          })
          setShowUpgradeDialog(true)
          setDialogOpen(false)
          toast.error(tSubscription('toast.limitReached'), {
            description: tSubscription('toast.limitReachedDescription', { 
              max: limitsResult.max_count || 0,
              resource: tCommon('client'),
              plan: limitsResult.plan_name || 'Free'
            }),
            duration: 5000,
          })
          return
        }
        
        // Notifica di successo solo se inserimento ok
        toast.success(tSubscription('toast.clientCreated'), {
          description: tSubscription('toast.clientCreatedDescription', { name: data.name }),
        })
      }

      setDialogOpen(false)
      loadClients()
    } catch (error) {
      console.error('Errore durante il salvataggio del cliente:', error)
      toast.error(tCommon('error'), {
        description: tErrors('clientSaveError'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Filter clients based on active filters
  const filteredClients = useMemo(() => {
    let result = clients

    // Name filter
    if (filters.searchName) {
      result = result.filter((client) =>
        client.name.toLowerCase().includes(filters.searchName!.toLowerCase())
      )
    }

    // Email filter
    if (filters.searchEmail) {
      result = result.filter((client) =>
        client.email?.toLowerCase().includes(filters.searchEmail!.toLowerCase())
      )
    }

    // City filter
    if (filters.searchCity) {
      result = result.filter((client) =>
        client.city?.toLowerCase().includes(filters.searchCity!.toLowerCase())
      )
    }

    // Country filter
    if (filters.searchCountry) {
      result = result.filter((client) =>
        client.country?.toLowerCase().includes(filters.searchCountry!.toLowerCase())
      )
    }

    return result
  }, [clients, filters])

  // Export function
  const handleExport = (exportFormat: 'csv' | 'excel') => {
    const dataToExport = filteredClients.map((client) => ({
      [t('fields.name')]: client.name,
      [t('fields.email')]: client.email || '-',
      [t('fields.phone')]: client.phone || '-',
      [t('fields.address')]: client.address || '-',
      [t('fields.city')]: client.city || '-',
      [t('fields.postalCode')]: client.postal_code || '-',
      [t('fields.country')]: client.country || '-',
    }))

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `clients_${timestamp}`

    if (exportFormat === 'csv') {
      exportFormattedToCSV(dataToExport, filename)
    } else {
      exportFormattedToExcel(dataToExport, filename)
    }
  }

  const handleRowClick = (clientId: string) => {
    router.push(`/${locale}/dashboard/clients/${clientId}`)
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportClientsDialog onSuccess={loadClients} />
          <Button onClick={handleCreate} size="default" className="flex-1 sm:flex-initial">
            <Plus className="mr-2 h-4 w-4" />
            {t('newClient')}
          </Button>
        </div>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col gap-4">
            {/* Tabs and Filters Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')} className="w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="active" className="text-xs md:text-sm">
                    {tTabs('active')}
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs md:text-sm">
                    <Archive className="h-4 w-4 mr-2" />
                    {tTabs('archived')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters and Column Toggle */}
              <div className="flex gap-2">
                <ClientFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  onExport={handleExport}
                />
                <SimpleColumnToggle
                  columns={columns}
                  onVisibilityChange={handleVisibilityChange}
                  storageKey="clients-table-columns"
                  label={t('toggleColumns') || 'Mostra/Nascondi colonne'}
                />
              </div>
            </div>
          </div>

          <CardTitle className="mt-4 text-lg md:text-xl">
            {showArchived ? t('archivedTitle') : t('listTitle')}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {showArchived ? t('archivedDescription') : t('listDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {clients.length === 0 ? t('noClients') : tCommon('noResults')}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`text-xs md:text-sm ${getColumnClass('name')}`}>{t('fields.name')}</TableHead>
                      <TableHead className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('email')}`}>{t('fields.email')}</TableHead>
                      <TableHead className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('phone')}`}>{t('fields.phone')}</TableHead>
                      <TableHead className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('city')}`}>{t('fields.city')}</TableHead>
                      <TableHead className={`text-right text-xs md:text-sm ${getColumnClass('actions')}`}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {filteredClients.map((client) => (
                  <TableRow 
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(client.id)}
                  >
                    <TableCell className={`font-medium text-xs md:text-sm ${getColumnClass('name')}`}>
                      {client.name}
                    </TableCell>
                    <TableCell className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('email')}`}>{client.email || '-'}</TableCell>
                    <TableCell className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('phone')}`}>{client.phone || '-'}</TableCell>
                    <TableCell className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('city')}`}>{client.city || '-'}</TableCell>
                    <TableCell className={`text-right ${getColumnClass('actions')}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {!showArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(client)}
                              title={tCommon('edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(client.id)}
                              title={tCommon('delete')}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {showArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRestore(client.id)}
                              title={t('restore')}
                            >
                              <ArchiveRestore className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePermanentDelete(client.id)}
                              title={t('permanentDelete')}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        client={selectedClient}
        loading={submitting}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteClient')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="client"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />
    </div>
  )
}

