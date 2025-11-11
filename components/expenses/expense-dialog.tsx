'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { expenseFormSchema, type ExpenseFormInput, expenseCategories, expensePaymentMethods, expenseStatuses } from '@/lib/validations/expense'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ExpenseWithSupplier, Supplier } from '@/lib/types/database'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useParams } from 'next/navigation'

interface ExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: ExpenseWithSupplier | null
  onSuccess: () => void
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  onSuccess,
}: ExpenseDialogProps) {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')
  const tCategories = useTranslations('expenses.categories')
  const tPaymentMethods = useTranslations('expenses.paymentMethods')
  const tStatuses = useTranslations('expenses.statuses')
  
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: '',
      category: 'office',
      amount: 0,
      currency: 'CHF',
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: null,
      supplier_id: null,
      supplier_name: '',
      receipt_url: '',
      receipt_number: '',
      tax_rate: 8.1,
      tax_amount: 0,
      is_deductible: true,
      status: 'pending',
      notes: '',
    }
  })

  const amount = watch('amount')
  const taxRate = watch('taxRate')
  const isDeductible = watch('is_deductible')

  useEffect(() => {
    if (open) {
      loadSuppliers()
    }
  }, [open])

  useEffect(() => {
    if (expense) {
      reset({
        description: expense.description,
        category: expense.category as any,
        amount: Number(expense.amount),
        currency: expense.currency,
        expense_date: expense.expense_date,
        payment_method: expense.payment_method as any,
        supplier_id: expense.supplier_id,
        supplier_name: expense.supplier_name || '',
        receipt_url: expense.receipt_url || '',
        receipt_number: expense.receipt_number || '',
        tax_rate: Number(expense.tax_rate),
        tax_amount: Number(expense.tax_amount),
        is_deductible: expense.is_deductible,
        status: expense.status as any,
        notes: expense.notes || '',
      })
    } else {
      reset({
        description: '',
        category: 'office',
        amount: 0,
        currency: 'CHF',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: null,
        supplier_id: null,
        supplier_name: '',
        receipt_url: '',
        receipt_number: '',
        tax_rate: 8.1,
        tax_amount: 0,
        is_deductible: true,
        status: 'pending',
        notes: '',
      })
    }
  }, [expense, reset])

  // Auto-calculate tax amount
  useEffect(() => {
    if (amount && taxRate) {
      const calculatedTax = (Number(amount) * Number(taxRate)) / 100
      setValue('tax_amount', Number(calculatedTax.toFixed(2)))
    }
  }, [amount, taxRate, setValue])

  async function loadSuppliers() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name')

    if (!error && data) {
      setSuppliers(data)
    }
  }

  const handleFormSubmit = async (data: ExpenseFormInput) => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      toast.error(tCommon('error') || 'Errore')
      setLoading(false)
      return
    }

    try {
      if (expense) {
        // Update existing expense
        const { error } = await supabase
          .from('expenses')
          .update({
            description: data.description,
            category: data.category,
            amount: data.amount,
            currency: data.currency,
            expense_date: data.expense_date,
            payment_method: data.payment_method,
            supplier_id: data.supplier_id,
            supplier_name: data.supplier_name,
            receipt_url: data.receipt_url,
            receipt_number: data.receipt_number,
            tax_rate: data.tax_rate,
            tax_amount: data.tax_amount,
            is_deductible: data.is_deductible,
            status: data.status,
            notes: data.notes,
          })
          .eq('id', expense.id)

        if (error) throw error
        toast.success(t('updateSuccess') || 'Spesa aggiornata con successo')
      } else {
        // Create new expense
        const { error } = await supabase
          .from('expenses')
          .insert({
            user_id: user.id,
            description: data.description,
            category: data.category,
            amount: data.amount,
            currency: data.currency,
            expense_date: data.expense_date,
            payment_method: data.payment_method,
            supplier_id: data.supplier_id,
            supplier_name: data.supplier_name,
            receipt_url: data.receipt_url,
            receipt_number: data.receipt_number,
            tax_rate: data.tax_rate,
            tax_amount: data.tax_amount,
            is_deductible: data.is_deductible,
            status: data.status,
            notes: data.notes,
          })

        if (error) throw error
        toast.success(t('createSuccess') || 'Spesa creata con successo')
      }

      onSuccess()
      onOpenChange(false)
      reset()
    } catch (error: any) {
      console.error('Error saving expense:', error)
      toast.error(expense ? t('updateError') : t('createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl md:text-2xl">
            {expense ? t('editExpense') : t('newExpense')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {expense
              ? t('updateSuccess')
              : t('noExpensesDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Sezione Informazioni Base */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {tCommon('info')}
            </h3>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  {t('description')} <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="description" 
                  {...register('description')} 
                  className="h-10"
                  placeholder={t('descriptionPlaceholder')}
                />
                {errors.description && (
                  <p className="text-xs text-red-500">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">
                  {t('category')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch('category')}
                  onValueChange={(value) => setValue('category', value as any)}
                >
                  <SelectTrigger id="category" className="h-10">
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {tCategories(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-red-500">{errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense_date" className="text-sm font-medium">
                  {t('expenseDate')} <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="expense_date" 
                  type="date"
                  {...register('expense_date')} 
                  className="h-10"
                />
                {errors.expense_date && (
                  <p className="text-xs text-red-500">{errors.expense_date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">
                  {t('amount')} <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="amount" 
                  type="number"
                  step="0.01"
                  {...register('amount', { valueAsNumber: true })} 
                  className="h-10"
                  placeholder="0.00"
                />
                {errors.amount && (
                  <p className="text-xs text-red-500">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method" className="text-sm font-medium">
                  {t('paymentMethod')}
                </Label>
                <Select
                  value={watch('payment_method') || undefined}
                  onValueChange={(value) => setValue('payment_method', value as any)}
                >
                  <SelectTrigger id="payment_method" className="h-10">
                    <SelectValue placeholder={t('selectPaymentMethod')} />
                  </SelectTrigger>
                  <SelectContent>
                    {expensePaymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {tPaymentMethods(method)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sezione Fornitore */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('supplier')}
            </h3>

            <div className="grid gap-4 grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="supplier_id" className="text-sm font-medium">
                  {t('selectSupplier')}
                </Label>
                <Select
                  value={watch('supplier_id') || undefined}
                  onValueChange={(value) => {
                    setValue('supplier_id', value || null)
                    // Clear supplier name when selecting from list
                    if (value) {
                      setValue('supplier_name', '')
                    }
                  }}
                >
                  <SelectTrigger id="supplier_id" className="h-10">
                    <SelectValue placeholder={t('selectSupplier')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!watch('supplier_id') && (
                <div className="space-y-2">
                  <Label htmlFor="supplier_name" className="text-sm font-medium">
                    {t('supplierName')}
                  </Label>
                  <Input 
                    id="supplier_name" 
                    {...register('supplier_name')} 
                    className="h-10"
                    placeholder={t('supplierNamePlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {tCommon('optional')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sezione Ricevuta e IVA */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {tCommon('details')}
            </h3>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="receipt_number" className="text-sm font-medium">
                  {t('receiptNumber')}
                </Label>
                <Input 
                  id="receipt_number" 
                  {...register('receipt_number')} 
                  className="h-10"
                  placeholder={t('receiptNumberPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_url" className="text-sm font-medium">
                  {t('receiptUrl')}
                </Label>
                <Input 
                  id="receipt_url" 
                  {...register('receipt_url')} 
                  className="h-10"
                  placeholder={t('receiptUrlPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_rate" className="text-sm font-medium">
                  {t('taxRate')}
                </Label>
                <Input 
                  id="tax_rate" 
                  type="number"
                  step="0.1"
                  {...register('tax_rate', { valueAsNumber: true })} 
                  className="h-10"
                  placeholder="8.1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_amount" className="text-sm font-medium">
                  {t('taxAmount')}
                </Label>
                <Input 
                  id="tax_amount" 
                  type="number"
                  step="0.01"
                  {...register('tax_amount', { valueAsNumber: true })} 
                  className="h-10 bg-muted"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  {tCommon('autoCalculated')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">
                  {tCommon('status')}
                </Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value as any)}
                >
                  <SelectTrigger id="status" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {tStatuses(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="is_deductible"
                  checked={isDeductible}
                  onCheckedChange={(checked) => setValue('is_deductible', checked)}
                />
                <Label htmlFor="is_deductible" className="text-sm font-medium cursor-pointer">
                  {t('isDeductible')}
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                {t('notes')}
              </Label>
              <Textarea 
                id="notes" 
                {...register('notes')} 
                className="min-h-[80px] resize-none"
                placeholder={t('notesPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon('loading') : (expense ? tCommon('save') : tCommon('create'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

