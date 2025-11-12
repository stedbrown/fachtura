-- ============================================
-- FIX: track_resource_usage - Add period_end
-- ============================================
-- Problem: INSERT into usage_tracking missing period_end field (NOT NULL constraint)
-- Solution: Update function to include period_end in INSERT

CREATE OR REPLACE FUNCTION track_resource_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_resource_type TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_period_start := DATE_TRUNC('month', NOW());
  v_period_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second');
  
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

  -- Insert or update usage tracking (now includes period_end)
  INSERT INTO usage_tracking (
    user_id, 
    period_start, 
    period_end,
    invoices_count, 
    quotes_count, 
    orders_count, 
    expenses_count
  )
  VALUES (
    NEW.user_id,
    v_period_start,
    v_period_end,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION track_resource_usage() IS
'Tracks resource usage for subscription limits. Includes period_end to satisfy NOT NULL constraint.';

