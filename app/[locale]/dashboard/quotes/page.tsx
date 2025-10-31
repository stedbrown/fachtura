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
import { Plus, Eye, Trash2, Download, Archive, ArchiveRestore } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import type { QuoteWithClient } from '@/lib/types/database'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { AdvancedFilters, FilterState } from '@/components/advanced-filters'
import { exportFormattedToCSV, exportFormattedToExcel, formatDateForExport, formatCurrencyForExport } from '@/lib/export-utils'
import { toast } from 'sonner'

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
  
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => router.push(`/${locale}/dashboard/quotes/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newQuote')}
        </Button>
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

      {!showArchived && (
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
      )}

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
          ) : filteredQuotes.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {quotes.length === 0 ? t('noQuotes') : tCommon('noResults')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.quoteNumber')}</TableHead>
                  <TableHead>{t('fields.client')}</TableHead>
                  <TableHead>{tCommon('date')}</TableHead>
                  <TableHead>{tCommon('total')}</TableHead>
                  <TableHead>{tCommon('status')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">
                      {quote.quote_number}
                    </TableCell>
                    <TableCell>{quote.client.name}</TableCell>
                    <TableCell>
                      {format(new Date(quote.date), 'dd MMM yyyy', {
                        locale: localeMap[locale] || enUS,
                      })}
                    </TableCell>
                    <TableCell>CHF {quote.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getQuoteStatusVariant(quote.status)}>
                        {t(`status.${quote.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            router.push(`/${locale}/dashboard/quotes/${quote.id}`)
                          }
                          title={tCommon('view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!showArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(quote.id, quote.quote_number)}
                              title={tCommon('download')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(quote.id)}
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
                              onClick={() => handleRestore(quote.id)}
                              title={t('restore')}
                            >
                              <ArchiveRestore className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePermanentDelete(quote.id)}
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

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteQuote')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />
    </div>
  )
}

