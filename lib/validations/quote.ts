import { z } from 'zod'

export const quoteItemSchema = z.object({
  product_id: z.string().optional(),
  description: z.string().min(1, 'Descrizione richiesta'),
  quantity: z.number().min(0.01, 'Quantità minima 0.01'),
  unit_price: z.number().min(0, 'Prezzo unitario richiesto'),
  tax_rate: z.number().min(0).max(100).default(8.1),
})

export const quoteSchema = z.object({
  client_id: z.string().min(1, 'Cliente richiesto'),
  date: z.string(),
  valid_until: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).default('draft'),
  items: z.array(quoteItemSchema).min(1, 'Almeno un articolo richiesto'),
  notes: z.string().optional(),
})

export type QuoteItemInput = z.infer<typeof quoteItemSchema>
export type QuoteInput = z.infer<typeof quoteSchema>

