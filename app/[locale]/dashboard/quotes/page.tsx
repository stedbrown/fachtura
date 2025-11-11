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
import { Plus, Eye, Trash2, Download, Archive, ArchiveRestore, Receipt, Edit3, MoreHorizontal } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { QuoteWithClient } from '@/lib/types/database'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { AdvancedFilters, FilterState } from '@/components/advanced-filters'
import { exportFormattedToCSV, exportFormattedToExcel, formatDateForExport, formatCurrencyForExport } from '@/lib/export-utils'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { QuotePreview } from '@/components/quotes/quote-preview'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de, // fallback to de for Romansh
}

// Helper function to get badge variant based on quote status
function getQuoteStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default' // Green
    case 'sent':
      return 'outline' // Blue
    case 'rejected':
      return 'destructive' // Red
    default:
      return 'secondary' // Gray for draft
  }
}

export default function QuotesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('quotes')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  const tSubscription = useTranslations('subscription')
  
  const { subscription, checkLimits } = useSubscription()
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  const [previewQuote, setPreviewQuote] = useState<QuoteWithClient | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Column visibility configuration
  const quoteColumns: ColumnConfig[] = [
    { key: 'quote_number', label: t('fields.quoteNumber'), visible: true },
    { key: 'client', label: t('fields.client'), visible: true },
    { key: 'date', label: tCommon('date'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'total', label: tCommon('total'), visible: true },
    { key: 'status', label: tCommon('status'), visible: true },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    quoteColumns,
    'quotes-table-columns'
  )

  useEffect(() => {
    loadQuotes()
    loadClients()
  }, [showArchived])

  const loadQuotes = async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    let query = supabase
      .from('quotes')
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
      setQuotes(data as any)
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

  const handleCreateQuote = async () => {
    // Verifica limiti prima di permettere la creazione
    const limitsResult = await checkLimits('quote')
    
    if (!limitsResult.allowed) {
      // Aggiorna i parametri per il dialog
      setUpgradeDialogParams({
        currentCount: limitsResult.current_count,
        maxCount: limitsResult.max_count || 0,
        planName: limitsResult.plan_name || 'Free'
      })
      setShowUpgradeDialog(true)
      // Mostra notifica
      const resourceLabel = tSubscription('resources.quote')
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
      const resourceLabel = tSubscription('resources.quote')
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
    router.push(`/${locale}/dashboard/quotes/new`)
  }

  // Filter quotes based on active filters
  const filteredQuotes = useMemo(() => {
    let result = quotes

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      result = result.filter((quote) => {
        const quoteDate = new Date(quote.date)
        if (filters.dateFrom && filters.dateTo) {
          return isWithinInterval(quoteDate, {
            start: startOfDay(filters.dateFrom),
            end: endOfDay(filters.dateTo),
          })
        }
        if (filters.dateFrom) {
          return quoteDate >= startOfDay(filters.dateFrom)
        }
        if (filters.dateTo) {
          return quoteDate <= endOfDay(filters.dateTo)
        }
        return true
      })
    }

    // Amount range filter
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      result = result.filter((quote) => {
        const amount = quote.total
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
      result = result.filter((quote) => quote.status === filters.status)
    }

    // Client filter
    if (filters.clientIds && filters.clientIds.length > 0) {
      result = result.filter((quote) => filters.clientIds!.includes(quote.client_id))
    }

    return result
  }, [quotes, filters])

  // Sorting
  const { sortedData: sortedQuotes, sortKey, sortDirection, handleSort } = useSorting(
    filteredQuotes,
    'quote_number',
    'desc'
  )

  const handleExport = (exportFormat: 'csv' | 'excel') => {
    if (filteredQuotes.length === 0) {
      toast.error(tCommon('error'), {
        description: 'Nessun preventivo da esportare',
      })
      return
    }

    // Prepare data for export
    const exportData = filteredQuotes.map((quote) => ({
      [t('fields.quoteNumber')]: quote.quote_number,
      [t('fields.client')]: quote.client.name,
      [tCommon('date')]: formatDateForExport(quote.date || ''),
      [t('fields.validUntil')]: formatDateForExport(quote.valid_until || ''),
      [tCommon('status')]: t(`status.${quote.status}`),
      [tCommon('subtotal')]: formatCurrencyForExport(quote.subtotal),
      [tCommon('tax')]: formatCurrencyForExport(quote.tax_amount),
      [tCommon('total')]: formatCurrencyForExport(quote.total),
    }))

    const filename = `preventivi_${format(new Date(), 'yyyy-MM-dd')}`

    try {
      if (exportFormat === 'csv') {
        exportFormattedToCSV(exportData, filename)
      } else {
        exportFormattedToExcel(exportData, filename)
      }

      toast.success('Export completato!', {
        description: `${filteredQuotes.length} preventivi esportati in ${exportFormat.toUpperCase()}`,
      })
    } catch (error) {
      toast.error(tCommon('error'), {
        description: 'Errore durante l\'export',
      })
    }
  }

  const confirmDelete = (quoteId: string) => {
    setQuoteToDelete(quoteId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!quoteToDelete) return

    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('quotes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', quoteToDelete)

    if (!error) {
      loadQuotes()
    } else {
      alert('Errore durante l\'eliminazione del preventivo')
    }

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setQuoteToDelete(null)
  }

  const handleRestore = async (quoteId: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('quotes')
      .update({ deleted_at: null })
      .eq('id', quoteId)

    if (!error) {
      loadQuotes()
    } else {
      alert('Errore durante il ripristino del preventivo')
    }
  }

  const handlePermanentDelete = async (quoteId: string) => {
    if (!confirm(t('deleteDescription'))) {
      return
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId)

    if (!error) {
      loadQuotes()
    } else {
      alert('Errore durante l\'eliminazione definitiva del preventivo')
    }
  }

  const handleDownloadPDF = async (quoteId: string, quoteNumber: string) => {
    try {
      console.log('📄 Starting PDF download for quote:', quoteId)
      const url = `/api/quotes/${quoteId}/pdf?locale=${locale}`
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
      a.download = `preventivo-${quoteNumber}.pdf`
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={handleCreateQuote} size="default" className="w-full sm:w-auto lg:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('newQuote')}
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
                    <Receipt className="h-4 w-4 mr-2" />
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
                    clients={clients}
                    onExport={handleExport}
                    showClientFilter={true}
                    showStatusFilter={true}
                    statusOptions={[
                      { value: 'draft', label: t('status.draft') },
                      { value: 'sent', label: t('status.sent') },
                      { value: 'accepted', label: t('status.accepted') },
                      { value: 'rejected', label: t('status.rejected') },
                    ]}
                  />
                  <SimpleColumnToggle
                    columns={quoteColumns}
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
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : sortedQuotes.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {quotes.length === 0 ? t('noQuotes') : tCommon('noResults')}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={getColumnClass('quote_number', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('fields.quoteNumber')}
                          sortKey="quote_number"
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
                          label={tCommon('date')}
                          sortKey="date"
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
                {sortedQuotes.map((quote) => (
                  <TableRow 
                    key={quote.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setPreviewQuote(quote)
                      setPreviewOpen(true)
                    }}
                  >
                    <TableCell className={getColumnClass('quote_number', 'font-medium text-xs md:text-sm')}>
                      {quote.quote_number}
                    </TableCell>
                    <TableCell className={getColumnClass('client', 'text-xs md:text-sm')}>{quote.client.name}</TableCell>
                    <TableCell className={getColumnClass('date', 'hidden md:table-cell text-xs md:text-sm')}>
                      {format(new Date(quote.date), 'dd MMM yyyy', {
                        locale: localeMap[locale] || enUS,
                      })}
                    </TableCell>
                    <TableCell className={getColumnClass('total', 'text-right font-medium text-xs md:text-sm tabular-nums')}>CHF {quote.total.toFixed(2)}</TableCell>
                    <TableCell className={getColumnClass('status', 'text-xs md:text-sm')}>
                      <Badge variant={getQuoteStatusVariant(quote.status)} className="text-xs">
                        {t(`status.${quote.status}`)}
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
                                onSelect={() => router.push(`/${locale}/dashboard/quotes/${quote.id}`)}
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                {tCommon('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleDownloadPDF(quote.id, quote.quote_number)}>
                                <Download className="mr-2 h-4 w-4" />
                                {tCommon('download')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => confirmDelete(quote.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {tCommon('delete')}
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => handleRestore(quote.id)}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                {t('restore')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => handlePermanentDelete(quote.id)}
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
        title={t('deleteQuote')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="quote"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />

      {/* Quote Preview */}
      <QuotePreview
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) setPreviewQuote(null)
        }}
        quote={previewQuote}
        locale={locale}
        onEdit={() => {
          if (previewQuote) {
            setPreviewOpen(false)
            router.push(`/${locale}/dashboard/quotes/${previewQuote.id}`)
          }
        }}
        onDownload={() => {
          if (previewQuote) {
            handleDownloadPDF(previewQuote.id, previewQuote.quote_number)
          }
        }}
      />
    </div>
  )
}

