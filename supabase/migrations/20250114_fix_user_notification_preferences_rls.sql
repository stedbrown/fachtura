-- ============================================
-- FIX: RLS Policies Performance Issue
-- Date: 2025-01-14
-- ============================================
--
-- This migration fixes the auth_rls_initplan warning by replacing
-- auth.uid() with (select auth.uid()) in RLS policies to prevent
-- unnecessary re-evaluation for each row.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================
-- 1. DROP EXISTING POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.user_notification_preferences;

-- ============================================
-- 2. CREATE OPTIMIZED POLICIES
-- ============================================

-- SELECT policy - using (select auth.uid()) for better performance
CREATE POLICY "Users can view their own notification preferences"
  ON public.user_notification_preferences FOR SELECT
  USING ((select auth.uid()) = user_id);

-- UPDATE policy - using (select auth.uid()) for better performance
CREATE POLICY "Users can update their own notification preferences"
  ON public.user_notification_preferences FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- INSERT policy - using (select auth.uid()) for better performance
CREATE POLICY "Users can insert their own notification preferences"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can view their own notification preferences" ON public.user_notification_preferences IS
  'Allows users to view their own notification preferences. Optimized with (select auth.uid()) for better performance.';

COMMENT ON POLICY "Users can update their own notification preferences" ON public.user_notification_preferences IS
  'Allows users to update their own notification preferences. Optimized with (select auth.uid()) for better performance.';

COMMENT ON POLICY "Users can insert their own notification preferences" ON public.user_notification_preferences IS
  'Allows users to insert their own notification preferences. Optimized with (select auth.uid()) for better performance.';

