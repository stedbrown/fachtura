-- ============================================
-- FIX: check_subscription_limits - handle missing usage_tracking
-- PROBLEM: If no usage_tracking row exists, the function fails
-- SOLUTION: Auto-create usage_tracking + use COALESCE properly
-- ============================================

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
  v_plan subscription_plans;
  v_usage usage_tracking;
  v_result JSONB;
  v_total_count INTEGER;
  v_invoices_count INTEGER := 0;
  v_quotes_count INTEGER := 0;
  v_orders_count INTEGER := 0;
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
      orders_count
    ) VALUES (
      p_user_id,
      DATE_TRUNC('month', NOW()),
      DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day',
      0, 0, 0, 0, 0
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
  v_orders_count := COALESCE(v_usage.orders_count, 0);
  
  -- Check limits based on resource type
  v_result := jsonb_build_object(
    'allowed', true,
    'plan_name', v_plan.name,
    'resource_type', p_resource_type
  );
  
  IF p_resource_type = 'invoice' THEN
    IF v_plan.max_invoices IS NOT NULL AND v_invoices_count >= v_plan.max_invoices THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', v_invoices_count,
        'max_count', v_plan.max_invoices,
        'message', 'Hai raggiunto il limite di fatture per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', v_invoices_count,
        'max_count', v_plan.max_invoices
      );
    END IF;
    
  ELSIF p_resource_type = 'quote' THEN
    IF v_plan.max_quotes IS NOT NULL AND v_quotes_count >= v_plan.max_quotes THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', v_quotes_count,
        'max_count', v_plan.max_quotes,
        'message', 'Hai raggiunto il limite di preventivi per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', v_quotes_count,
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
    IF v_plan.max_orders IS NOT NULL AND v_orders_count >= v_plan.max_orders THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', v_orders_count,
        'max_count', v_plan.max_orders,
        'message', 'Hai raggiunto il limite di ordini per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', v_orders_count,
        'max_count', v_plan.max_orders
      );
    END IF;
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_subscription_limits(UUID, TEXT) IS 
  'Check subscription limits. Auto-creates usage_tracking if missing. Returns JSONB with allowed, current_count, max_count.';

