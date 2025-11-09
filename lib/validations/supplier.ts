import { z } from 'zod'

export const supplierSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(255),
  contact_person: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  vat_number: z.string().optional(),
  website: z.string().url('URL non valido').optional().or(z.literal('')),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type SupplierInput = z.infer<typeof supplierSchema>

