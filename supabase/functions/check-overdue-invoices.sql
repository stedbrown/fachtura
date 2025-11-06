-- Function to check and update overdue invoices
-- This should be called periodically (e.g., daily via cron or edge function)

CREATE OR REPLACE FUNCTION check_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Update invoices that are past due and not paid/cancelled
  UPDATE invoices
  SET status = 'overdue'
  WHERE status IN ('issued')
    AND due_date < CURRENT_DATE
    AND deleted_at IS NULL;
  
  -- Note: The trigger will automatically create notifications for status changes
END;
$$;

COMMENT ON FUNCTION check_overdue_invoices() IS 'Automatically marks issued invoices as overdue when past their due date. Should be run daily via scheduled job.';

-- Example: To manually run this function
-- SELECT check_overdue_invoices();

-- Future enhancement: Set up a pg_cron job to run this daily
-- SELECT cron.schedule(
--   'check-overdue-invoices',
--   '0 0 * * *',  -- Run daily at midnight
--   'SELECT check_overdue_invoices();'
-- );

