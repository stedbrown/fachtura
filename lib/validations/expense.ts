import { z } from 'zod'

export const expenseFormSchema = z.object({
  description: z.string().min(1, 'La descrizione è obbligatoria'),
  category: z.enum([
    'travel',
    'office',
    'meals',
    'equipment',
    'software',
    'marketing',
    'utilities',
    'insurance',
    'professional_services',
    'other',
  ], { required_error: 'La categoria è obbligatoria' }),
  amount: z.number().positive('L\'importo deve essere maggiore di zero'),
  currency: z.string().default('CHF'),
  expense_date: z.string().min(1, 'La data è obbligatoria'),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'other']).nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  receipt_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url('URL non valido').optional()
  ),
  receipt_number: z.string().nullable().optional(),
  tax_rate: z.number().min(0).max(100).default(8.1),
  tax_amount: z.number().min(0).default(0),
  is_deductible: z.boolean().default(true),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  notes: z.string().nullable().optional(),
})

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>

export const expenseCategories = [
  'travel',
  'office',
  'meals',
  'equipment',
  'software',
  'marketing',
  'utilities',
  'insurance',
  'professional_services',
  'other',
] as const

export const expensePaymentMethods = [
  'cash',
  'card',
  'bank_transfer',
  'other',
] as const

export const expenseStatuses = [
  'pending',
  'approved',
  'rejected',
] as const

