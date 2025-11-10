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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {invoice.invoice_number}
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {t('preview.subtitle')}
              </DialogDescription>
            </div>
            <Badge variant={getStatusVariant(invoice.status)} className="text-sm">
              {tStatus(invoice.status as any)}
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t('form.items')}
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                            {t('form.description')}
                          </th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                            {t('form.quantity')}
                          </th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                            {t('form.unitPrice')}
                          </th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                            {t('form.taxRate')}
                          </th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                            {tCommon('total')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item, index) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="p-3 text-sm">{item.description}</td>
                            <td className="p-3 text-sm text-right tabular-nums">{item.quantity}</td>
                            <td className="p-3 text-sm text-right tabular-nums">
                              CHF {item.unit_price.toFixed(2)}
                            </td>
                            <td className="p-3 text-sm text-right tabular-nums">{item.tax_rate}%</td>
                            <td className="p-3 text-sm text-right font-medium tabular-nums">
                              CHF {item.line_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <Card className="w-full md:w-96 border-primary/20 bg-primary/5">
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('form.subtotal')}</span>
                  <span className="font-semibold tabular-nums">
                    CHF {invoice.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('form.tax')}</span>
                  <span className="font-semibold tabular-nums">
                    CHF {invoice.tax_amount.toFixed(2)}
                  </span>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between items-center">
                  <span className="font-bold">{t('form.total')}</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    CHF {invoice.total.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {tCommon('notes')}
              </h3>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
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
          <div className="flex gap-2 ml-auto">
            {onDownload && (
              <Button
                variant="outline"
                onClick={onDownload}
                className="flex-1 sm:flex-none"
              >
                <Download className="h-4 w-4 mr-2" />
                {tCommon('download')}
              </Button>
            )}
            {onEdit && (
              <Button onClick={onEdit} className="flex-1 sm:flex-none">
                <Edit3 className="h-4 w-4 mr-2" />
                {tCommon('edit')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

