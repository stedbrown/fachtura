-- =====================================================
-- TRANSFORM ORDERS TO SUPPLIER ORDERS
-- =====================================================
-- This migration transforms customer orders into supplier/purchase orders

-- =====================================================
-- 1. CREATE SUPPLIERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Supplier Information
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    
    -- Address
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT,
    
    -- Business Info
    vat_number TEXT,
    website TEXT,
    
    -- Payment Terms
    payment_terms TEXT, -- es. "30 giorni", "60 giorni"
    
    -- Additional Info
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    CONSTRAINT suppliers_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON public.suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON public.suppliers(deleted_at);

COMMENT ON TABLE public.suppliers IS 'Suppliers/Vendors management for purchase orders';

-- =====================================================
-- 2. ADD supplier_id TO ORDERS & DROP client_id
-- =====================================================

-- Step 1: Add new supplier_id column (nullable temporarily)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE;

-- Step 2: Drop old client_id constraint and column
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_client_id_fkey;

ALTER TABLE public.orders 
DROP COLUMN IF EXISTS client_id;

-- Step 3: Make supplier_id NOT NULL after data migration
-- (we'll handle this after populating data)

-- Step 4: Update order status values for supplier orders
-- Drop old constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint for supplier order statuses
ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled'));

-- Update comment
COMMENT ON TABLE public.orders IS 'Purchase orders to suppliers/vendors';
COMMENT ON COLUMN public.orders.order_number IS 'Purchase order number (e.g., PO-2025-001)';
COMMENT ON COLUMN public.orders.status IS 'Order status: draft | ordered | partial | received | cancelled';
COMMENT ON COLUMN public.orders.expected_delivery_date IS 'Expected delivery date from supplier';

-- =====================================================
-- 3. UPDATE TRIGGERS
-- =====================================================

-- Update updated_at trigger for suppliers
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) - SUPPLIERS
-- =====================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own suppliers
CREATE POLICY "Users can view own suppliers"
    ON public.suppliers
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own suppliers
CREATE POLICY "Users can insert own suppliers"
    ON public.suppliers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own suppliers
CREATE POLICY "Users can update own suppliers"
    ON public.suppliers
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own suppliers (soft delete)
CREATE POLICY "Users can delete own suppliers"
    ON public.suppliers
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 5. ADD SUPPLIERS TO SUBSCRIPTION LIMITS
-- =====================================================

-- Add max_suppliers column to subscription_plans
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS max_suppliers INTEGER;

-- Update existing plans
UPDATE public.subscription_plans SET max_suppliers = 5 WHERE name = 'Free';
UPDATE public.subscription_plans SET max_suppliers = 50 WHERE name = 'Starter';
UPDATE public.subscription_plans SET max_suppliers = NULL WHERE name = 'Business'; -- unlimited
UPDATE public.subscription_plans SET max_suppliers = NULL WHERE name = 'Enterprise'; -- unlimited

-- Add suppliers_count to usage_tracking
ALTER TABLE public.usage_tracking
ADD COLUMN IF NOT EXISTS suppliers_count INTEGER DEFAULT 0;

-- =====================================================
-- 6. UPDATE check_subscription_limits FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_subscription_limits(
  p_user_id UUID,
  p_resource_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_usage usage_tracking%ROWTYPE;
  v_invoices_count INTEGER;
  v_quotes_count INTEGER;
  v_clients_count INTEGER;
  v_products_count INTEGER;
  v_orders_count INTEGER;
  v_suppliers_count INTEGER;
  v_max_count INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Get user's subscription plan
  SELECT sp.* INTO v_plan
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no active subscription, use Free plan
  IF v_plan IS NULL THEN
    SELECT * INTO v_plan
    FROM subscription_plans
    WHERE name = 'Free'
    LIMIT 1;
  END IF;
  
  -- Get or create current usage (CRITICAL FIX)
  SELECT * INTO v_usage
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND period_start = DATE_TRUNC('month', NOW())
  LIMIT 1;
  
  -- If usage tracking doesn't exist, create it (CRITICAL FIX)
  IF v_usage IS NULL THEN
    INSERT INTO usage_tracking (
      user_id,
      period_start,
      period_end,
      invoices_count,
      quotes_count,
      clients_count,
      products_count,
      orders_count,
      suppliers_count
    ) VALUES (
      p_user_id,
      DATE_TRUNC('month', NOW()),
      DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
      0, 0, 0, 0, 0, 0
    )
    ON CONFLICT (user_id, period_start) DO NOTHING
    RETURNING * INTO v_usage;
    
    -- If still NULL (race condition), try again
    IF v_usage IS NULL THEN
      SELECT * INTO v_usage
      FROM usage_tracking
      WHERE user_id = p_user_id
        AND period_start = DATE_TRUNC('month', NOW())
      LIMIT 1;
    END IF;
  END IF;
  
  -- Extract counts with COALESCE (CRITICAL FIX)
  v_invoices_count := COALESCE(v_usage.invoices_count, 0);
  v_quotes_count := COALESCE(v_usage.quotes_count, 0);
  v_clients_count := COALESCE(v_usage.clients_count, 0);
  v_products_count := COALESCE(v_usage.products_count, 0);
  v_orders_count := COALESCE(v_usage.orders_count, 0);
  v_suppliers_count := COALESCE(v_usage.suppliers_count, 0);
  
  -- Check limits based on resource type
  CASE p_resource_type
    WHEN 'invoice' THEN
      v_max_count := v_plan.max_invoices;
      v_current_count := v_invoices_count;
    WHEN 'quote' THEN
      v_max_count := v_plan.max_quotes;
      v_current_count := v_quotes_count;
    WHEN 'client' THEN
      v_max_count := v_plan.max_clients;
      v_current_count := v_clients_count;
    WHEN 'product' THEN
      v_max_count := v_plan.max_products;
      v_current_count := v_products_count;
    WHEN 'order' THEN
      v_max_count := v_plan.max_orders;
      v_current_count := v_orders_count;
    WHEN 'supplier' THEN
      v_max_count := v_plan.max_suppliers;
      v_current_count := v_suppliers_count;
    ELSE
      RAISE EXCEPTION 'Unknown resource type: %', p_resource_type;
  END CASE;
  
  -- Return result as JSONB
  RETURN jsonb_build_object(
    'allowed', (v_max_count IS NULL OR v_current_count < v_max_count),
    'current_count', v_current_count,
    'max_count', v_max_count,
    'plan_name', v_plan.name
  );
END;
$$;

-- =====================================================
-- 7. UPDATE enforce_subscription_limits TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_subscription_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits_check JSONB;
  v_resource_type TEXT;
BEGIN
  -- Determine resource type based on table name
  IF TG_TABLE_NAME = 'clients' THEN
    v_resource_type := 'client';
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_resource_type := 'invoice';
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_resource_type := 'quote';
  ELSIF TG_TABLE_NAME = 'products' THEN
    v_resource_type := 'product';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_resource_type := 'order';
  ELSIF TG_TABLE_NAME = 'suppliers' THEN
    v_resource_type := 'supplier';
  ELSE
    RAISE EXCEPTION 'Unknown resource type for table %', TG_TABLE_NAME;
  END IF;

  -- Call the check_subscription_limits function
  v_limits_check := public.check_subscription_limits(NEW.user_id, v_resource_type);

  -- Check if allowed (extract boolean from JSONB)
  IF NOT (v_limits_check->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'Subscription limit reached for %: current % / max % (Plan: %)',
      v_resource_type,
      (v_limits_check->>'current_count')::TEXT,
      COALESCE((v_limits_check->>'max_count')::TEXT, 'unlimited'),
      v_limits_check->>'plan_name';
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger for suppliers
DROP TRIGGER IF EXISTS enforce_supplier_limits ON public.suppliers;
CREATE TRIGGER enforce_supplier_limits
BEFORE INSERT ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_limits();

-- =====================================================
-- 8. CREATE USAGE TRACKING TRIGGERS FOR SUPPLIERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_suppliers_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO usage_tracking (
    user_id,
    period_start,
    period_end,
    suppliers_count
  ) VALUES (
    NEW.user_id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
    1
  )
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET suppliers_count = usage_tracking.suppliers_count + 1;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_increment_suppliers_usage ON public.suppliers;
CREATE TRIGGER trigger_increment_suppliers_usage
AFTER INSERT ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.increment_suppliers_usage();

-- =====================================================
-- 9. CREATE VIEW FOR USER SUPPLIERS
-- =====================================================

CREATE OR REPLACE VIEW public.v_user_suppliers_summary AS
SELECT 
  s.user_id,
  COUNT(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL) as active_suppliers,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'ordered') as pending_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('ordered', 'partial')), 0) as pending_orders_value
FROM public.suppliers s
LEFT JOIN public.orders o ON s.id = o.supplier_id AND o.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.user_id
WITH (security_invoker = true);

COMMENT ON VIEW public.v_user_suppliers_summary IS 'Summary of suppliers and orders per user';

