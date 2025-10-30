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
import type { InvoiceWithClient } from '@/lib/types/database'
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
  const locale = params.locale as string
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})

  useEffect(() => {
    loadInvoices()
    loadClients()
  }, [showArchived])

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
      const response = await fetch(`/api/invoices/${invoiceId}/pdf?locale=${locale}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `fattura-${invoiceId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
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
        <Button onClick={() => router.push(`/${locale}/dashboard/invoices/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newInvoice')}
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
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {invoices.length === 0 ? t('noInvoices') : 'Nessuna fattura trovata con i filtri applicati'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.invoiceNumber')}</TableHead>
                  <TableHead>{t('fields.client')}</TableHead>
                  <TableHead>{t('fields.date')}</TableHead>
                  <TableHead>{t('fields.dueDate')}</TableHead>
                  <TableHead>{tCommon('total')}</TableHead>
                  <TableHead>{tCommon('status')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>{invoice.client.name}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.date), 'dd MMM yyyy', {
                        locale: localeMap[locale] || enUS,
                      })}
                    </TableCell>
                    <TableCell>
                      {invoice.due_date
                        ? format(new Date(invoice.due_date), 'dd MMM yyyy', {
                            locale: localeMap[locale] || enUS,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>CHF {invoice.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                        {t(`status.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            router.push(`/${locale}/dashboard/invoices/${invoice.id}`)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!showArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(invoice.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(invoice.id)}
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
    </div>
  )
}

