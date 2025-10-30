import { z } from 'zod'

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Descrizione richiesta'),
  quantity: z.number().min(0.01, 'Quantità minima 0.01'),
  unit_price: z.number().min(0, 'Prezzo unitario richiesto'),
  tax_rate: z.number().min(0).max(100).default(8.1),
})

export const invoiceSchema = z.object({
  client_id: z.string().min(1, 'Cliente richiesto'),
  date: z.string(),
  due_date: z.string().optional(),
  status: z.enum(['draft', 'issued', 'paid', 'overdue']).default('draft'),
  items: z.array(invoiceItemSchema).min(1, 'Almeno un articolo richiesto'),
  notes: z.string().optional(),
})

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>
export type InvoiceInput = z.infer<typeof invoiceSchema>

