-- =====================================================
-- FACHTURA - EXPENSES MANAGEMENT SYSTEM
-- Migration: Add expenses table with proper schema and RLS
-- Date: 2025-01-11
-- =====================================================

-- =====================================================
-- 1. EXPENSES TABLE (Spese Aziendali)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Expense Information
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., "travel", "office", "meals", "equipment", "software", "marketing", "other"
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CHF',
    
    -- Date Information
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Payment Information
    payment_method TEXT, -- e.g., "cash", "card", "bank_transfer", "other"
    
    -- Supplier/Vendor (optional)
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT, -- For quick reference or when supplier is not in system
    
    -- Receipt Information
    receipt_url TEXT, -- URL to receipt image/document (if stored in Supabase Storage)
    receipt_number TEXT, -- Receipt/Invoice number from supplier
    
    -- Tax Information
    tax_rate NUMERIC DEFAULT 8.1, -- Swiss VAT default
    tax_amount NUMERIC DEFAULT 0,
    is_deductible BOOLEAN DEFAULT true, -- Whether expense is tax deductible
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    
    -- Additional Info
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    CONSTRAINT expenses_amount_positive CHECK (amount > 0),
    CONSTRAINT expenses_tax_rate_valid CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT expenses_tax_amount_positive CHECK (tax_amount >= 0),
    CONSTRAINT expenses_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT expenses_category_check CHECK (category IN ('travel', 'office', 'meals', 'equipment', 'software', 'marketing', 'utilities', 'insurance', 'professional_services', 'other'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier_id ON public.expenses(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON public.expenses(deleted_at);

COMMENT ON TABLE public.expenses IS 'Business expenses tracking and management';

-- =====================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own expenses
CREATE POLICY "Users can view own expenses"
    ON public.expenses
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Users can insert their own expenses
CREATE POLICY "Users can insert own expenses"
    ON public.expenses
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own expenses
CREATE POLICY "Users can update own expenses"
    ON public.expenses
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own expenses (soft delete)
CREATE POLICY "Users can delete own expenses"
    ON public.expenses
    FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- 3. TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER set_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. ADD EXPENSES TO SUBSCRIPTION LIMITS
-- =====================================================

-- Add max_expenses column to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_expenses INTEGER;

-- Update existing plans with expense limits
UPDATE public.subscription_plans
SET max_expenses = CASE
    WHEN name = 'Free' THEN 10
    WHEN name = 'Basic' THEN 50
    WHEN name = 'Pro' THEN 200
    WHEN name = 'Enterprise' THEN NULL -- unlimited
    ELSE NULL
END;

COMMENT ON COLUMN public.subscription_plans.max_expenses IS 'Maximum number of expenses per month (NULL = unlimited)';

-- =====================================================
-- 5. ADD EXPENSES TO USAGE TRACKING
-- =====================================================

-- Add expenses_count to usage_tracking
ALTER TABLE public.usage_tracking
ADD COLUMN IF NOT EXISTS expenses_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.usage_tracking.expenses_count IS 'Number of expenses created this period';

-- =====================================================
-- 6. UPDATE check_subscription_limits FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION check_subscription_limits(
  p_user_id UUID,
  p_resource_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_plan subscription_plans;
  v_usage usage_tracking;
  v_result JSONB;
  v_total_count INTEGER;
BEGIN
  -- Get user's current plan
  SELECT sp.* INTO v_plan
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing');
  
  -- If no subscription, use free plan
  IF v_plan IS NULL THEN
    SELECT * INTO v_plan
    FROM subscription_plans
    WHERE name = 'Free'
    LIMIT 1;
  END IF;
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND period_start = DATE_TRUNC('month', NOW())
  LIMIT 1;
  
  -- Check limits based on resource type
  v_result := jsonb_build_object(
    'allowed', true,
    'plan_name', v_plan.name,
    'resource_type', p_resource_type
  );
  
  IF p_resource_type = 'invoice' THEN
    IF v_plan.max_invoices IS NOT NULL AND COALESCE(v_usage.invoices_count, 0) >= v_plan.max_invoices THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', COALESCE(v_usage.invoices_count, 0),
        'max_count', v_plan.max_invoices,
        'message', 'Hai raggiunto il limite di fatture per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', COALESCE(v_usage.invoices_count, 0),
        'max_count', v_plan.max_invoices
      );
    END IF;
    
  ELSIF p_resource_type = 'quote' THEN
    IF v_plan.max_quotes IS NOT NULL AND COALESCE(v_usage.quotes_count, 0) >= v_plan.max_quotes THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', COALESCE(v_usage.quotes_count, 0),
        'max_count', v_plan.max_quotes,
        'message', 'Hai raggiunto il limite di preventivi per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', COALESCE(v_usage.quotes_count, 0),
        'max_count', v_plan.max_quotes
      );
    END IF;
    
  ELSIF p_resource_type = 'client' THEN
    -- Count total clients (not monthly)
    SELECT COUNT(*) INTO v_total_count
    FROM clients
    WHERE user_id = p_user_id
      AND deleted_at IS NULL;
    
    IF v_plan.max_clients IS NOT NULL AND v_total_count >= v_plan.max_clients THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', v_total_count,
        'max_count', v_plan.max_clients,
        'message', 'Hai raggiunto il limite di clienti. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', v_total_count,
        'max_count', v_plan.max_clients
      );
    END IF;
    
  ELSIF p_resource_type = 'product' THEN
    -- Count total products (not monthly)
    SELECT COUNT(*) INTO v_total_count
    FROM products
    WHERE user_id = p_user_id
      AND deleted_at IS NULL;
    
    IF v_plan.max_products IS NOT NULL AND v_total_count >= v_plan.max_products THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', v_total_count,
        'max_count', v_plan.max_products,
        'message', 'Hai raggiunto il limite di prodotti nel catalogo. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', v_total_count,
        'max_count', v_plan.max_products
      );
    END IF;
    
  ELSIF p_resource_type = 'order' THEN
    -- Count monthly orders
    IF v_plan.max_orders IS NOT NULL AND COALESCE(v_usage.orders_count, 0) >= v_plan.max_orders THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', COALESCE(v_usage.orders_count, 0),
        'max_count', v_plan.max_orders,
        'message', 'Hai raggiunto il limite di ordini per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', COALESCE(v_usage.orders_count, 0),
        'max_count', v_plan.max_orders
      );
    END IF;
    
  ELSIF p_resource_type = 'expense' THEN
    -- Count monthly expenses
    IF v_plan.max_expenses IS NOT NULL AND COALESCE(v_usage.expenses_count, 0) >= v_plan.max_expenses THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', COALESCE(v_usage.expenses_count, 0),
        'max_count', v_plan.max_expenses,
        'message', 'Hai raggiunto il limite di spese per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', COALESCE(v_usage.expenses_count, 0),
        'max_count', v_plan.max_expenses
      );
    END IF;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_subscription_limits(UUID, TEXT) IS 
  'Check subscription limits for invoice, quote, client, product, order, and expense resources.';

-- =====================================================
-- 7. UPDATE enforce_subscription_limits TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_subscription_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_resource_type TEXT;
  v_limits JSONB;
BEGIN
  -- Determine resource type based on table
  IF TG_TABLE_NAME = 'invoices' THEN
    v_resource_type := 'invoice';
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_resource_type := 'quote';
  ELSIF TG_TABLE_NAME = 'clients' THEN
    v_resource_type := 'client';
  ELSIF TG_TABLE_NAME = 'products' THEN
    v_resource_type := 'product';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_resource_type := 'order';
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_resource_type := 'expense';
  ELSE
    RETURN NEW;
  END IF;

  -- Check limits
  v_limits := check_subscription_limits(NEW.user_id, v_resource_type);

  -- If not allowed, raise exception
  IF NOT (v_limits->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', v_limits->>'message';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expenses table
DROP TRIGGER IF EXISTS enforce_expense_limits ON public.expenses;
CREATE TRIGGER enforce_expense_limits
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_subscription_limits();

-- =====================================================
-- 8. UPDATE track_resource_usage FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION track_resource_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_resource_type TEXT;
  v_period_start TIMESTAMPTZ;
BEGIN
  v_period_start := DATE_TRUNC('month', NOW());
  
  -- Determine resource type
  IF TG_TABLE_NAME = 'invoices' THEN
    v_resource_type := 'invoices';
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_resource_type := 'quotes';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_resource_type := 'orders';
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_resource_type := 'expenses';
  ELSE
    RETURN NEW;
  END IF;

  -- Insert or update usage tracking
  INSERT INTO usage_tracking (user_id, period_start, invoices_count, quotes_count, orders_count, expenses_count)
  VALUES (
    NEW.user_id,
    v_period_start,
    CASE WHEN v_resource_type = 'invoices' THEN 1 ELSE 0 END,
    CASE WHEN v_resource_type = 'quotes' THEN 1 ELSE 0 END,
    CASE WHEN v_resource_type = 'orders' THEN 1 ELSE 0 END,
    CASE WHEN v_resource_type = 'expenses' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    invoices_count = CASE WHEN v_resource_type = 'invoices' THEN usage_tracking.invoices_count + 1 ELSE usage_tracking.invoices_count END,
    quotes_count = CASE WHEN v_resource_type = 'quotes' THEN usage_tracking.quotes_count + 1 ELSE usage_tracking.quotes_count END,
    orders_count = CASE WHEN v_resource_type = 'orders' THEN usage_tracking.orders_count + 1 ELSE usage_tracking.orders_count END,
    expenses_count = CASE WHEN v_resource_type = 'expenses' THEN usage_tracking.expenses_count + 1 ELSE usage_tracking.expenses_count END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expenses table
DROP TRIGGER IF EXISTS track_expense_usage ON public.expenses;
CREATE TRIGGER track_expense_usage
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION track_resource_usage();

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

