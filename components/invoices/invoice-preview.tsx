'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Download, Edit3, Loader2 } from 'lucide-react'
import type { InvoiceWithClient } from '@/lib/types/database'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'

interface InvoicePreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: InvoiceWithClient | null
  locale: string
  onEdit?: () => void
  onDownload?: () => void
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
}

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

const invoiceStatusKeys = ['draft', 'issued', 'paid', 'overdue'] as const
type InvoiceStatusKey = (typeof invoiceStatusKeys)[number]
const isInvoiceStatusKey = (value: string): value is InvoiceStatusKey =>
  invoiceStatusKeys.includes(value as InvoiceStatusKey)

export function InvoicePreview({
  open,
  onOpenChange,
  invoice,
  locale,
  onEdit,
  onDownload,
}: InvoicePreviewProps) {
  const t = useTranslations('invoices')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('invoices.status')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && invoice) {
      loadInvoiceItems()
    }
  }, [open, invoice])

  const loadInvoiceItems = async () => {
    if (!invoice) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at')

    if (data) setItems(data)
    setLoading(false)
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'paid':
        return 'default'
      case 'issued':
        return 'outline'
      case 'overdue':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (!invoice) return null

  const normalizedStatus = isInvoiceStatusKey(invoice.status)
    ? invoice.status
    : 'draft'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl font-bold truncate">
                {invoice.invoice_number}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                {t('preview.subtitle')}
              </DialogDescription>
            </div>
            <Badge variant={getStatusVariant(normalizedStatus)} className="text-xs sm:text-sm shrink-0 self-start">
              {tStatus(normalizedStatus)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client & Dates Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {t('fields.client')}
                  </h3>
                  <div className="space-y-1">
                    <p className="font-semibold text-lg">{invoice.client.name}</p>
                    {invoice.client.email && (
                      <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
                    )}
                    {invoice.client.phone && (
                      <p className="text-sm text-muted-foreground">{invoice.client.phone}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('fields.date')}</p>
                    <p className="font-medium">
                      {format(new Date(invoice.date), 'dd MMMM yyyy', {
                        locale: localeMap[locale] || enUS,
                      })}
                    </p>
                  </div>
                  {invoice.due_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('fields.dueDate')}</p>
                      <p className="font-medium">
                        {format(new Date(invoice.due_date), 'dd MMMM yyyy', {
                          locale: localeMap[locale] || enUS,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t('form.items')}
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="hidden sm:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b bg-muted/50">
                          <tr>
                            <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                              {t('form.description')}
                            </th>
                            <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">
                              {t('form.quantity')}
                            </th>
                            <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">
                              {t('form.unitPrice')}
                            </th>
                            <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">
                              {t('form.taxRate')}
                            </th>
                            <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">
                              {tCommon('total')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/30">
                              <td className="p-3 text-sm">{item.description}</td>
                              <td className="p-3 text-sm text-right tabular-nums whitespace-nowrap">{item.quantity}</td>
                              <td className="p-3 text-sm text-right tabular-nums whitespace-nowrap">
                                CHF {item.unit_price.toFixed(2)}
                              </td>
                              <td className="p-3 text-sm text-right tabular-nums whitespace-nowrap">{item.tax_rate}%</td>
                              <td className="p-3 text-sm text-right font-medium tabular-nums whitespace-nowrap">
                                CHF {item.line_total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="sm:hidden divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="p-3 space-y-3">
                        <div className="text-sm font-medium">{item.description}</div>
                        <div className="flex justify-between text-xs uppercase text-muted-foreground">
                          <span>{t('form.quantity')}</span>
                          <span className="tabular-nums text-foreground">{item.quantity}</span>
                        </div>
                        <div className="flex justify-between text-xs uppercase text-muted-foreground">
                          <span>{t('form.unitPrice')}</span>
                          <span className="tabular-nums text-foreground">CHF {item.unit_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs uppercase text-muted-foreground">
                          <span>{t('form.taxRate')}</span>
                          <span className="tabular-nums text-foreground">{item.tax_rate}%</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                          <span>{tCommon('total')}</span>
                          <span className="tabular-nums text-foreground">CHF {item.line_total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <Card className="w-full sm:w-auto sm:min-w-[280px] md:min-w-[320px] border-primary/20 bg-primary/5">
              <CardContent className="pt-4 sm:pt-6 space-y-2 sm:space-y-3">
                <div className="flex justify-between text-xs sm:text-sm gap-4">
                  <span className="text-muted-foreground">{t('form.subtotal')}</span>
                  <span className="font-semibold tabular-nums">
                    CHF {invoice.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm gap-4">
                  <span className="text-muted-foreground">{t('form.tax')}</span>
                  <span className="font-semibold tabular-nums">
                    CHF {invoice.tax_amount.toFixed(2)}
                  </span>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-sm sm:text-base">{t('form.total')}</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary tabular-nums">
                    CHF {invoice.total.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {tCommon('notes')}
              </h3>
              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{invoice.notes}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {tCommon('close')}
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto w-full sm:w-auto">
            {onDownload && (
              <Button
                variant="outline"
                onClick={onDownload}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{tCommon('download')}</span>
                <span className="sm:hidden">{tCommon('download')}</span>
              </Button>
            )}
            {onEdit && (
              <Button onClick={onEdit} className="w-full sm:w-auto">
                <Edit3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{tCommon('edit')}</span>
                <span className="sm:hidden">{tCommon('edit')}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

