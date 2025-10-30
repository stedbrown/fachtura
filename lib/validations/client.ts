import { z } from 'zod'

export const clientSchema = z.object({
  name: z.string().min(2, 'Nome richiesto'),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
})

export type ClientInput = z.infer<typeof clientSchema>

