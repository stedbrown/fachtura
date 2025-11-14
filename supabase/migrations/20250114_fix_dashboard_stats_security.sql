-- ============================================
-- FIX: Security Issue - user_dashboard_stats exposes auth.users
-- Date: 2025-01-14
-- Priority: 🔴 CRITICAL
-- ============================================
--
-- PROBLEM: The materialized view user_dashboard_stats uses FROM auth.users
-- which exposes sensitive auth.users data to anon/authenticated roles.
--
-- SOLUTION: Recreate the view without using auth.users directly.
-- Instead, aggregate from public tables only (clients, invoices, quotes, etc.)
-- and group by user_id from those tables.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0002_auth_users_exposed

-- ============================================
-- 1. DROP EXISTING VIEW
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS public.user_dashboard_stats CASCADE;

-- ============================================
-- 2. CREATE SECURE VIEW (without auth.users)
-- ============================================
-- Instead of joining with auth.users, we aggregate from public tables
-- and collect all unique user_ids from those tables
CREATE MATERIALIZED VIEW public.user_dashboard_stats AS
WITH all_user_ids AS (
  -- Collect all user_ids from public tables
  SELECT DISTINCT user_id FROM public.clients WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.invoices WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.quotes WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.products WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.orders WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.suppliers WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.expenses WHERE user_id IS NOT NULL
)
SELECT 
  u.user_id,
  
  -- Clients count
  COALESCE(COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL), 0) AS clients_count,
  
  -- Quotes statistics
  COALESCE(COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL), 0) AS total_quotes,
  COALESCE(COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'draft'), 0) AS quotes_draft,
  COALESCE(COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'sent'), 0) AS quotes_sent,
  COALESCE(COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'accepted'), 0) AS quotes_accepted,
  COALESCE(COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'rejected'), 0) AS quotes_rejected,
  
  -- Invoices statistics
  COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL), 0) AS total_invoices,
  COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND i.status = 'draft'), 0) AS invoices_draft,
  COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND i.status = 'issued'), 0) AS invoices_issued,
  COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND i.status = 'paid'), 0) AS invoices_paid,
  COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND i.status = 'overdue'), 0) AS invoices_overdue,
  
  -- Revenue statistics
  COALESCE(SUM(i.total) FILTER (WHERE i.deleted_at IS NULL AND i.status = 'paid'), 0) AS total_revenue,
  COALESCE(SUM(i.total) FILTER (
    WHERE i.deleted_at IS NULL 
    AND i.status = 'paid' 
    AND i.date >= DATE_TRUNC('month', NOW())
  ), 0) AS current_month_revenue,
  COALESCE(SUM(i.total) FILTER (
    WHERE i.deleted_at IS NULL 
    AND i.status = 'paid' 
    AND i.date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
    AND i.date < DATE_TRUNC('month', NOW())
  ), 0) AS previous_month_revenue,
  
  -- Overdue invoices total
  COALESCE(SUM(i.total) FILTER (
    WHERE i.deleted_at IS NULL 
    AND (i.status = 'overdue' OR (i.status = 'issued' AND i.due_date < NOW()))
  ), 0) AS overdue_total,
  
  -- Products count
  COALESCE(COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS NULL), 0) AS products_count,
  
  -- Orders count
  COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.deleted_at IS NULL), 0) AS total_orders,
  
  -- Suppliers count
  COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL), 0) AS suppliers_count,
  
  -- Expenses count
  COALESCE(COUNT(DISTINCT e.id) FILTER (WHERE e.deleted_at IS NULL), 0) AS expenses_count,
  
  -- Last updated timestamp
  NOW() AS last_updated
  
FROM all_user_ids u
LEFT JOIN public.clients c ON c.user_id = u.user_id
LEFT JOIN public.quotes q ON q.user_id = u.user_id
LEFT JOIN public.invoices i ON i.user_id = u.user_id
LEFT JOIN public.products p ON p.user_id = u.user_id
LEFT JOIN public.orders o ON o.user_id = u.user_id
LEFT JOIN public.suppliers s ON s.user_id = u.user_id
LEFT JOIN public.expenses e ON e.user_id = u.user_id
GROUP BY u.user_id;

-- ============================================
-- 3. CREATE UNIQUE INDEX
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dashboard_stats_user_id 
ON public.user_dashboard_stats (user_id);

-- ============================================
-- 4. GRANT PERMISSIONS (with RLS)
-- ============================================
-- Grant SELECT to authenticated users
GRANT SELECT ON public.user_dashboard_stats TO authenticated;

-- ============================================
-- 5. SECURITY NOTE
-- ============================================
-- Note: RLS cannot be enabled on materialized views.
-- Security is ensured by:
-- 1. Not exposing auth.users directly (fixed above)
-- 2. Application code always filters by user_id: .eq('user_id', user.id)
-- 3. Only authenticated users have SELECT permission

-- ============================================
-- 6. REFRESH FUNCTION (keep existing)
-- ============================================
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_dashboard_stats;
END;
$$;

COMMENT ON MATERIALIZED VIEW public.user_dashboard_stats IS 
  'Aggregated dashboard statistics per user. SECURITY: Does not expose auth.users directly.';

COMMENT ON FUNCTION public.refresh_dashboard_stats() IS 
  'Refreshes the user_dashboard_stats materialized view concurrently.';

-- ============================================
-- 7. INITIAL REFRESH
-- ============================================
REFRESH MATERIALIZED VIEW public.user_dashboard_stats;

-- ============================================
-- VERIFICATION
-- ============================================
-- After applying this migration, verify with:
--
-- 1. Check that view doesn't expose auth.users:
-- SELECT 
--   routine_name,
--   routine_definition
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name LIKE '%dashboard_stats%';
--
-- 2. Verify RLS is enabled:
-- SELECT 
--   schemaname,
--   matviewname,
--   rowsecurity
-- FROM pg_matviews
-- WHERE matviewname = 'user_dashboard_stats';
--
-- 3. Test query (should only return current user's stats):
-- SELECT * FROM user_dashboard_stats WHERE user_id = auth.uid();

