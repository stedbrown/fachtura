'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Receipt, Calendar, DollarSign, Building, FileText, Percent, Loader2, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import Link from 'next/link'
import type { ExpenseWithSupplier } from '@/lib/types/database'

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
      return 'default'
    case 'pending':
      return 'outline'
    case 'rejected':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function getPaymentMethodLabel(method: string | null, t: any): string {
  if (!method) return '-'
  switch (method) {
    case 'cash':
      return t('paymentMethods.cash') || 'Contanti'
    case 'card':
      return t('paymentMethods.card') || 'Carta'
    case 'bank_transfer':
      return t('paymentMethods.bankTransfer') || 'Bonifico'
    case 'other':
      return t('paymentMethods.other') || 'Altro'
    default:
      return method
  }
}

function getCategoryLabel(category: string, t: any): string {
  switch (category) {
    case 'travel':
      return t('categories.travel') || 'Viaggi'
    case 'office':
      return t('categories.office') || 'Ufficio'
    case 'meals':
      return t('categories.meals') || 'Pasti'
    case 'equipment':
      return t('categories.equipment') || 'Attrezzature'
    case 'software':
      return t('categories.software') || 'Software'
    case 'marketing':
      return t('categories.marketing') || 'Marketing'
    case 'utilities':
      return t('categories.utilities') || 'Utilità'
    case 'insurance':
      return t('categories.insurance') || 'Assicurazioni'
    case 'professional_services':
      return t('categories.professionalServices') || 'Servizi professionali'
    case 'other':
      return t('categories.other') || 'Altro'
    default:
      return category
  }
}

export default function ExpenseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const expenseId = params.id as string
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('expenses.status')

  const [expense, setExpense] = useState<ExpenseWithSupplier | null>(null)
  const [loading, setLoading] = useState(true)
  const dateLocale = localeMap[locale] || it

  useEffect(() => {
    loadExpenseData()
  }, [expenseId])

  async function loadExpenseData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/${locale}/dashboard/expenses`)
      return
    }

    // Load expense with supplier
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('id', expenseId)
      .eq('user_id', user.id)
      .single()

    if (expenseError || !expenseData) {
      console.error('Error loading expense:', expenseError)
      router.push(`/${locale}/dashboard/expenses`)
      return
    }

    setExpense(expenseData as ExpenseWithSupplier)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{tCommon('loading')}...</p>
        </div>
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="p-6">
        <p>{t('notFound') || 'Spesa non trovata'}</p>
        <Button onClick={() => router.push(`/${locale}/dashboard/expenses`)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard/expenses`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{expense.description}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('detail') || 'Dettaglio spesa'}
          </p>
        </div>
        <Badge variant={getExpenseStatusVariant(expense.status)} className="text-sm">
          {tStatus(expense.status)}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Expense Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t('information') || 'Informazioni'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('fields.category')}</p>
                <p className="text-sm text-muted-foreground">{getCategoryLabel(expense.category, t)}</p>
              </div>
            </div>
            {(expense.supplier || expense.supplier_name) && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('fields.supplier')}</p>
                  {expense.supplier ? (
                    <Link
                      href={`/${locale}/dashboard/suppliers/${expense.supplier.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {expense.supplier.name}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">{expense.supplier_name}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('fields.expenseDate')}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(expense.expense_date), 'dd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Receipt className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('fields.paymentMethod')}</p>
                <p className="text-sm text-muted-foreground">
                  {getPaymentMethodLabel(expense.payment_method, t)}
                </p>
              </div>
            </div>
            {expense.receipt_number && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.receiptNumber')}</p>
                  <p className="text-sm text-muted-foreground">{expense.receipt_number}</p>
                </div>
              </div>
            )}
            {expense.receipt_url && (
              <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('fields.receipt')}</p>
                  <a
                    href={expense.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {t('viewReceipt') || 'Visualizza ricevuta'}
                  </a>
                </div>
              </div>
            )}
            {expense.notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{tCommon('notes')}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{expense.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('financialDetails') || 'Dettagli finanziari'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.amount')}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {expense.currency} {Number(expense.amount).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Percent className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.taxRate')}</p>
                  <p className="text-lg font-semibold tabular-nums">{expense.tax_rate}%</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.taxAmount')}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {expense.currency} {Number(expense.tax_amount).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-muted/50 border rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('fields.isDeductible')}</p>
                <Badge variant={expense.is_deductible ? 'default' : 'secondary'}>
                  {expense.is_deductible ? tCommon('yes') || 'Sì' : tCommon('no') || 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

