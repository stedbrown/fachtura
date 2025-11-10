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
import { Plus, Edit3, Trash2, Archive, ArchiveRestore, ShoppingCart, Download } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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
    loadOrders()
  }, [showArchived])

  // Sorting
  const { sortedData: sortedOrders, sortKey, sortDirection, handleSort } = useSorting(
    orders,
    'order_number',
    'desc'
  )

  async function loadOrders() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push(`/${locale}/auth/login`)
      return
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading orders:', error)
      toast.error(t('loadError') || 'Errore nel caricamento degli ordini')
    } else {
      setOrders(data || [])
    }
    setLoading(false)
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
    const supabase = createClient()
    
    const { error } = await supabase
      .from('orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deleting order:', error)
      toast.error(t('deleteError') || 'Errore nell\'eliminazione dell\'ordine')
    } else {
      toast.success(t('deleteSuccess') || 'Ordine eliminato con successo')
      loadOrders()
    }
    
    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setOrderToDelete(null)
  }

  async function handleRestore(id: string) {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('orders')
      .update({ deleted_at: null })
      .eq('id', id)

    if (error) {
      console.error('Error restoring order:', error)
      toast.error(t('restoreError') || 'Errore nel ripristino dell\'ordine')
    } else {
      toast.success(t('restoreSuccess') || 'Ordine ripristinato con successo')
      loadOrders()
    }
  }

  function handleExport(format: 'csv' | 'excel') {
    const dataToExport = orders.map(order => ({
      [t('orderNumber') || 'Numero Ordine']: order.order_number,
      [t('supplier') || 'Fornitore']: order.supplier?.name || '',
      [t('orderDate') || 'Data']: formatDateForExport(order.date),
      [t('deliveryDate') || 'Consegna']: order.expected_delivery_date ? formatDateForExport(order.expected_delivery_date) : '',
      [t('status') || 'Stato']: tStatus(order.status) || order.status,
      [t('totalAmount') || 'Totale']: formatCurrencyForExport(order.total),
    }))

    const filename = `ordini_${new Date().toISOString().split('T')[0]}`

    if (format === 'csv') {
      exportFormattedToCSV(dataToExport, filename)
    } else {
      exportFormattedToExcel(dataToExport, filename)
    }

    toast.success(tCommon('exportSuccess') || 'Export completato con successo')
  }


  const dateLocale = localeMap[locale] || it

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        <Button onClick={handleAddNew} size="default" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('addNew')}
        </Button>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col gap-4">
            {/* Tabs and Export Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(v) => setShowArchived(v === 'archived')} className="w-full sm:w-auto">
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

              {/* Column Toggle and Export Buttons */}
              {!showArchived && orders.length > 0 && (
                <div className="flex gap-2">
                  <SimpleColumnToggle
                    columns={orderColumns}
                    columnVisibility={columnVisibility}
                    onVisibilityChange={handleVisibilityChange}
                    label={t('toggleColumns') || tCommon('toggleColumns') || 'Colonne'}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="flex-1 sm:flex-none">
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">CSV</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="flex-1 sm:flex-none">
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Excel</span>
                  </Button>
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
                      <TableRow key={order.id}>
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
                        <TableCell className={getColumnClass('actions', 'text-right')}>
                          <div className="flex items-center justify-end gap-2">
                            {showArchived ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestore(order.id)}
                                title={t('restore')}
                              >
                                <ArchiveRestore className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => router.push(`/${locale}/dashboard/orders/${order.id}`)}
                                  title={t('edit')}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setOrderToDelete(order.id)
                                    setDeleteDialogOpen(true)
                                  }}
                                  title={t('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
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

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => orderToDelete && handleDelete(orderToDelete)}
        title={t('deleteDialogTitle')}
        description={t('deleteDialogDescription')}
        isDeleting={isDeleting}
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
