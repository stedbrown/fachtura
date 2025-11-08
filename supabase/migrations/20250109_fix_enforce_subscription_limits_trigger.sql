-- ============================================
-- FIX: enforce_subscription_limits trigger
-- PROBLEM: Expects BOOLEAN but check_subscription_limits returns JSONB now
-- SOLUTION: Update trigger to handle JSONB response
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_subscription_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_resource_type TEXT;
  v_limits_check JSONB;
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
  ELSE
    -- Unknown table, allow by default
    RETURN NEW;
  END IF;

  -- Check subscription limits (returns JSONB now, not BOOLEAN)
  v_limits_check := check_subscription_limits(NEW.user_id, v_resource_type);

  -- Extract 'allowed' field from JSONB response
  IF NOT COALESCE((v_limits_check->>'allowed')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Subscription limit reached for %. Please upgrade your plan. Current: %, Max: %', 
      v_resource_type,
      v_limits_check->>'current_count',
      v_limits_check->>'max_count'
    USING ERRCODE = '23505'; -- unique_violation code for easier client-side handling
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_subscription_limits() IS 
  'Enforces subscription limits on insert operations. Now handles JSONB response from check_subscription_limits.';

