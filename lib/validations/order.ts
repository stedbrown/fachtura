import { z } from 'zod'

export const orderItemSchema = z.object({
  product_id: z.string().optional(),
  description: z.string().min(1, 'Descrizione richiesta'),
  quantity: z.number().min(0.01, 'Quantità minima 0.01'),
  unit_price: z.number().min(0, 'Prezzo unitario richiesto'),
  tax_rate: z.number().min(0).max(100).default(8.1),
})

export const orderSchema = z.object({
  supplier_id: z.string().min(1, 'Fornitore richiesto'),
  date: z.string(),
  expected_delivery_date: z.string().optional(),
  status: z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled']).default('draft'),
  items: z.array(orderItemSchema).min(1, 'Almeno un articolo richiesto'),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
})

export type OrderItemInput = z.infer<typeof orderItemSchema>
export type OrderInput = z.infer<typeof orderSchema>

