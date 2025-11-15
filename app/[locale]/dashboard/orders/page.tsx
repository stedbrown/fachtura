'use client'

import { useEffect, useState, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Archive, ArchiveRestore, ShoppingCart, Download, MoreHorizontal, ChevronDown } from 'lucide-react'
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { AdvancedFilters } from '@/components/advanced-filters'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { OrderWithSupplier } from '@/lib/types/database'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportFormattedToCSV, exportFormattedToExcel, formatDateForExport, formatCurrencyForExport } from '@/lib/export-utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logger } from '@/lib/logger'
import { safeAsync, safeSync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { useRowSelection } from '@/hooks/use-row-selection'
import { TableCheckboxHeader, TableCheckboxCell } from '@/components/table/table-checkbox-column'
import { PaginationControls } from '@/components/table/pagination-controls'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

function getOrderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'received':
      return 'default' // Green
    case 'ordered':
    case 'partial':
      return 'outline' // Blue
    case 'cancelled':
      return 'destructive' // Red
    default:
      return 'secondary' // Gray for draft
  }
}

export default function OrdersPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('orders')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  const tStatus = useTranslations('orders.status')
  
  const { subscription, checkLimits } = useSubscription()
  const [orders, setOrders] = useState<OrderWithSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [orderToPermanentDelete, setOrderToPermanentDelete] = useState<string | null>(null)
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })

  // Column visibility configuration
  const orderColumns: ColumnConfig[] = [
    { key: 'order_number', label: t('orderNumber'), visible: true },
    { key: 'supplier', label: t('supplier'), visible: true },
    { key: 'date', label: t('orderDate'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'delivery_date', label: t('deliveryDate'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'status', label: tCommon('status'), visible: true },
    { key: 'total', label: t('totalAmount'), visible: true },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    orderColumns,
    'orders-table-columns'
  )

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    loadOrders(1)
  }, [showArchived])

  // Sorting
  const { sortedData: sortedOrders, sortKey, sortDirection, handleSort } = useSorting(
    orders,
    'order_number',
    'desc'
  )

  // Row selection
  const rowSelection = useRowSelection(sortedOrders)

  async function loadOrders(page: number = currentPage) {
    setLoading(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return { data: [] as OrderWithSupplier[], count: 0 }
      }

      let query = supabase
        .from('orders')
        .select(`
          *,
          supplier:suppliers(*)
        `, { count: 'exact' })
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
        data: (data ?? []) as OrderWithSupplier[],
        count: count ?? 0
      }
    }, 'Error loading orders')

    if (result.success) {
      setOrders(result.data.data)
      setTotalCount(result.data.count)
      setHasMore(result.data.data.length === pageSize)
      setCurrentPage(page)
    } else {
      logger.error('Error loading orders', result.details)
      toast.error(t('loadError') || tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }

    setLoading(false)
  }

  const handleRowClick = (orderId: string) => {
    router.push(`/${locale}/dashboard/orders/${orderId}`)
  }

  async function handleAddNew() {
    const limitsCheck = await checkLimits('order')
    if (!limitsCheck.allowed) {
      setUpgradeDialogParams({
        currentCount: limitsCheck.current_count || 0,
        maxCount: limitsCheck.max_count || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    router.push(`/${locale}/dashboard/orders/new`)
  }

  async function handleDelete(id: string) {
    setIsDeleting(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        throw error
      }
    }, 'Error deleting order')

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setOrderToDelete(null)

    if (result.success) {
      toast.success(t('deleteSuccess') || 'Ordine eliminato con successo')
      loadOrders(currentPage)
    } else {
      logger.error('Error deleting order', result.details)
      toast.error(t('deleteError') || tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  async function handleRestore(id: string) {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('orders')
        .update({ deleted_at: null })
        .eq('id', id)

      if (error) {
        throw error
      }
    }, 'Error restoring order')

    if (result.success) {
      toast.success(t('restoreSuccess') || 'Ordine ripristinato con successo')
      loadOrders(currentPage)
    } else {
      logger.error('Error restoring order', result.details)
      toast.error(t('restoreError') || tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  const confirmPermanentDelete = (orderId: string) => {
    setOrderToPermanentDelete(orderId)
    setPermanentDeleteDialogOpen(true)
  }

  const handlePermanentDelete = async () => {
    if (!orderToPermanentDelete) return

    setIsPermanentlyDeleting(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToPermanentDelete)

      if (error) {
        throw error
      }
    }, 'Error permanently deleting order')

    setIsPermanentlyDeleting(false)
    setPermanentDeleteDialogOpen(false)
    setOrderToPermanentDelete(null)

    if (result.success) {
      toast.success(t('permanentDeleteSuccess') || tCommon('success'))
      loadOrders(currentPage)
    } else {
      logger.error('Error permanently deleting order', result.details)
      toast.error(t('permanentDeleteError') || tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  function handleExport(format: 'csv' | 'excel') {
    const dataToExport = orders.map((order) => ({
      [t('orderNumber') || 'Numero Ordine']: order.order_number,
      [t('supplier') || 'Fornitore']: order.supplier?.name || '',
      [t('orderDate') || 'Data']: formatDateForExport(order.date),
      [t('deliveryDate') || 'Consegna']: order.expected_delivery_date
        ? formatDateForExport(order.expected_delivery_date)
        : '',
      [tCommon('status') || 'Stato']: tStatus(order.status) || order.status,
      [t('totalAmount') || 'Totale']: formatCurrencyForExport(order.total),
    }))

    const filename = `ordini_${new Date().toISOString().split('T')[0]}`

    const result = safeSync(() => {
      if (format === 'csv') {
        exportFormattedToCSV(dataToExport, filename)
      } else {
        exportFormattedToExcel(dataToExport, filename)
      }
      return true
    }, 'Error exporting orders')

    if (result.success) {
      toast.success(tCommon('exportSuccess') || 'Export completato con successo')
    } else {
      logger.error('Error exporting orders', result.details)
      toast.error(tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }


  const dateLocale = localeMap[locale] || it

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('moduleDescription')}
          </p>
        </div>
        <Button onClick={handleAddNew} size="default" className="w-full sm:w-auto lg:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('addNew')}
        </Button>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col gap-4">
            {/* Tabs and Export Row */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(v) => setShowArchived(v === 'archived')} className="w-full lg:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="active" className="text-xs md:text-sm">
                    <ShoppingCart className="h-4 w-4 mr-2" />
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
                    columns={orderColumns}
                    columnVisibility={columnVisibility}
                    onVisibilityChange={handleVisibilityChange}
                    label={tCommon('toggleColumns')}
                  />
                </div>
              )}
            </div>
          </div>

          <CardTitle className="mt-4 text-lg md:text-xl">
            {showArchived ? t('archivedOrders') : t('yourOrders')}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {showArchived ? t('archivedDescription') : t('tableDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <ShoppingCart className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-base md:text-lg font-semibold mb-2">
                {showArchived ? t('noArchivedOrders') : t('noOrders')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {showArchived ? t('noArchivedDescription') : t('noOrdersDescription')}
              </p>
              {!showArchived && (
                <Button onClick={handleAddNew}>
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
                      <TableHead className={getColumnClass('order_number', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('orderNumber')}
                          sortKey="order_number"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('supplier', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('supplier')}
                          sortKey="supplier.name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('date', 'hidden md:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('orderDate')}
                          sortKey="date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('delivery_date', 'hidden lg:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('deliveryDate')}
                          sortKey="expected_delivery_date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('status', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={tCommon('status')}
                          sortKey="status"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('total', 'text-right text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('totalAmount')}
                          sortKey="total"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          align="right"
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('actions', 'text-right text-xs md:text-sm')}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        data-state={rowSelection.selectedIds.has(order.id) ? 'selected' : undefined}
                        onClick={() => handleRowClick(order.id)}
                      >
                        <TableCheckboxCell
                          checked={rowSelection.selectedIds.has(order.id)}
                          onCheckedChange={() => rowSelection.toggleRow(order.id)}
                        />
                        <TableCell className={getColumnClass('order_number', 'font-medium text-xs md:text-sm')}>{order.order_number}</TableCell>
                        <TableCell className={getColumnClass('supplier', 'text-xs md:text-sm')}>{order.supplier?.name || '-'}</TableCell>
                        <TableCell className={getColumnClass('date', 'hidden md:table-cell text-xs md:text-sm')}>
                          {format(new Date(order.date), 'dd MMM yyyy', { locale: dateLocale })}
                        </TableCell>
                        <TableCell className={getColumnClass('delivery_date', 'hidden lg:table-cell text-xs md:text-sm')}>
                          {order.expected_delivery_date 
                            ? format(new Date(order.expected_delivery_date), 'dd MMM yyyy', { locale: dateLocale })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className={getColumnClass('status', 'text-xs md:text-sm')}>
                          <Badge variant={getOrderStatusVariant(order.status)} className="text-xs">
                            {tStatus(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className={getColumnClass('total', 'text-right font-medium text-xs md:text-sm tabular-nums')}>
                          CHF {Number(order.total).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell
                          className={getColumnClass('actions', 'text-right')}
                          onClick={(e) => e.stopPropagation()}
                        >
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
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setOrderToDelete(order.id)
                                    setDeleteDialogOpen(true)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('delete')}
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onSelect={() => handleRestore(order.id)}>
                                    <ArchiveRestore className="mr-2 h-4 w-4" />
                                    {t('restore')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => confirmPermanentDelete(order.id)}
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
                onPageChange={(page) => loadOrders(page)}
                loading={loading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => orderToDelete && handleDelete(orderToDelete)}
        title={t('deleteDialogTitle')}
        description={t('deleteDialogDescription')}
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

      {/* Upgrade Dialog */}
      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="order"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />
    </div>
  )
}
