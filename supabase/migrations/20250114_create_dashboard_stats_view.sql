-- ============================================
-- CREATE MATERIALIZED VIEW FOR DASHBOARD STATS
-- Optimizes dashboard page by aggregating all stats in one query
-- Date: 2025-01-14
-- ============================================

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS user_dashboard_stats;

-- Create materialized view with all dashboard statistics
CREATE MATERIALIZED VIEW user_dashboard_stats AS
SELECT 
  u.id as user_id,
  
  -- Clients count
  COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL) as clients_count,
  
  -- Quotes statistics
  COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL) as total_quotes,
  COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'draft') as quotes_draft,
  COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'sent') as quotes_sent,
  COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'accepted') as quotes_accepted,
  COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL AND q.status = 'rejected') as quotes_rejected,
  
  -- Invoices statistics
  COUNT(DISTINCT inv.id) FILTER (WHERE inv.deleted_at IS NULL) as total_invoices,
  COUNT(DISTINCT inv.id) FILTER (WHERE inv.deleted_at IS NULL AND inv.status = 'draft') as invoices_draft,
  COUNT(DISTINCT inv.id) FILTER (WHERE inv.deleted_at IS NULL AND inv.status = 'issued') as invoices_issued,
  COUNT(DISTINCT inv.id) FILTER (WHERE inv.deleted_at IS NULL AND inv.status = 'paid') as invoices_paid,
  COUNT(DISTINCT inv.id) FILTER (WHERE inv.deleted_at IS NULL AND inv.status = 'overdue') as invoices_overdue,
  
  -- Revenue statistics
  COALESCE(SUM(inv.total) FILTER (WHERE inv.deleted_at IS NULL AND inv.status = 'paid'), 0) as total_revenue,
  COALESCE(SUM(inv.total) FILTER (
    WHERE inv.deleted_at IS NULL 
    AND inv.status = 'paid' 
    AND inv.date >= DATE_TRUNC('month', NOW())
  ), 0) as current_month_revenue,
  COALESCE(SUM(inv.total) FILTER (
    WHERE inv.deleted_at IS NULL 
    AND inv.status = 'paid' 
    AND inv.date >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
    AND inv.date < DATE_TRUNC('month', NOW())
  ), 0) as previous_month_revenue,
  
  -- Overdue invoices total
  COALESCE(SUM(inv.total) FILTER (
    WHERE inv.deleted_at IS NULL 
    AND (inv.status = 'overdue' OR (inv.status = 'issued' AND inv.due_date < NOW()))
  ), 0) as overdue_total,
  
  -- Last updated timestamp
  NOW() as last_updated
  
FROM auth.users u
LEFT JOIN clients c ON c.user_id = u.id
LEFT JOIN quotes q ON q.user_id = u.id
LEFT JOIN invoices inv ON inv.user_id = u.id
GROUP BY u.id;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_user_dashboard_stats_user_id ON user_dashboard_stats(user_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
END;
$$;

COMMENT ON MATERIALIZED VIEW user_dashboard_stats IS 
  'Aggregated dashboard statistics for all users. Refresh with refresh_dashboard_stats() function.';

COMMENT ON FUNCTION refresh_dashboard_stats() IS 
  'Refreshes the dashboard stats materialized view. Can be called via cron or trigger.';

-- Grant access to authenticated users
GRANT SELECT ON user_dashboard_stats TO authenticated;

-- Create trigger to auto-refresh on invoice/quote/client changes
-- Note: This is a simple approach. For production, consider using pg_cron for scheduled refreshes
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Refresh stats for the affected user
  -- Note: CONCURRENTLY requires unique index (which we have)
  -- For better performance, you might want to debounce this or use pg_cron
  PERFORM refresh_dashboard_stats();
  RETURN NEW;
END;
$$;

-- Create triggers (optional - can be heavy on high traffic)
-- Uncomment if you want real-time stats (may impact performance)
-- DROP TRIGGER IF EXISTS refresh_stats_on_invoice_change ON invoices;
-- CREATE TRIGGER refresh_stats_on_invoice_change
--   AFTER INSERT OR UPDATE OR DELETE ON invoices
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_refresh_dashboard_stats();
--
-- DROP TRIGGER IF EXISTS refresh_stats_on_quote_change ON quotes;
-- CREATE TRIGGER refresh_stats_on_quote_change
--   AFTER INSERT OR UPDATE OR DELETE ON quotes
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_refresh_dashboard_stats();
--
-- DROP TRIGGER IF EXISTS refresh_stats_on_client_change ON clients;
-- CREATE TRIGGER refresh_stats_on_client_change
--   AFTER INSERT OR UPDATE OR DELETE ON clients
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_refresh_dashboard_stats();

