'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
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
import { Plus, Eye, Trash2, Download, Archive, ArchiveRestore, FileText, Edit3, MoreHorizontal, Share2 } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { InvoiceWithClient } from '@/lib/types/database'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { AdvancedFilters, FilterState } from '@/components/advanced-filters'
import { exportFormattedToCSV, exportFormattedToExcel, formatDateForExport, formatCurrencyForExport } from '@/lib/export-utils'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { InvoicePreview } from '@/components/invoices/invoice-preview'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { safeAsync, safeSync, getSupabaseErrorMessage } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import { useRowSelection } from '@/hooks/use-row-selection'
import { TableCheckboxHeader, TableCheckboxCell } from '@/components/table/table-checkbox-column'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

// Helper function to get badge variant based on invoice status
function getInvoiceStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid':
      return 'default' // Green
    case 'issued':
      return 'outline' // Blue
    case 'overdue':
      return 'destructive' // Red
    default:
      return 'secondary' // Gray for draft
  }
}

export default function InvoicesPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as string
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  const tSubscription = useTranslations('subscription')
  
  const { subscription, checkLimits } = useSubscription()
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceWithClient | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

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
  const invoiceColumns: ColumnConfig[] = [
    { key: 'invoice_number', label: t('fields.invoiceNumber'), visible: true },
    { key: 'client', label: t('fields.client'), visible: true },
    { key: 'date', label: t('fields.date'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'due_date', label: t('fields.dueDate'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'total', label: tCommon('total'), visible: true },
    { key: 'status', label: tCommon('status'), visible: true },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    invoiceColumns,
    'invoices-table-columns'
  )

  // Initialize filters from URL params
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setFilters({ status: statusParam })
    }
  }, [searchParams])

  useEffect(() => {
    updateOverdueInvoicesAndLoad()
  }, [showArchived])

  // Update overdue invoices before loading
  const updateOverdueInvoicesAndLoad = async () => {
    const updateResult = await safeAsync(async () => {
      const response = await fetch('/api/invoices/update-overdue', { method: 'POST' })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to update overdue invoices')
      }
    }, 'Error updating overdue invoices')

    if (!updateResult.success) {
      logger.error('Failed updating overdue invoices', updateResult.details)
      toast.error(tCommon('error'), {
        description: extractErrorMessage(updateResult.error, updateResult.details),
      })
    }

    await Promise.all([loadInvoices(), loadClients()])
  }

  const loadInvoices = async () => {
    setLoading(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return [] as InvoiceWithClient[]
      }

      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('user_id', user.id)

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as InvoiceWithClient[]
    }, 'Error loading invoices')

    if (result.success) {
      setInvoices(result.data)
    } else {
      toast.error(tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }

    setLoading(false)
  }

  const loadClients = async () => {
    const result = await safeAsync(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return []
      }

      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('name')

      if (error) {
        throw error
      }

      return data ?? []
    }, 'Error loading clients for invoices')

    if (result.success) {
      setClients(result.data)
    } else {
      toast.error(tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  const handleCreateInvoice = async () => {
    // Verifica limiti prima di permettere la creazione
    const limitsResult = await checkLimits('invoice')
    
    if (!limitsResult.allowed) {
      // Aggiorna i parametri per il dialog
      setUpgradeDialogParams({
        currentCount: limitsResult.current_count,
        maxCount: limitsResult.max_count || 0,
        planName: limitsResult.plan_name || 'Free'
      })
      setShowUpgradeDialog(true)
      // Mostra notifica
      const resourceLabel = tSubscription('resources.invoice')
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
      const resourceLabel = tSubscription('resources.invoice')
      toast.warning(tSubscription('toast.warning'), {
        description: tSubscription('toast.warningDescription', {
          current: currentCount,
          max: maxCount,
          resource: resourceLabel
        }),
        duration: 4000,
      })
    }
    
    // Naviga alla pagina di creazione
    router.push(`/${locale}/dashboard/invoices/new`)
  }

  const handleEditInvoice = (invoice: InvoiceWithClient) => {
    router.push(`/${locale}/dashboard/invoices/${invoice.id}`)
  }

  // Filter invoices based on active filters
  const filteredInvoices = useMemo(() => {
    let result = invoices

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      result = result.filter((invoice) => {
        const invoiceDate = new Date(invoice.date)
        if (filters.dateFrom && filters.dateTo) {
          return isWithinInterval(invoiceDate, {
            start: startOfDay(filters.dateFrom),
            end: endOfDay(filters.dateTo),
          })
        }
        if (filters.dateFrom) {
          return invoiceDate >= startOfDay(filters.dateFrom)
        }
        if (filters.dateTo) {
          return invoiceDate <= endOfDay(filters.dateTo)
        }
        return true
      })
    }

    // Amount range filter
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      result = result.filter((invoice) => {
        const amount = invoice.total
        if (filters.minAmount !== undefined && filters.maxAmount !== undefined) {
          return amount >= filters.minAmount && amount <= filters.maxAmount
        }
        if (filters.minAmount !== undefined) {
          return amount >= filters.minAmount
        }
        if (filters.maxAmount !== undefined) {
          return amount <= filters.maxAmount
        }
        return true
      })
    }

    // Status filter
    if (filters.status) {
      result = result.filter((invoice) => invoice.status === filters.status)
    }

    // Client filter
    if (filters.clientIds && filters.clientIds.length > 0) {
      result = result.filter((invoice) => filters.clientIds!.includes(invoice.client_id))
    }

    return result
  }, [invoices, filters])

  // Sorting
  const { sortedData: sortedInvoices, sortKey, sortDirection, handleSort } = useSorting(
    filteredInvoices,
    'invoice_number',
    'desc'
  )

  // Row selection
  const rowSelection = useRowSelection(sortedInvoices)

  // Export function
  const handleExport = (exportFormat: 'csv' | 'excel') => {
    if (filteredInvoices.length === 0) {
      toast.error(tCommon('error'), {
        description: 'Nessuna fattura da esportare',
      })
      return
    }

    // Prepare data for export
    const exportData = filteredInvoices.map((invoice) => ({
      [t('fields.invoiceNumber')]: invoice.invoice_number,
      [t('fields.client')]: invoice.client.name,
      [t('fields.date')]: formatDateForExport(invoice.date || ''),
      [t('fields.dueDate')]: formatDateForExport(invoice.due_date || ''),
      [tCommon('status')]: t(`status.${invoice.status}`),
      [tCommon('subtotal')]: formatCurrencyForExport(invoice.subtotal),
      [tCommon('tax')]: formatCurrencyForExport(invoice.tax_amount),
      [tCommon('total')]: formatCurrencyForExport(invoice.total),
    }))

    const filename = `fatture_${format(new Date(), 'yyyy-MM-dd')}`

    const exportResult = safeSync(() => {
      if (exportFormat === 'csv') {
        exportFormattedToCSV(exportData, filename)
      } else {
        exportFormattedToExcel(exportData, filename)
      }
      return true
    }, 'Error exporting invoices')

    if (exportResult.success) {
      toast.success('Export completato!', {
        description: `${filteredInvoices.length} fatture esportate in ${exportFormat.toUpperCase()}`,
      })
    } else {
      toast.error(tCommon('error'), {
        description:
          exportResult.details
            ? getSupabaseErrorMessage(exportResult.details)
            : exportResult.error,
      })
    }
  }

  const confirmDelete = (invoiceId: string) => {
    setInvoiceToDelete(invoiceId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!invoiceToDelete) return

    setIsDeleting(true)

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', invoiceToDelete)

      if (error) {
        throw error
      }
    }, 'Error archiving invoice')

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setInvoiceToDelete(null)

    if (result.success) {
      loadInvoices()
    } else {
      toast.error(tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  const handleRestore = async (invoiceId: string) => {
    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('invoices')
        .update({ deleted_at: null })
        .eq('id', invoiceId)

      if (error) {
        throw error
      }
    }, 'Error restoring invoice')

    if (result.success) {
      loadInvoices()
    } else {
      toast.error(tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  const handlePermanentDelete = async (invoiceId: string) => {
    if (!confirm(t('deleteDescription'))) {
      return
    }

    const result = await safeAsync(async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)

      if (error) {
        throw error
      }
    }, 'Error permanently deleting invoice')

    if (result.success) {
      loadInvoices()
    } else {
      toast.error(tCommon('error'), {
        description: result.details
          ? getSupabaseErrorMessage(result.details)
          : result.error,
      })
    }
  }

  const handleDownloadPDF = async (invoiceId: string) => {
    logger.debug('Starting invoice PDF download', { invoiceId })

    const result = await safeAsync(async () => {
      const url = `/api/invoices/${invoiceId}/pdf?locale=${locale}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || `Failed to download invoice PDF (status ${response.status})`
        )
      }

      return await response.blob()
    }, 'Error downloading invoice PDF')

    if (!result.success) {
      toast.error(tCommon('error'), {
        description: extractErrorMessage(result.error, result.details),
      })
      return
    }

    const blob = result.data
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `fattura-${invoiceId}.pdf`
    document.body.appendChild(link)
    link.click()
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(link)

    logger.debug('Invoice PDF downloaded successfully', { invoiceId })
  }

  const handleSharePDF = async (invoiceId: string, invoiceNumber: string, clientName: string) => {
    logger.debug('Starting invoice PDF share', { invoiceId, invoiceNumber, clientName })

    // Check if Web Share API is supported
    if (!navigator.share) {
      logger.debug('Web Share API not supported', { invoiceId })
      toast.error(t('shareNotSupported'))
      return
    }

    logger.debug('Web Share API is supported, fetching PDF', { invoiceId })

    const result = await safeAsync(async () => {
      const url = `/api/invoices/${invoiceId}/pdf?locale=${locale}`
      logger.debug('Fetching PDF from API', { invoiceId, url })
      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || `Failed to fetch invoice PDF (status ${response.status})`
        )
      }

      return await response.blob()
    }, 'Error fetching invoice PDF for sharing')

    if (!result.success) {
      logger.error('Failed to fetch PDF for sharing', result.error, { invoiceId, details: result.details })
      toast.error(t('shareError'), {
        description: extractErrorMessage(result.error, result.details),
      })
      return
    }

    try {
      const blob = result.data
      logger.debug('PDF blob received', { invoiceId, blobSize: blob.size, blobType: blob.type })
      
      const file = new File([blob], `Fattura-${invoiceNumber}.pdf`, { type: 'application/pdf' })
      logger.debug('File object created', { invoiceId, fileName: file.name, fileSize: file.size, fileType: file.type })

      // Check if file sharing is supported with the actual file
      if (!navigator.canShare) {
        logger.debug('navigator.canShare not available', { invoiceId })
        toast.error(t('shareFilesNotSupported'))
        return
      }

      const canShareResult = navigator.canShare({ files: [file] })
      logger.debug('canShare check result', { invoiceId, canShare: canShareResult })
      
      if (!canShareResult) {
        logger.debug('File sharing not supported for this file', { invoiceId })
        toast.error(t('shareFilesNotSupported'))
        return
      }

      logger.debug('Calling navigator.share', { invoiceId })
      await navigator.share({
        title: `Fattura ${invoiceNumber}`,
        text: t('shareText', { clientName, invoiceNumber }),
        files: [file],
      })

      toast.success(t('sharedSuccessfully'))
      logger.debug('Invoice PDF shared successfully', { invoiceId })
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
          // User cancelled the share dialog - this is expected behavior
          logger.debug('User cancelled invoice PDF share', { invoiceId, errorName: error.name })
        } else {
          // Actual error occurred
          logger.error('Error sharing invoice PDF', error, { 
            invoiceId, 
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack 
          })
          toast.error(t('shareError'))
        }
      } else {
        // Unknown error type
        const errorString = error ? String(error) : 'Unknown error'
        logger.error('Error sharing invoice PDF', new Error(errorString), { 
          invoiceId, 
          originalError: error,
          errorType: typeof error 
        })
        toast.error(t('shareError'))
      }
    }
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
        <Button onClick={handleCreateInvoice} size="default" className="w-full sm:w-auto lg:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('newInvoice')}
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
                    <FileText className="h-4 w-4 mr-2" />
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
                    showClientFilter={true}
                    showStatusFilter={true}
                    statusOptions={[
                      { value: 'draft', label: t('status.draft') },
                      { value: 'issued', label: t('status.issued') },
                      { value: 'paid', label: t('status.paid') },
                      { value: 'overdue', label: t('status.overdue') },
                    ]}
                    clients={clients}
                  />
                  <SimpleColumnToggle
                    columns={invoiceColumns}
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
                  rowSelection.selectedItems.forEach((invoice) => {
                    handleDownloadPDF(invoice.id)
                  })
                  rowSelection.clearSelection()
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                {tCommon('download')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedIds = Array.from(rowSelection.selectedIds)
                  if (confirm(t('deleteInvoice') + ' ' + selectedIds.length + ' ' + tCommon('items') + '?')) {
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
          ) : sortedInvoices.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <FileText className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-base md:text-lg font-semibold mb-2">
                {showArchived ? t('noArchivedInvoices') : t('noInvoices')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {showArchived ? t('noArchivedDescription') : t('noInvoicesDescription')}
              </p>
              {!showArchived && (
                <Button onClick={handleCreateInvoice}>
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
                      <TableHead className={getColumnClass('invoice_number', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.invoiceNumber')}
                          sortKey="invoice_number"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('client', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.client')}
                          sortKey="client.name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('date', 'hidden md:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.date')}
                          sortKey="date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('due_date', 'hidden lg:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.dueDate')}
                          sortKey="due_date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('total', 'text-right text-xs md:text-sm')}>
                        <SortableHeader
                          label={tCommon('total')}
                          sortKey="total"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          align="right"
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
                      <TableHead className={getColumnClass('actions', 'text-right text-xs md:text-sm')}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {sortedInvoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-state={rowSelection.selectedIds.has(invoice.id) ? 'selected' : undefined}
                    onClick={() => {
                      setPreviewInvoice(invoice)
                      setPreviewOpen(true)
                    }}
                  >
                    <TableCheckboxCell
                      checked={rowSelection.selectedIds.has(invoice.id)}
                      onCheckedChange={() => rowSelection.toggleRow(invoice.id)}
                    />
                    <TableCell className={getColumnClass('invoice_number', 'font-medium text-xs md:text-sm')}>
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell className={getColumnClass('client', 'text-xs md:text-sm')}>{invoice.client.name}</TableCell>
                    <TableCell className={getColumnClass('date', 'hidden md:table-cell text-xs md:text-sm')}>
                      {format(new Date(invoice.date), 'dd MMM yyyy', {
                        locale: localeMap[locale] || enUS,
                      })}
                    </TableCell>
                    <TableCell className={getColumnClass('due_date', 'hidden lg:table-cell text-xs md:text-sm')}>
                      {invoice.due_date
                        ? format(new Date(invoice.due_date), 'dd MMM yyyy', {
                            locale: localeMap[locale] || enUS,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className={getColumnClass('total', 'text-right font-medium text-xs md:text-sm tabular-nums')}>CHF {invoice.total.toFixed(2)}</TableCell>
                    <TableCell className={getColumnClass('status', 'text-xs md:text-sm')}>
                      <Badge variant={getInvoiceStatusVariant(invoice.status)} className="text-xs">
                        {t(`status.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className={getColumnClass('actions', 'text-right')} onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 data-[state=open]:bg-muted"
                            aria-label={tCommon('actions')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {!showArchived ? (
                            <>
                              <DropdownMenuItem
                                onSelect={() => {
                                  handleEditInvoice(invoice)
                                }}
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                {tCommon('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleDownloadPDF(invoice.id)}>
                                <Download className="mr-2 h-4 w-4" />
                                {tCommon('download')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => handleSharePDF(invoice.id, invoice.invoice_number, invoice.client.name)}
                              >
                                <Share2 className="mr-2 h-4 w-4" />
                                {tCommon('share')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => confirmDelete(invoice.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {tCommon('delete')}
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => handleRestore(invoice.id)}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                {t('restore')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => handlePermanentDelete(invoice.id)}
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
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteInvoice')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="invoice"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />

      {/* Invoice Preview */}
      <InvoicePreview
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) setPreviewInvoice(null)
        }}
        invoice={previewInvoice}
        locale={locale}
        onEdit={() => {
          if (previewInvoice) {
            setPreviewOpen(false)
            router.push(`/${locale}/dashboard/invoices/${previewInvoice.id}`)
          }
        }}
        onDownload={() => {
          if (previewInvoice) {
            handleDownloadPDF(previewInvoice.id)
          }
        }}
        onShare={() => {
          if (previewInvoice) {
            handleSharePDF(previewInvoice.id, previewInvoice.invoice_number, previewInvoice.client.name)
          }
        }}
      />
    </div>
  )
}

