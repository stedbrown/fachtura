import { z } from 'zod'

export const companySettingsSchema = z.object({
  // Company info
  company_name: z.string().min(2, 'Nome azienda richiesto'),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  vat_number: z.string().optional(),
  iban: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  website: z.string().optional(),
  
  // Quote customization
  quote_default_notes: z.string().optional(),
  quote_terms_conditions: z.string().optional(),
  quote_default_validity_days: z.number().min(1).max(365).optional(),
  quote_footer_text: z.string().optional(),
  
  // Invoice customization
  invoice_default_notes: z.string().optional(),
  invoice_payment_terms: z.string().optional(),
  invoice_default_due_days: z.number().min(1).max(365).optional(),
  invoice_footer_text: z.string().optional(),
  
  // Payment info
  payment_methods: z.string().optional(),
  late_payment_fee: z.string().optional(),
})

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>

