-- ============================================
-- FIX: Set immutable search_path for generate_product_sku
-- Security issue: function had mutable search_path
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_product_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public  -- ✅ FIX: Prevent schema injection
AS $$
DECLARE
  v_year_month TEXT;
  v_count INTEGER;
  v_new_sku TEXT;
BEGIN
  -- Only generate if SKU is NULL or empty
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    -- Get year-month (e.g., 202501)
    v_year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    -- Count products for this user in this month
    SELECT COUNT(*) + 1 INTO v_count
    FROM products
    WHERE user_id = NEW.user_id
      AND created_at >= DATE_TRUNC('month', NOW());
    
    -- Generate SKU: PRD-YYYYMM-XXX
    v_new_sku := 'PRD-' || v_year_month || '-' || LPAD(v_count::TEXT, 3, '0');
    
    -- Ensure uniqueness (in case of race conditions)
    WHILE EXISTS (SELECT 1 FROM products WHERE sku = v_new_sku AND user_id = NEW.user_id) LOOP
      v_count := v_count + 1;
      v_new_sku := 'PRD-' || v_year_month || '-' || LPAD(v_count::TEXT, 3, '0');
    END LOOP;
    
    NEW.sku := v_new_sku;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_product_sku() IS 
  'Auto-generates SKU for products if not provided. Format: PRD-YYYYMM-XXX. SECURITY: search_path fixed to prevent injection.';

