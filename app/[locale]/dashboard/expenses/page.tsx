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
import { Plus, Edit3, Trash2, Archive, ArchiveRestore, Wallet, MoreHorizontal } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { AdvancedFilters, type FilterState } from '@/components/advanced-filters'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { ExpenseWithSupplier } from '@/lib/types/database'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportFormattedToCSV, exportFormattedToExcel, formatDateForExport, formatCurrencyForExport } from '@/lib/export-utils'
import { logger } from '@/lib/logger'
import { safeAsync, safeSync, getSupabaseErrorMessage } from '@/lib/error-handler'
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
import { ExpenseDialog } from '@/components/expenses/expense-dialog'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

function getExpenseStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default' // Green
    case 'pending':
      return 'outline' // Blue
    case 'rejected':
      return 'destructive' // Red
    default:
      return 'secondary' // Gray
  }
}

export default function ExpensesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  const tStatus = useTranslations('expenses.statuses')
  const tCategories = useTranslations('expenses.categories')
  
  const { subscription, checkLimits } = useSubscription()
  const [expenses, setExpenses] = useState<ExpenseWithSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithSupplier | null>(null)

  // Filters state
  const [filters, setFilters] = useState<FilterState>({})

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
  const expenseColumns: ColumnConfig[] = [
    { key: 'expense_date', label: t('expenseDate'), visible: true },
    { key: 'description', label: t('description'), visible: true },
    { key: 'category', label: t('category'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'supplier', label: t('supplier'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'amount', label: t('amount'), visible: true },
    { key: 'status', label: tCommon('status'), visible: true, hiddenClass: 'hidden sm:table-cell' },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    expenseColumns,
    'expenses-table-columns'
  )

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    loadExpenses(1)
  }, [showArchived])

  // Sorting
  const { sortedData: sortedExpenses, sortKey, sortDirection, handleSort } = useSorting(
    expenses,
    'expense_date',
    'desc'
  )

  async function loadExpenses(page: number = currentPage) {
    setLoading(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return { data: [] as ExpenseWithSupplier[], count: 0 }
      }

      let query = supabase
        .from('expenses')
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
        .order('expense_date', { ascending: false })
        .range(from, to)

      if (error) {
        throw error
      }

      return { 
        data: data ?? [],
        count: count ?? 0
      }
    }, 'Error loading expenses')

    if (result.success) {
      setExpenses(result.data.data)
      setTotalCount(result.data.count)
      setHasMore(result.data.data.length === pageSize)
      setCurrentPage(page)
    } else {
      logger.error('Error loading expenses', result.details)
      toast.error(t('loadError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }

    setLoading(false)
  }

  async function handleAddNew() {
    const limitsCheck = await checkLimits('expense')
    if (!limitsCheck.allowed) {
      setUpgradeDialogParams({
        currentCount: limitsCheck.current_count || 0,
        maxCount: limitsCheck.max_count || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    setSelectedExpense(null)
    setDialogOpen(true)
  }

  function handleEdit(expense: ExpenseWithSupplier) {
    setSelectedExpense(expense)
    setDialogOpen(true)
  }

  function handleRowClick(expense: ExpenseWithSupplier) {
    router.push(`/${locale}/dashboard/expenses/${expense.id}`)
  }

  function confirmDelete(id: string) {
    setExpenseToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function handleDelete(id: string) {
    setIsDeleting(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        throw error
      }
    }, 'Error deleting expense')

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setExpenseToDelete(null)

    if (result.success) {
      toast.success(t('deleteSuccess') || tCommon('success'))
      loadExpenses(currentPage)
    } else {
      logger.error('Error deleting expense', result.details, { expenseId: id })
      toast.error(t('deleteError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  async function handleRestore(id: string) {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: null })
        .eq('id', id)

      if (error) {
        throw error
      }
    }, 'Error restoring expense')

    if (result.success) {
      toast.success(t('restoreSuccess') || tCommon('success'))
      loadExpenses(currentPage)
    } else {
      logger.error('Error restoring expense', result.details, { expenseId: id })
      toast.error(t('restoreError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  async function handlePermanentDelete(id: string) {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase.from('expenses').delete().eq('id', id)

      if (error) {
        throw error
      }
    }, 'Error permanently deleting expense')

    if (result.success) {
      toast.success(t('permanentDeleteSuccess') || tCommon('success'))
      loadExpenses(currentPage)
    } else {
      logger.error('Error permanently deleting expense', result.details, { expenseId: id })
      toast.error(t('permanentDeleteError') || tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  function handleExport(format: 'csv' | 'excel') {
    const dataToExport = expenses.map(expense => ({
      [t('expenseDate') || 'Data']: formatDateForExport(expense.expense_date),
      [t('description') || 'Descrizione']: expense.description,
      [t('category') || 'Categoria']: tCategories(expense.category) || expense.category,
      [t('supplier') || 'Fornitore']: expense.supplier?.name || expense.supplier_name || '',
      [t('amount') || 'Importo']: formatCurrencyForExport(expense.amount),
      [tCommon('status') || 'Stato']: tStatus(expense.status) || expense.status,
      [t('paymentMethod') || 'Metodo']: expense.payment_method || '',
      [t('isDeductible') || 'Deducibile']: expense.is_deductible ? t('deductible') : t('notDeductible'),
    }))

    const result = safeSync(() => {
      const filename = `spese-${new Date().toISOString().split('T')[0]}`
      if (format === 'csv') {
        exportFormattedToCSV(dataToExport, filename)
      } else {
        exportFormattedToExcel(dataToExport, filename)
      }
      return true
    }, 'Error exporting expenses')

    if (result.success) {
      toast.success(tCommon('exportSuccess') || 'Esportazione completata')
    } else {
      logger.error('Error exporting expenses', result.details)
      toast.error(tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
    }
  }

  const totalExpenses = expenses
    .filter(e => !showArchived)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const pendingExpenses = expenses
    .filter(e => !showArchived && e.status === 'pending')
    .length

  const approvedExpenses = expenses
    .filter(e => !showArchived && e.status === 'approved')
    .length

  // Apply filters to sorted expenses
  const filteredExpenses = useMemo(() => {
    return sortedExpenses.filter(expense => {
      // Status filter
      if (filters.status && filters.status !== 'all' && expense.status !== filters.status) {
        return false
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        const expenseDate = new Date(expense.expense_date)
        if (filters.dateFrom && expenseDate < filters.dateFrom) {
          return false
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo)
          toDate.setHours(23, 59, 59, 999) // Include the entire day
          if (expenseDate > toDate) {
            return false
          }
        }
      }

      // Amount range filter
      if (filters.minAmount && Number(expense.amount) < filters.minAmount) {
        return false
      }
      if (filters.maxAmount && Number(expense.amount) > filters.maxAmount) {
        return false
      }

      return true
    })
  }, [sortedExpenses, filters])

  // Row selection - use filteredExpenses for selection
  const rowSelection = useRowSelection(filteredExpenses)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p>{tCommon('loading')}</p>
      </div>
    )
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
        <Button onClick={handleAddNew} size="default" className="w-full sm:w-auto lg:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('addNew')}
        </Button>
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
                    <Wallet className="h-4 w-4 mr-2" />
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
                    filters={filters}
                    onFiltersChange={setFilters}
                    onExport={handleExport}
                    showStatusFilter={true}
                    statusOptions={[
                      { value: 'pending', label: tStatus('pending') },
                      { value: 'approved', label: tStatus('approved') },
                      { value: 'rejected', label: tStatus('rejected') },
                    ]}
                  />
                  <SimpleColumnToggle
                    columns={expenseColumns}
                    columnVisibility={columnVisibility}
                    onVisibilityChange={handleVisibilityChange}
                    label={t('toggleColumns')}
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
                  if (confirm(t('deleteExpense') + ' ' + selectedIds.length + ' ' + tCommon('items') + '?')) {
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
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <Wallet className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  {showArchived ? t('noArchivedExpenses') : t('noExpenses')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {showArchived ? t('noArchivedDescription') : t('noExpensesDescription')}
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
                      <TableHead className={getColumnClass('expense_date')}>
                        <SortableHeader
                          label={t('expenseDate')}
                          sortKey="expense_date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('description')}>
                        <SortableHeader
                          label={t('description')}
                          sortKey="description"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('category')}>{t('category')}</TableHead>
                      <TableHead className={getColumnClass('supplier')}>{t('supplier')}</TableHead>
                      <TableHead className={getColumnClass('amount')}>
                        <SortableHeader
                          label={t('amount')}
                          sortKey="amount"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('status')}>{tCommon('status')}</TableHead>
                      <TableHead className={getColumnClass('actions', 'text-right')}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow
                        key={expense.id}
                        className="cursor-pointer hover:bg-muted/50"
                        data-state={rowSelection.selectedIds.has(expense.id) ? 'selected' : undefined}
                        onClick={() => handleRowClick(expense)}
                      >
                        <TableCheckboxCell
                          checked={rowSelection.selectedIds.has(expense.id)}
                          onCheckedChange={() => rowSelection.toggleRow(expense.id)}
                        />
                        <TableCell className={getColumnClass('expense_date', 'font-medium')}>
                          {format(new Date(expense.expense_date), 'dd/MM/yyyy', {
                            locale: localeMap[locale] || enUS,
                          })}
                        </TableCell>
                        <TableCell className={getColumnClass('description')}>
                          <div className="flex flex-col">
                            <span className="font-medium">{expense.description}</span>
                            {expense.receipt_number && (
                              <span className="text-xs text-muted-foreground">
                                #{expense.receipt_number}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={getColumnClass('category')}>
                          <Badge variant="outline">
                            {tCategories(expense.category) || expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className={getColumnClass('supplier')}>
                          {expense.supplier?.name || expense.supplier_name || '-'}
                        </TableCell>
                        <TableCell className={getColumnClass('amount', 'font-medium tabular-nums')}>
                          <div className="flex flex-col">
                            <span>CHF {expense.amount.toFixed(2)}</span>
                            {expense.is_deductible && (
                              <span className="text-xs text-muted-foreground">
                                {t('deductible')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={getColumnClass('status')}>
                          <Badge variant={getExpenseStatusVariant(expense.status)}>
                            {tStatus(expense.status) || expense.status}
                          </Badge>
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
                                <>
                                  <DropdownMenuItem onSelect={() => handleEdit(expense)}>
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    {tCommon('edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => confirmDelete(expense.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {tCommon('delete')}
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onSelect={() => handleRestore(expense.id)}>
                                    <ArchiveRestore className="mr-2 h-4 w-4" />
                                    {t('restore')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => handlePermanentDelete(expense.id)}
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
                onPageChange={(page) => loadExpenses(page)}
                loading={loading}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => expenseToDelete && handleDelete(expenseToDelete)}
        title={t('deleteDialogTitle')}
        description={t('deleteDialogDescription')}
        isDeleting={isDeleting}
      />

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
        limitType="expense"
      />

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={selectedExpense}
        onSuccess={loadExpenses}
      />
    </div>
  )
}

