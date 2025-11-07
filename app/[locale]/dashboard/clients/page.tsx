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
  
  const { subscription, checkLimits } = useSubscription()

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
    const canCreate = await checkLimits('client')
    
    if (!canCreate) {
      setShowUpgradeDialog(true)
      // Mostra anche notifica
      toast.error('Limite raggiunto', {
        description: `Hai raggiunto il limite di ${subscription?.plan?.max_clients || 0} clienti del piano ${subscription?.plan?.name}.`,
        duration: 5000,
      })
      return
    }
    
    // Avviso se si sta avvicinando al limite (80%)
    const currentCount = clients.filter(c => !c.deleted_at).length
    const maxCount = subscription?.plan?.max_clients || 0
    if (maxCount > 0 && currentCount >= maxCount * 0.8 && currentCount < maxCount) {
      toast.warning('Attenzione', {
        description: `Hai usato ${currentCount} su ${maxCount} clienti disponibili. Considera un upgrade!`,
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
        const canCreate = await checkLimits('client')
        if (!canCreate) {
          setShowUpgradeDialog(true)
          setDialogOpen(false)
          toast.error('Limite raggiunto', {
            description: `Hai raggiunto il limite di ${subscription?.plan?.max_clients || 0} clienti del piano ${subscription?.plan?.name}.`,
            duration: 5000,
          })
          return
        }
        
        // Create new client
        await supabase.from('clients').insert({
          ...data,
          user_id: user.id,
        })
        
        // Notifica di successo
        toast.success('Cliente creato', {
          description: `${data.name} è stato aggiunto con successo.`,
        })
      }

      setDialogOpen(false)
      loadClients()
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportClientsDialog onSuccess={loadClients} />
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newClient')}
          </Button>
        </div>
      </div>

      <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')}>
        <TabsList>
          <TabsTrigger value="active">{tTabs('active')}</TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="mr-2 h-4 w-4" />
            {tTabs('archived')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters and Export */}
      <ClientFilters
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
      />

      <Card>
        <CardHeader>
          <CardTitle>{showArchived ? t('archivedTitle') : t('listTitle')}</CardTitle>
          <CardDescription>
            {showArchived ? t('archivedDescription') : t('listDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">
              {tCommon('loading')}
            </p>
          ) : filteredClients.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {clients.length === 0 ? t('noClients') : tCommon('noResults')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.name')}</TableHead>
                  <TableHead>{t('fields.email')}</TableHead>
                  <TableHead>{t('fields.phone')}</TableHead>
                  <TableHead>{t('fields.city')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow 
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(client.id)}
                  >
                    <TableCell className="font-medium">
                      {client.name}
                    </TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>{client.city || '-'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
        currentCount={clients.filter(c => !c.deleted_at).length}
        maxCount={subscription?.plan?.max_clients || 0}
        planName={subscription?.plan?.name || 'Free'}
      />
    </div>
  )
}

