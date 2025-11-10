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
import { Plus, Eye, Trash2, Download, Archive, ArchiveRestore } from 'lucide-react'
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
import { InvoiceDialog } from '@/components/invoices/invoice-dialog'

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
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)

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

  const { visibleColumns, getColumnClass, handleVisibilityChange } = useColumnVisibility(
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
    try {
      // Call API to update overdue invoices
      await fetch('/api/invoices/update-overdue', { method: 'POST' })
    } catch (error) {
      console.error('Error updating overdue invoices:', error)
    } finally {
      // Load invoices and clients regardless of update result
      loadInvoices()
      loadClients()
    }
  }

  const loadInvoices = async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

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

    if (data) {
      setInvoices(data as any)
    }
    setLoading(false)
  }

  const loadClients = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name')

    if (data) {
      setClients(data)
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
    
    // Apri il dialog di creazione
    setInvoiceDialogOpen(true)
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

    try {
      if (exportFormat === 'csv') {
        exportFormattedToCSV(exportData, filename)
      } else {
        exportFormattedToExcel(exportData, filename)
      }

      toast.success('Export completato!', {
        description: `${filteredInvoices.length} fatture esportate in ${exportFormat.toUpperCase()}`,
      })
    } catch (error) {
      toast.error(tCommon('error'), {
        description: 'Errore durante l\'export',
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
    const supabase = createClient()

    const { error } = await supabase
      .from('invoices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', invoiceToDelete)

    if (!error) {
      loadInvoices()
    } else {
      alert('Errore durante l\'eliminazione della fattura')
    }

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setInvoiceToDelete(null)
  }

  const handleRestore = async (invoiceId: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('invoices')
      .update({ deleted_at: null })
      .eq('id', invoiceId)

    if (!error) {
      loadInvoices()
    } else {
      alert('Errore durante il ripristino della fattura')
    }
  }

  const handlePermanentDelete = async (invoiceId: string) => {
    if (!confirm(t('deleteDescription'))) {
      return
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)

    if (!error) {
      loadInvoices()
    } else {
      alert('Errore durante l\'eliminazione definitiva della fattura')
    }
  }

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      console.log('📄 Starting PDF download for invoice:', invoiceId)
      const url = `/api/invoices/${invoiceId}/pdf?locale=${locale}`
      console.log('📄 Fetching from:', url)
      
      const response = await fetch(url)
      console.log('📄 Response status:', response.status, response.statusText)
      console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ PDF generation failed:', errorText)
        alert(`Errore ${response.status}: ${errorText}`)
        return
      }
      
      const blob = await response.blob()
      console.log('📄 Blob received, size:', blob.size, 'type:', blob.type)
      
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `fattura-${invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
      
      console.log('✅ PDF downloaded successfully')
    } catch (error) {
      console.error('❌ Error downloading PDF:', error)
      alert('Errore durante il download del PDF')
    }
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
        <Button onClick={handleCreateInvoice} size="default" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('newInvoice')}
        </Button>
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
              {!showArchived && (
                <div className="flex gap-2">
                  <SimpleColumnToggle
                    columns={visibleColumns}
                    onVisibilityChange={handleVisibilityChange}
                    storageKey="invoices-table-columns"
                    label={t('toggleColumns') || tCommon('toggleColumns') || 'Colonne'}
                  />
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
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : sortedInvoices.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {invoices.length === 0 ? t('noInvoices') : 'Nessuna fattura trovata con i filtri applicati'}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`text-xs md:text-sm ${getColumnClass('invoice_number')}`}>
                        <SortableHeader
                          label={t('fields.invoiceNumber')}
                          sortKey="invoice_number"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`text-xs md:text-sm ${getColumnClass('client')}`}>
                        <SortableHeader
                          label={t('fields.client')}
                          sortKey="client.name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('date')}`}>
                        <SortableHeader
                          label={t('fields.date')}
                          sortKey="date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('due_date')}`}>
                        <SortableHeader
                          label={t('fields.dueDate')}
                          sortKey="due_date"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`text-right text-xs md:text-sm ${getColumnClass('total')}`}>
                        <SortableHeader
                          label={tCommon('total')}
                          sortKey="total"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`text-xs md:text-sm ${getColumnClass('status')}`}>
                        <SortableHeader
                          label={tCommon('status')}
                          sortKey="status"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`text-right text-xs md:text-sm ${getColumnClass('actions')}`}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {sortedInvoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/${locale}/dashboard/invoices/${invoice.id}`)}
                  >
                    <TableCell className={`font-medium text-xs md:text-sm ${getColumnClass('invoice_number')}`}>
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell className={`text-xs md:text-sm ${getColumnClass('client')}`}>{invoice.client.name}</TableCell>
                    <TableCell className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('date')}`}>
                      {format(new Date(invoice.date), 'dd MMM yyyy', {
                        locale: localeMap[locale] || enUS,
                      })}
                    </TableCell>
                    <TableCell className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('due_date')}`}>
                      {invoice.due_date
                        ? format(new Date(invoice.due_date), 'dd MMM yyyy', {
                            locale: localeMap[locale] || enUS,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium text-xs md:text-sm ${getColumnClass('total')}`}>CHF {invoice.total.toFixed(2)}</TableCell>
                    <TableCell className={getColumnClass('status')}>
                      <Badge variant={getInvoiceStatusVariant(invoice.status)} className="text-xs">
                        {t(`status.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right ${getColumnClass('actions')}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {!showArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(invoice.id)}
                              title={tCommon('download')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(invoice.id)}
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
                              onClick={() => handleRestore(invoice.id)}
                              title={t('restore')}
                            >
                              <ArchiveRestore className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePermanentDelete(invoice.id)}
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

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        onSuccess={() => {
          setInvoiceDialogOpen(false)
          updateOverdueInvoicesAndLoad()
        }}
      />
    </div>
  )
}

