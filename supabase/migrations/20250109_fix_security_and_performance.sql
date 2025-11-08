-- ============================================
-- FIX SECURITY & PERFORMANCE ISSUES
-- Detected by Supabase Database Linter
-- ============================================

-- ============================================
-- 1. FIX: RLS PERFORMANCE OPTIMIZATION
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation per row
-- Affects: products, orders, order_items tables
-- ============================================

-- 1.1 PRODUCTS TABLE - Drop old policies
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;

-- 1.2 PRODUCTS TABLE - Create optimized policies
CREATE POLICY "Users can view their own products" ON public.products
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own products" ON public.products
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own products" ON public.products
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own products" ON public.products
  FOR DELETE USING ((select auth.uid()) = user_id);

-- 1.3 ORDERS TABLE - Drop old policies
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;

-- 1.4 ORDERS TABLE - Create optimized policies
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own orders" ON public.orders
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own orders" ON public.orders
  FOR DELETE USING ((select auth.uid()) = user_id);

-- 1.5 ORDER_ITEMS TABLE - Drop old policies
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can update their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete their own order items" ON public.order_items;

-- 1.6 ORDER_ITEMS TABLE - Create optimized policies
CREATE POLICY "Users can view their own order items" ON public.order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = (select auth.uid())
  ));

CREATE POLICY "Users can insert their own order items" ON public.order_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = (select auth.uid())
  ));

CREATE POLICY "Users can update their own order items" ON public.order_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = (select auth.uid())
  ));

CREATE POLICY "Users can delete their own order items" ON public.order_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = (select auth.uid())
  ));

-- ============================================
-- 2. FIX: FUNCTION SEARCH_PATH SECURITY
-- Set immutable search_path for update_updated_at_column
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ FIX: Prevent search_path injection
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS 
  'Automatically updates the updated_at column. Fixed: search_path set to prevent injection.';

-- ============================================
-- 3. FIX: SECURITY DEFINER VIEWS
-- Replace SECURITY DEFINER with SECURITY INVOKER
-- These views now use the querying user's permissions
-- ============================================

-- 3.1 Drop existing views
DROP VIEW IF EXISTS public.v_user_orders_summary;
DROP VIEW IF EXISTS public.v_user_active_products;

-- 3.2 Recreate v_user_orders_summary with SECURITY INVOKER
CREATE VIEW public.v_user_orders_summary
WITH (security_invoker = true)  -- ✅ FIX: Use querying user's permissions
AS
SELECT 
  o.user_id,
  COUNT(o.id) as total_orders,
  SUM(o.total) as total_value,
  COUNT(CASE WHEN o.status = 'draft' THEN 1 END) as draft_count,
  COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN o.status = 'processing' THEN 1 END) as processing_count,
  COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) as shipped_count,
  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_count,
  COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_count
FROM public.orders o
WHERE o.deleted_at IS NULL
GROUP BY o.user_id;

COMMENT ON VIEW public.v_user_orders_summary IS 
  'Summary of orders by user. Fixed: Uses SECURITY INVOKER to respect RLS.';

-- 3.3 Recreate v_user_active_products with SECURITY INVOKER
CREATE VIEW public.v_user_active_products
WITH (security_invoker = true)  -- ✅ FIX: Use querying user's permissions
AS
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.description,
  p.sku,
  p.category,
  p.unit_price,
  p.tax_rate,
  p.track_inventory,
  p.stock_quantity,
  p.low_stock_threshold,
  p.created_at,
  p.updated_at,
  CASE 
    WHEN p.track_inventory AND p.stock_quantity <= p.low_stock_threshold 
    THEN true 
    ELSE false 
  END as is_low_stock
FROM public.products p
WHERE p.is_active = true 
  AND p.deleted_at IS NULL;

COMMENT ON VIEW public.v_user_active_products IS 
  'Active products with low stock indicator. Fixed: Uses SECURITY INVOKER to respect RLS.';

-- ============================================
-- VERIFICATION
-- ============================================

COMMENT ON SCHEMA public IS 
  'Security & Performance fixes applied 2025-01-09:
  - RLS policies optimized (12 policies: products, orders, order_items)
  - Function search_path secured (update_updated_at_column)
  - Views changed from SECURITY DEFINER to SECURITY INVOKER (v_user_orders_summary, v_user_active_products)';

