import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(1, 'Nome prodotto richiesto'),
  description: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit_price: z.number().min(0, 'Prezzo unitario richiesto'),
  tax_rate: z.number().min(0).max(100).default(8.1),
  track_inventory: z.boolean().default(false),
  stock_quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  is_active: z.boolean().default(true),
})

export type ProductInput = z.infer<typeof productSchema>

