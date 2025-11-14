'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import { Plus, Edit3, Trash2, Archive, ArchiveRestore, Truck, MoreHorizontal, Download, ChevronDown } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { AdvancedFilters } from '@/components/advanced-filters'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { Supplier } from '@/lib/types/database'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SupplierDialog } from '@/components/suppliers/supplier-dialog'
import type { SupplierInput } from '@/lib/validations/supplier'
import { exportFormattedToCSV, exportFormattedToExcel, formatDateForExport } from '@/lib/export-utils'
import { safeAsync, safeSync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { useRowSelection } from '@/hooks/use-row-selection'
import { TableCheckboxHeader, TableCheckboxCell } from '@/components/table/table-checkbox-column'
import { PaginationControls } from '@/components/table/pagination-controls'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function SuppliersPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('suppliers')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  
  const { subscription, checkLimits } = useSubscription()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

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
  const supplierColumns: ColumnConfig[] = [
    { key: 'name', label: t('fields.name'), visible: true },
    { key: 'contact', label: t('fields.contact'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'email', label: t('fields.email'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'phone', label: t('fields.phone'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    supplierColumns,
    'suppliers-table-columns'
  )

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    loadSuppliers(1)
  }, [showArchived])

  // Sorting
  const { sortedData: sortedSuppliers, sortKey, sortDirection, handleSort } = useSorting(
    suppliers,
    'name',
    'asc'
  )

  // Row selection
  const rowSelection = useRowSelection(sortedSuppliers)

  async function loadSuppliers(page: number = currentPage) {
    setLoading(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return { data: [] as Supplier[], count: 0 }
      }

      let query = supabase
        .from('suppliers')
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
        .order('name')
        .range(from, to)

      if (error) {
        throw error
      }

      return { 
        data: data ?? [],
        count: count ?? 0
      }
    }, 'Error loading suppliers')

    if (result.success) {
      setSuppliers(result.data.data)
      setTotalCount(result.data.count)
      setHasMore(result.data.data.length === pageSize)
      setCurrentPage(page)
    } else {
      logger.error('Error loading suppliers', result.details)
      toast.error(t('loadError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }

    setLoading(false)
  }

  async function handleCreate() {
    const limitsCheck = await checkLimits('supplier')
    if (!limitsCheck.allowed) {
      setUpgradeDialogParams({
        currentCount: limitsCheck.current_count || 0,
        maxCount: limitsCheck.max_count || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    setSelectedSupplier(null)
    setDialogOpen(true)
  }

  function handleEdit(supplier: Supplier) {
    setSelectedSupplier(supplier)
    setDialogOpen(true)
  }

  async function handleDialogSubmit(data: SupplierInput) {
    setDialogLoading(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(tCommon('error') || 'Utente non autenticato')
      }

      if (selectedSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update({
            name: data.name,
            contact_person: data.contact_person,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            postal_code: data.postal_code,
            country: data.country,
            vat_number: data.vat_number,
            website: data.website,
            payment_terms: data.payment_terms,
            notes: data.notes,
            is_active: data.is_active ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedSupplier.id)

        if (error) {
          throw error
        }
        return 'update' as const
      } else {
        const { error } = await supabase.from('suppliers').insert({
          user_id: user.id,
          name: data.name,
          contact_person: data.contact_person,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          postal_code: data.postal_code,
          country: data.country,
          vat_number: data.vat_number,
          website: data.website,
          payment_terms: data.payment_terms,
          notes: data.notes,
          is_active: data.is_active ?? true,
        })

        if (error) {
          throw error
        }
        return 'create' as const
      }
    }, selectedSupplier ? 'Error updating supplier' : 'Error creating supplier')

    setDialogLoading(false)

    if (result.success) {
      toast.success(
        result.data === 'update'
          ? t('updateSuccess') || 'Fornitore aggiornato con successo'
          : t('createSuccess') || 'Fornitore creato con successo'
      )
      setDialogOpen(false)
      setSelectedSupplier(null)
      loadSuppliers(currentPage)
    } else {
      logger.error('Error saving supplier', result.details, { supplierId: selectedSupplier?.id })
      toast.error(selectedSupplier ? t('updateError') || tCommon('error') : t('createError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  function confirmDelete(supplierId: string) {
    setSupplierToDelete(supplierId)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!supplierToDelete) return

    setIsDeleting(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('suppliers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', supplierToDelete)

      if (error) {
        throw error
      }
    }, 'Error archiving supplier')

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setSupplierToDelete(null)

    if (result.success) {
      toast.success(t('deleteSuccess') || 'Fornitore archiviato con successo')
      loadSuppliers(currentPage)
    } else {
      logger.error('Error archiving supplier', result.details, { supplierId: supplierToDelete })
      toast.error(t('deleteError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  async function handleRestore(supplierId: string) {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('suppliers')
        .update({ deleted_at: null })
        .eq('id', supplierId)

      if (error) {
        throw error
      }
    }, 'Error restoring supplier')

    if (result.success) {
      toast.success(t('restoreSuccess') || 'Fornitore ripristinato con successo')
      loadSuppliers(currentPage)
    } else {
      logger.error('Error restoring supplier', result.details, { supplierId })
      toast.error(t('restoreError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  async function handlePermanentDelete(supplierId: string) {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase.from('suppliers').delete().eq('id', supplierId)

      if (error) {
        throw error
      }
    }, 'Error permanently deleting supplier')

    if (result.success) {
      toast.success(t('permanentDeleteSuccess') || 'Fornitore eliminato definitivamente')
      loadSuppliers(currentPage)
    } else {
      logger.error('Error permanently deleting supplier', result.details, { supplierId })
      toast.error(t('permanentDeleteError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  function handleExport(formatType: 'csv' | 'excel') {
    const dataToExport = suppliers.map((supplier) => ({
      [t('name') || 'Nome']: supplier.name,
      [t('email') || 'Email']: supplier.email || '',
      [t('phone') || 'Telefono']: supplier.phone || '',
      [t('website') || 'Sito Web']: supplier.website || '',
      [t('vatNumber') || 'Partita IVA']: supplier.vat_number || '',
      [t('address') || 'Indirizzo']: supplier.address || '',
      [t('city') || 'Città']: supplier.city || '',
      [t('postalCode') || 'CAP']: supplier.postal_code || '',
      [t('country') || 'Paese']: supplier.country || '',
    }))

    const result = safeSync(() => {
      const filename = `fornitori-${new Date().toISOString().split('T')[0]}`
      if (formatType === 'csv') {
        exportFormattedToCSV(dataToExport, filename)
      } else {
        exportFormattedToExcel(dataToExport, filename)
      }
      return true
    }, 'Error exporting suppliers')

    if (result.success) {
      toast.success(tCommon('exportSuccess') || 'Esportazione completata')
    } else {
      logger.error('Error exporting suppliers', result.details)
      toast.error(tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  function handleRowClick(supplier: Supplier) {
    if (!showArchived) {
      router.push(`/${locale}/dashboard/suppliers/${supplier.id}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto lg:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('newSupplier')}
        </Button>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col gap-4">
            {/* Tabs and Column Toggle Row */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')} className="w-full lg:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="active" className="text-xs md:text-sm">
                    <Truck className="h-4 w-4 mr-2" />
                    {tTabs('active')}
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs md:text-sm">
                    <Archive className="h-4 w-4 mr-2" />
                    {tTabs('archived')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters and Column Toggle */}
              {!showArchived && (
                <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full lg:w-auto">
                  <AdvancedFilters
                    filters={{}}
                    onFiltersChange={() => {}}
                    onExport={handleExport}
                  />
                  <SimpleColumnToggle
                    columns={supplierColumns}
                    columnVisibility={columnVisibility}
                    onVisibilityChange={handleVisibilityChange}
                    label={tCommon('toggleColumns')}
                  />
                </div>
              )}
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
                  if (confirm(t('deleteSupplier') + ' ' + selectedIds.length + ' ' + tCommon('items') + '?')) {
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
          ) : sortedSuppliers.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Truck className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-base md:text-lg font-semibold mb-2">
                {showArchived ? t('noArchivedSuppliers') : t('noSuppliers')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {showArchived ? t('noArchivedDescription') : t('noSuppliersDescription')}
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
                      <TableHead className={getColumnClass('name', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.name')}
                          sortKey="name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('contact', 'hidden md:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.contact')}
                          sortKey="contact_person"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('email', 'hidden lg:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.email')}
                          sortKey="email"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('phone', 'hidden lg:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.phone')}
                          sortKey="phone"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('actions', 'text-right text-xs md:text-sm')}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSuppliers.map((supplier) => (
                      <TableRow 
                        key={supplier.id}
                        className="cursor-pointer hover:bg-muted/50"
                        data-state={rowSelection.selectedIds.has(supplier.id) ? 'selected' : undefined}
                        onClick={() => handleRowClick(supplier)}
                      >
                        <TableCheckboxCell
                          checked={rowSelection.selectedIds.has(supplier.id)}
                          onCheckedChange={() => rowSelection.toggleRow(supplier.id)}
                        />
                        <TableCell className={getColumnClass('name', 'font-medium text-xs md:text-sm')}>
                          {supplier.name}
                        </TableCell>
                        <TableCell className={getColumnClass('contact', 'hidden md:table-cell text-xs md:text-sm')}>{supplier.contact_person || '-'}</TableCell>
                        <TableCell className={getColumnClass('email', 'hidden lg:table-cell text-xs md:text-sm')}>{supplier.email || '-'}</TableCell>
                        <TableCell className={getColumnClass('phone', 'hidden lg:table-cell text-xs md:text-sm')}>{supplier.phone || '-'}</TableCell>
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
                            <DropdownMenuContent align="end" className="w-52">
                              {!showArchived ? (
                                <>
                                  <DropdownMenuItem onSelect={() => handleEdit(supplier)}>
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    {tCommon('edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => confirmDelete(supplier.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {tCommon('delete')}
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onSelect={() => handleRestore(supplier.id)}>
                                    <ArchiveRestore className="mr-2 h-4 w-4" />
                                    {t('restore')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => handlePermanentDelete(supplier.id)}
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
                onPageChange={(page) => loadSuppliers(page)}
                loading={loading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteTitle') || 'Elimina Fornitore'}
        description={t('deleteDescription') || 'Sei sicuro di voler archiviare questo fornitore?'}
        isDeleting={isDeleting}
      />

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="supplier"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />

      {/* Supplier Dialog */}
      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        supplier={selectedSupplier}
        loading={dialogLoading}
      />
    </div>
  )
}

