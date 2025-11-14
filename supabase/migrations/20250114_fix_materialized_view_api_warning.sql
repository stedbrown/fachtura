-- ============================================
-- FIX: Materialized View in API Warning
-- Date: 2025-01-14
-- Priority: 🟡 MEDIUM
-- ============================================
--
-- PROBLEM: The materialized view user_dashboard_stats is directly accessible
-- via the Data API, which triggers a security warning.
--
-- SOLUTION: Hide the view from the API and create a SECURITY DEFINER function
-- that acts as a wrapper. This way, the view is not exposed directly but
-- can still be accessed through the function.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api

-- ============================================
-- 1. REVOKE DIRECT ACCESS TO VIEW
-- ============================================
-- Remove direct SELECT permission from authenticated role
REVOKE SELECT ON public.user_dashboard_stats FROM authenticated;
REVOKE SELECT ON public.user_dashboard_stats FROM anon;

-- ============================================
-- 2. CREATE SECURE FUNCTION WRAPPER
-- ============================================
-- Create a function that returns the stats for the current user
-- This function will be accessible via RPC, not direct table access
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats()
RETURNS TABLE (
  user_id UUID,
  clients_count BIGINT,
  total_quotes BIGINT,
  quotes_draft BIGINT,
  quotes_sent BIGINT,
  quotes_accepted BIGINT,
  quotes_rejected BIGINT,
  total_invoices BIGINT,
  invoices_draft BIGINT,
  invoices_issued BIGINT,
  invoices_paid BIGINT,
  invoices_overdue BIGINT,
  total_revenue NUMERIC,
  current_month_revenue NUMERIC,
  previous_month_revenue NUMERIC,
  overdue_total NUMERIC,
  products_count BIGINT,
  total_orders BIGINT,
  suppliers_count BIGINT,
  expenses_count BIGINT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Return stats for the current authenticated user only
  RETURN QUERY
  SELECT 
    s.user_id,
    s.clients_count,
    s.total_quotes,
    s.quotes_draft,
    s.quotes_sent,
    s.quotes_accepted,
    s.quotes_rejected,
    s.total_invoices,
    s.invoices_draft,
    s.invoices_issued,
    s.invoices_paid,
    s.invoices_overdue,
    s.total_revenue,
    s.current_month_revenue,
    s.previous_month_revenue,
    s.overdue_total,
    s.products_count,
    s.total_orders,
    s.suppliers_count,
    s.expenses_count,
    s.last_updated
  FROM public.user_dashboard_stats s
  WHERE s.user_id = auth.uid();
END;
$$;

-- ============================================
-- 3. GRANT EXECUTE ON FUNCTION
-- ============================================
-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats() TO authenticated;

-- ============================================
-- 4. ADD COMMENTS
-- ============================================
COMMENT ON FUNCTION public.get_user_dashboard_stats() IS 
  'Returns dashboard statistics for the current authenticated user. SECURITY: View is not directly exposed via API.';

-- ============================================
-- VERIFICATION
-- ============================================
-- After applying this migration:
-- 1. The view user_dashboard_stats should NOT be accessible via API
-- 2. The function get_user_dashboard_stats() should be callable via RPC
-- 3. Test with: SELECT * FROM get_user_dashboard_stats();

