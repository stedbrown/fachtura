-- ============================================
-- FIX: Usage Tracking RLS Policies
-- ============================================
-- Problem: Missing INSERT and UPDATE policies on usage_tracking table
-- Solution: Add policies to allow SECURITY DEFINER functions to manage usage_tracking

-- Add INSERT policy for usage_tracking
-- This allows the check_subscription_limits function (SECURITY DEFINER) to insert rows
CREATE POLICY "System can insert usage tracking"
  ON public.usage_tracking FOR INSERT
  WITH CHECK (true);

-- Add UPDATE policy for usage_tracking  
-- This allows the check_subscription_limits function (SECURITY DEFINER) to update rows
CREATE POLICY "System can update usage tracking"
  ON public.usage_tracking FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "System can insert usage tracking" ON public.usage_tracking IS
'Allows SECURITY DEFINER functions to insert usage tracking records';

COMMENT ON POLICY "System can update usage tracking" ON public.usage_tracking IS
'Allows SECURITY DEFINER functions to update usage tracking records';

