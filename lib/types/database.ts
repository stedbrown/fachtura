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
