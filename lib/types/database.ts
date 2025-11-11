export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      company_settings: {
        Row: {
          id: string
          user_id: string
          company_name: string
          address: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          vat_number: string | null
          iban: string | null
          logo_url: string | null
          created_at: string | null
          updated_at: string | null
          phone: string | null
          email: string | null
          website: string | null
          quote_default_notes: string | null
          quote_terms_conditions: string | null
          quote_default_validity_days: number | null
          quote_footer_text: string | null
          invoice_default_notes: string | null
          invoice_payment_terms: string | null
          invoice_default_due_days: number | null
          invoice_footer_text: string | null
          payment_methods: string | null
          late_payment_fee: string | null
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          vat_number?: string | null
          iban?: string | null
          logo_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          quote_default_notes?: string | null
          quote_terms_conditions?: string | null
          quote_default_validity_days?: number | null
          quote_footer_text?: string | null
          invoice_default_notes?: string | null
          invoice_payment_terms?: string | null
          invoice_default_due_days?: number | null
          invoice_footer_text?: string | null
          payment_methods?: string | null
          late_payment_fee?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          vat_number?: string | null
          iban?: string | null
          logo_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          quote_default_notes?: string | null
          quote_terms_conditions?: string | null
          quote_default_validity_days?: number | null
          quote_footer_text?: string | null
          invoice_default_notes?: string | null
          invoice_payment_terms?: string | null
          invoice_default_due_days?: number | null
          invoice_footer_text?: string | null
          payment_methods?: string | null
          late_payment_fee?: string | null
        }
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          client_id: string
          invoice_number: string
          date: string
          due_date: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          notes: string | null
          pdf_url: string | null
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          invoice_number: string
          date?: string
          due_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          pdf_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          invoice_number?: string
          date?: string
          due_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          pdf_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          line_total: number
          created_at: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          tax_rate?: number
          line_total: number
          created_at?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          line_total?: number
          created_at?: string | null
        }
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          client_id: string
          quote_number: string
          date: string
          valid_until: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          notes: string | null
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          quote_number: string
          date?: string
          valid_until?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          quote_number?: string
          date?: string
          valid_until?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          line_total: number
          created_at: string | null
        }
        Insert: {
          id?: string
          quote_id: string
          product_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          tax_rate?: number
          line_total: number
          created_at?: string | null
        }
        Update: {
          id?: string
          quote_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          line_total?: number
          created_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          entity_type: string | null
          entity_id: string | null
          is_read: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          entity_type?: string | null
          entity_id?: string | null
          is_read?: boolean
          created_at?: string | null
        }
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          sku: string | null
          category: string | null
          unit_price: number
          tax_rate: number
          track_inventory: boolean
          stock_quantity: number
          low_stock_threshold: number
          is_active: boolean
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          sku?: string | null
          category?: string | null
          unit_price?: number
          tax_rate?: number
          track_inventory?: boolean
          stock_quantity?: number
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          sku?: string | null
          category?: string | null
          unit_price?: number
          tax_rate?: number
          track_inventory?: boolean
          stock_quantity?: number
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          supplier_id: string
          order_number: string
          date: string
          expected_delivery_date: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          notes: string | null
          internal_notes: string | null
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          supplier_id: string
          order_number: string
          date?: string
          expected_delivery_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          internal_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          supplier_id?: string
          order_number?: string
          date?: string
          expected_delivery_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          internal_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          name: string
          contact_person: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          vat_number: string | null
          website: string | null
          payment_terms: string | null
          notes: string | null
          is_active: boolean
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          vat_number?: string | null
          website?: string | null
          payment_terms?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          vat_number?: string | null
          website?: string | null
          payment_terms?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          line_total: number
          created_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          tax_rate?: number
          line_total: number
          created_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          line_total?: number
          created_at?: string | null
        }
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          description: string
          category: string
          amount: number
          currency: string
          expense_date: string
          payment_method: string | null
          supplier_id: string | null
          supplier_name: string | null
          receipt_url: string | null
          receipt_number: string | null
          tax_rate: number
          tax_amount: number
          is_deductible: boolean
          status: string
          notes: string | null
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          category: string
          amount: number
          currency?: string
          expense_date?: string
          payment_method?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          receipt_url?: string | null
          receipt_number?: string | null
          tax_rate?: number
          tax_amount?: number
          is_deductible?: boolean
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          category?: string
          amount?: number
          currency?: string
          expense_date?: string
          payment_method?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          receipt_url?: string | null
          receipt_number?: string | null
          tax_rate?: number
          tax_amount?: number
          is_deductible?: boolean
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          stripe_price_id: string | null
          price: number
          currency: string
          interval: string
          max_invoices: number | null
          max_clients: number | null
          max_quotes: number | null
          max_products: number | null
          max_orders: number | null
          max_expenses: number | null
          features: Json
          is_active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          stripe_price_id?: string | null
          price?: number
          currency?: string
          interval?: string
          max_invoices?: number | null
          max_clients?: number | null
          max_quotes?: number | null
          max_products?: number | null
          max_orders?: number | null
          max_expenses?: number | null
          features?: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          stripe_price_id?: string | null
          price?: number
          currency?: string
          interval?: string
          max_invoices?: number | null
          max_clients?: number | null
          max_quotes?: number | null
          max_products?: number | null
          max_orders?: number | null
          max_expenses?: number | null
          features?: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string
          period_start: string
          period_end: string
          invoices_count: number
          quotes_count: number
          clients_count: number
          products_count: number
          orders_count: number
          expenses_count: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          period_start: string
          period_end: string
          invoices_count?: number
          quotes_count?: number
          clients_count?: number
          products_count?: number
          orders_count?: number
          expenses_count?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          period_start?: string
          period_end?: string
          invoices_count?: number
          quotes_count?: number
          clients_count?: number
          products_count?: number
          orders_count?: number
          expenses_count?: number
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_subscription_limits: {
        Args: {
          p_user_id: string
          p_resource_type: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update']

export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert']
export type InvoiceItemUpdate = Database['public']['Tables']['invoice_items']['Update']

export type Quote = Database['public']['Tables']['quotes']['Row']
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update']

export type QuoteItem = Database['public']['Tables']['quote_items']['Row']
export type QuoteItemInsert = Database['public']['Tables']['quote_items']['Insert']
export type QuoteItemUpdate = Database['public']['Tables']['quote_items']['Update']

export type CompanySettings = Database['public']['Tables']['company_settings']['Row']
export type CompanySettingsInsert = Database['public']['Tables']['company_settings']['Insert']
export type CompanySettingsUpdate = Database['public']['Tables']['company_settings']['Update']

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']
export type SubscriptionPlanInsert = Database['public']['Tables']['subscription_plans']['Insert']
export type SubscriptionPlanUpdate = Database['public']['Tables']['subscription_plans']['Update']

export type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row']
export type UserSubscriptionInsert = Database['public']['Tables']['user_subscriptions']['Insert']
export type UserSubscriptionUpdate = Database['public']['Tables']['user_subscriptions']['Update']

export type UsageTracking = Database['public']['Tables']['usage_tracking']['Row']
export type UsageTrackingInsert = Database['public']['Tables']['usage_tracking']['Insert']
export type UsageTrackingUpdate = Database['public']['Tables']['usage_tracking']['Update']

// Helper types for new tables
export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type Order = Database['public']['Tables']['orders']['Row']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']

export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']
export type OrderItemUpdate = Database['public']['Tables']['order_items']['Update']

// Types with relationships
export type InvoiceWithClient = Invoice & {
  client: Client
}

export type QuoteWithClient = Quote & {
  client: Client
}

export type OrderWithSupplier = Order & {
  supplier: Supplier
}

export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type SupplierInsert = Database['public']['Tables']['suppliers']['Insert']
export type SupplierUpdate = Database['public']['Tables']['suppliers']['Update']

export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']

// Expense with supplier relationship
export type ExpenseWithSupplier = Expense & {
  supplier: Supplier | null
}
