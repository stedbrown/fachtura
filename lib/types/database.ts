export interface CompanySettings {
  id: string
  user_id: string
  company_name: string
  address?: string
  city?: string
  postal_code?: string
  country?: string
  vat_number?: string
  iban?: string
  phone?: string
  email?: string
  website?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  postal_code?: string
  country?: string
  deleted_at?: string
  created_at: string
  updated_at: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

export interface Quote {
  id: string
  user_id: string
  client_id: string
  quote_number: string
  date: string
  valid_until?: string
  status: QuoteStatus
  subtotal: number
  tax_amount: number
  total: number
  notes?: string
  deleted_at?: string
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
  created_at: string
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue'

export interface Invoice {
  id: string
  user_id: string
  client_id: string
  invoice_number: string
  date: string
  due_date?: string
  status: InvoiceStatus
  subtotal: number
  tax_amount: number
  total: number
  notes?: string
  pdf_url?: string
  deleted_at?: string
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
  created_at: string
}

// Extended types with relations
export interface QuoteWithClient extends Quote {
  client: Client
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[]
}

export interface QuoteComplete extends Quote {
  client: Client
  items: QuoteItem[]
}

export interface InvoiceWithClient extends Invoice {
  client: Client
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
}

export interface InvoiceComplete extends Invoice {
  client: Client
  items: InvoiceItem[]
}

