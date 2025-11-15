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
import { Plus, Edit3, Trash2, Archive, ArchiveRestore, Users, MoreHorizontal } from 'lucide-react'
import { ClientDialog } from '@/components/clients/client-dialog'
import { ImportClientsDialog } from '@/components/clients/import-clients-dialog'
import { DeleteDialog } from '@/components/delete-dialog'
import { ClientFilters, type ClientFilterState } from '@/components/client-filters'
import { exportFormattedToCSV, exportFormattedToExcel } from '@/lib/export-utils'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { Client } from '@/lib/types/database'
import type { ClientInput } from '@/lib/validations/client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logger } from '@/lib/logger'
import { safeAsync, safeSync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { useRowSelection } from '@/hooks/use-row-selection'
import { TableCheckboxHeader, TableCheckboxCell } from '@/components/table/table-checkbox-column'
import { PaginationControls } from '@/components/table/pagination-controls'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [clientToPermanentDelete, setClientToPermanentDelete] = useState<string | null>(null)
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false)
  const [filters, setFilters] = useState<ClientFilterState>({})
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  
  const { subscription, checkLimits } = useSubscription()

  const extractErrorMessage = (fallback: string, details?: unknown) => {
    if (
      details &&
      typeof details === 'object' &&
      'message' in details &&
      typeof (details as { message?: unknown }).message === 'string'
    ) {
      return (details as { message: string }).message
    }
    return fallback
  }

  // Column visibility configuration
  const columns: ColumnConfig[] = [
    { key: 'name', label: t('fields.name'), visible: true },
    { key: 'email', label: t('fields.email'), visible: true },
    { key: 'phone', label: t('fields.phone'), visible: true },
    { key: 'city', label: t('fields.city'), visible: true },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, handleVisibilityChange, getColumnClass } = useColumnVisibility(
    columns,
    'clients-table-columns'
  )

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    loadClients(1)
  }, [showArchived])

  const loadClients = async (page: number = currentPage) => {
    setLoading(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return { data: [] as Client[], count: 0 }
      }

      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        throw error
      }

      return { 
        data: data ?? [],
        count: count ?? 0
      }
    }, 'Error loading clients')

    if (result.success) {
      setClients(result.data.data)
      setTotalCount(result.data.count)
      setHasMore(result.data.data.length === pageSize)
      setCurrentPage(page)
    } else {
      logger.error('Error loading clients', result.details)
      toast.error(t('loadError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
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

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', clientToDelete)

      if (error) {
        throw error
      }
    }, 'Error deleting client')

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setClientToDelete(null)

    if (result.success) {
      toast.success(t('deleteSuccess') || tCommon('success'))
      loadClients()
    } else {
      logger.error('Error deleting client', result.details, { clientId: clientToDelete })
      toast.error(t('deleteError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  const handleRestore = async (clientId: string) => {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: null })
        .eq('id', clientId)

      if (error) {
        throw error
      }
    }, 'Error restoring client')

    if (result.success) {
      toast.success(t('restoreSuccess') || tCommon('success'))
      loadClients()
    } else {
      logger.error('Error restoring client', result.details, { clientId })
      toast.error(t('restoreError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  const confirmPermanentDelete = (clientId: string) => {
    setClientToPermanentDelete(clientId)
    setPermanentDeleteDialogOpen(true)
  }

  const handlePermanentDelete = async () => {
    if (!clientToPermanentDelete) return

    setIsPermanentlyDeleting(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase.from('clients').delete().eq('id', clientToPermanentDelete)

      if (error) {
        throw error
      }
    }, 'Error permanently deleting client')

    setIsPermanentlyDeleting(false)
    setPermanentDeleteDialogOpen(false)
    setClientToPermanentDelete(null)

    if (result.success) {
      toast.success(t('permanentDeleteSuccess') || tCommon('success'))
      loadClients()
    } else {
      logger.error('Error permanently deleting client', result.details, { clientId: clientToPermanentDelete })
      toast.error(t('permanentDeleteError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  const handleSubmit = async (data: ClientInput) => {
    setSubmitting(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSubmitting(false)
      toast.error(tErrors('generic'))
      return
    }

    if (!selectedClient) {
      const limitsResult = await checkLimits('client')
      logger.debug('Client limits check', { limitsResult })

      if (!limitsResult.allowed) {
        setUpgradeDialogParams({
          currentCount: limitsResult.current_count,
          maxCount: limitsResult.max_count || 0,
          planName: limitsResult.plan_name || 'Free',
        })
        setShowUpgradeDialog(true)
        setDialogOpen(false)
        const resourceLabel = tCommon('client')
        toast.error(tSubscription('toast.limitReached'), {
          description: tSubscription('toast.limitReachedDescription', {
            max: limitsResult.max_count || 0,
            resource: resourceLabel,
            plan: limitsResult.plan_name || 'Free',
          }),
          duration: 5000,
        })
        setSubmitting(false)
        return
      }
    }

    const result = await safeAsync(async () => {
      if (selectedClient) {
        const { error } = await supabase
          .from('clients')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedClient.id)

        if (error) {
          throw error
        }
        return 'update' as const
      }

      const { error } = await supabase.from('clients').insert({
        ...data,
        user_id: user.id,
      })

      if (error) {
        throw error
      }

      return 'create' as const
    }, selectedClient ? 'Error updating client' : 'Error creating client')

    setSubmitting(false)

    if (result.success) {
      if (result.data === 'create') {
        toast.success(tSubscription('toast.clientCreated'), {
          description: tSubscription('toast.clientCreatedDescription', { name: data.name }),
        })
      }
      setDialogOpen(false)
      setSelectedClient(null)
      loadClients()
    } else {
      logger.error('Error saving client', result.details, { clientId: selectedClient?.id })
      toast.error(tCommon('error'), {
        description:
          getSupabaseErrorMessage(result.details) ||
          extractErrorMessage(result.error, result.details) ||
          tErrors('clientSaveError'),
      })
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

  // Sorting
  const { sortedData: sortedClients, sortKey, sortDirection, handleSort } = useSorting(
    filteredClients,
    'name', // default sort by name
    'asc'
  )

  // Row selection
  const rowSelection = useRowSelection(sortedClients)

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

    const result = safeSync(() => {
      if (exportFormat === 'csv') {
        exportFormattedToCSV(dataToExport, filename)
      } else {
        exportFormattedToExcel(dataToExport, filename)
      }
      return true
    }, 'Error exporting clients')

    if (!result.success) {
      logger.error('Error exporting clients', result.details)
      toast.error(tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  const handleRowClick = (clientId: string) => {
    router.push(`/${locale}/dashboard/clients/${clientId}`)
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full lg:w-auto">
          <ImportClientsDialog onSuccess={loadClients} className="w-full sm:w-auto" />
          <Button onClick={handleCreate} size="default" className="w-full sm:w-auto">
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')} className="w-full lg:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="active" className="text-xs md:text-sm">
                    <Users className="h-4 w-4 mr-2" />
                    {tTabs('active')}
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs md:text-sm">
                    <Archive className="h-4 w-4 mr-2" />
                    {tTabs('archived')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters and Column Toggle */}
              <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full lg:w-auto">
                <ClientFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  onExport={handleExport}
                />
                <SimpleColumnToggle
                  columns={columns}
                  columnVisibility={columnVisibility}
                  onVisibilityChange={handleVisibilityChange}
                  label={tCommon('toggleColumns')}
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
        {rowSelection.hasSelection && !showArchived && (
          <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {rowSelection.selectedCount} {rowSelection.selectedCount === 1 ? tCommon('item') : tCommon('items')} {tCommon('selected')}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedIds = Array.from(rowSelection.selectedIds)
                  if (confirm(t('deleteClient') + ' ' + selectedIds.length + ' ' + tCommon('items') + '?')) {
                    selectedIds.forEach((id) => {
                      confirmDelete(id)
                    })
                  }
                  rowSelection.clearSelection()
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tCommon('delete')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={rowSelection.clearSelection}
              >
                {tCommon('clear')}
              </Button>
            </div>
          </div>
        )}
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Users className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-base md:text-lg font-semibold mb-2">
                {showArchived ? t('noArchivedClients') : t('noClients')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {showArchived ? t('noArchivedDescription') : t('noClientsDescription')}
              </p>
              {!showArchived && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createFirst')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCheckboxHeader
                        checked={rowSelection.isAllSelected}
                        indeterminate={rowSelection.isIndeterminate}
                        onCheckedChange={rowSelection.toggleAll}
                      />
                      <TableHead className={getColumnClass('name')}>
                        <SortableHeader
                          label={t('fields.name')}
                          sortKey="name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('email', 'hidden md:table-cell')}>
                        <SortableHeader
                          label={t('fields.email')}
                          sortKey="email"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('phone', 'hidden lg:table-cell')}>
                        <SortableHeader
                          label={t('fields.phone')}
                          sortKey="phone"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('city', 'hidden md:table-cell')}>
                        <SortableHeader
                          label={t('fields.city')}
                          sortKey="city"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('actions', 'text-right')}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {sortedClients.map((client) => (
                  <TableRow 
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-state={rowSelection.selectedIds.has(client.id) ? 'selected' : undefined}
                    onClick={() => handleRowClick(client.id)}
                  >
                    <TableCheckboxCell
                      checked={rowSelection.selectedIds.has(client.id)}
                      onCheckedChange={() => rowSelection.toggleRow(client.id)}
                    />
                    <TableCell className={getColumnClass('name', 'font-medium text-xs md:text-sm')}>
                      {client.name}
                    </TableCell>
                    <TableCell className={getColumnClass('email', 'hidden md:table-cell text-xs md:text-sm')}>{client.email || '-'}</TableCell>
                    <TableCell className={getColumnClass('phone', 'hidden lg:table-cell text-xs md:text-sm')}>{client.phone || '-'}</TableCell>
                    <TableCell className={getColumnClass('city', 'hidden md:table-cell text-xs md:text-sm')}>{client.city || '-'}</TableCell>
                    <TableCell className={getColumnClass('actions', 'text-right')} onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 data-[state=open]:bg-muted"
                            aria-label={tCommon('actions')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {!showArchived ? (
                            <>
                              <DropdownMenuItem onSelect={() => handleEdit(client)}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                {tCommon('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => confirmDelete(client.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {tCommon('delete')}
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => handleRestore(client.id)}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                {t('restore')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => confirmPermanentDelete(client.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('permanentDelete')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination Controls */}
              <PaginationControls
                page={currentPage}
                pageSize={pageSize}
                hasMore={hasMore}
                totalCount={totalCount}
                onPageChange={(page) => loadClients(page)}
                loading={loading}
              />
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

      <DeleteDialog
        open={permanentDeleteDialogOpen}
        onOpenChange={setPermanentDeleteDialogOpen}
        onConfirm={handlePermanentDelete}
        title={t('permanentDelete')}
        description={t('permanentDeleteWarning')}
        isDeleting={isPermanentlyDeleting}
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

