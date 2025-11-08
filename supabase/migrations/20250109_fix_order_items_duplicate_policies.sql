-- ============================================
-- FIX: Remove duplicate RLS policies on order_items
-- The original migration created duplicate policies
-- ============================================

-- Drop the old policies from the original Products & Orders migration
DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can update order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete order items for their orders" ON public.order_items;

-- Keep only the optimized ones (already created)
COMMENT ON TABLE public.order_items IS 'Line items for customer orders. RLS policies optimized for performance.';

