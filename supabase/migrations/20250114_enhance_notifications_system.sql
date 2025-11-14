-- ============================================
-- ENHANCE NOTIFICATIONS SYSTEM - Enterprise SaaS Level
-- Date: 2025-01-14
-- Priority: 🟡 HIGH
-- ============================================
--
-- This migration enhances the notification system with:
-- 1. Priority levels (urgent, high, medium, low)
-- 2. Notification channels (in_app, email, push)
-- 3. User preferences table
-- 4. Extended notification types
-- 5. Metadata field for additional data
-- 6. Action buttons/links
-- 7. Expiration dates
--
-- Reference: Best practices for SaaS notification systems

-- ============================================
-- 1. ADD NEW COLUMNS TO NOTIFICATIONS TABLE
-- ============================================

-- Add priority column
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' 
CHECK (priority IN ('urgent', 'high', 'medium', 'low'));

-- Add channels (JSONB array: ['in_app', 'email', 'push'])
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '["in_app"]'::jsonb;

-- Add metadata for additional data (JSONB)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add action URL (optional link to navigate to)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Add action label (text for action button)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS action_label TEXT;

-- Add expiration date (for time-sensitive notifications)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add archived flag (soft delete for old notifications)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add read_at timestamp
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ============================================
-- 2. EXTEND NOTIFICATION TYPES
-- ============================================

-- Drop old constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with extended types
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  -- Existing types
  'client_added',
  'quote_sent',
  'quote_accepted',
  'quote_rejected',
  'invoice_issued',
  'invoice_paid',
  'invoice_overdue',
  'settings_updated',
  -- New types
  'subscription_limit_reached',
  'subscription_limit_warning',
  'subscription_expiring',
  'subscription_upgraded',
  'subscription_downgraded',
  'product_low_stock',
  'product_out_of_stock',
  'order_created',
  'order_status_changed',
  'order_received',
  'expense_added',
  'expense_approved',
  'expense_rejected',
  'supplier_added',
  'payment_received',
  'document_shared',
  'backup_completed',
  'system_maintenance',
  'feature_announcement'
));

-- ============================================
-- 3. CREATE USER NOTIFICATION PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  enabled_in_app BOOLEAN DEFAULT true,
  enabled_email BOOLEAN DEFAULT false,
  enabled_push BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification preferences"
  ON public.user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id 
ON public.user_notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_type 
ON public.user_notification_preferences(notification_type);

-- ============================================
-- 4. UPDATE INDEXES ON NOTIFICATIONS
-- ============================================

-- Add index on priority for filtering
CREATE INDEX IF NOT EXISTS idx_notifications_priority 
ON public.notifications(priority);

-- Add index on is_archived
CREATE INDEX IF NOT EXISTS idx_notifications_is_archived 
ON public.notifications(is_archived);

-- Add index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at 
ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_archived 
ON public.notifications(user_id, is_read, is_archived, created_at DESC);

-- ============================================
-- 5. ENHANCE CREATE_NOTIFICATION FUNCTION
-- ============================================

-- Drop old function first (with old signature)
DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID);

-- Create new enhanced function
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_channels JSONB DEFAULT '["in_app"]'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  notification_id UUID;
  user_prefs RECORD;
  should_create BOOLEAN := false;
  final_channels JSONB;
BEGIN
  -- Check user preferences
  SELECT * INTO user_prefs
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id AND notification_type = p_type;
  
  -- If no preference exists, use defaults (in_app enabled)
  IF user_prefs IS NULL THEN
    should_create := true;
    final_channels := p_channels;
  ELSE
    -- Check if at least one channel is enabled
    should_create := user_prefs.enabled_in_app 
      OR user_prefs.enabled_email 
      OR user_prefs.enabled_push;
    
    -- Build channels array based on preferences
    final_channels := '[]'::jsonb;
    IF user_prefs.enabled_in_app THEN
      final_channels := final_channels || '["in_app"]'::jsonb;
    END IF;
    IF user_prefs.enabled_email THEN
      final_channels := final_channels || '["email"]'::jsonb;
    END IF;
    IF user_prefs.enabled_push THEN
      final_channels := final_channels || '["push"]'::jsonb;
    END IF;
    
    -- Use preference priority if set
    IF user_prefs.priority IS NOT NULL THEN
      p_priority := user_prefs.priority;
    END IF;
  END IF;
  
  -- Only create notification if at least one channel is enabled
  IF should_create THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      priority,
      channels,
      metadata,
      action_url,
      action_label,
      expires_at
    )
    VALUES (
      p_user_id,
      p_type,
      p_title,
      p_message,
      p_entity_type,
      p_entity_id,
      p_priority,
      final_channels,
      p_metadata,
      p_action_url,
      p_action_label,
      p_expires_at
    )
    RETURNING id INTO notification_id;
    
    -- TODO: Trigger email/push notifications based on channels
    -- This would be handled by Edge Functions or external services
    
    RETURN notification_id;
  ELSE
    -- Return NULL if notification was suppressed by preferences
    RETURN NULL;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.create_notification IS 
  'Creates a notification respecting user preferences. Returns notification ID or NULL if suppressed.';

-- ============================================
-- 6. CREATE FUNCTION TO INITIALIZE USER PREFERENCES
-- ============================================

CREATE OR REPLACE FUNCTION public.initialize_user_notification_preferences(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  notification_type TEXT;
  default_priority TEXT;
BEGIN
  -- Default priorities for different notification types
  FOR notification_type IN 
    SELECT unnest(ARRAY[
      'client_added',
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'invoice_issued',
      'invoice_paid',
      'invoice_overdue',
      'subscription_limit_reached',
      'subscription_limit_warning',
      'product_low_stock',
      'order_status_changed',
      'expense_added',
      'settings_updated'
    ])
  LOOP
    -- Set default priority based on type
    CASE notification_type
      WHEN 'invoice_overdue' THEN default_priority := 'urgent';
      WHEN 'subscription_limit_reached' THEN default_priority := 'high';
      WHEN 'product_out_of_stock' THEN default_priority := 'high';
      WHEN 'invoice_paid' THEN default_priority := 'high';
      WHEN 'quote_accepted' THEN default_priority := 'high';
      ELSE default_priority := 'medium';
    END CASE;
    
    -- Insert default preferences (in_app enabled, email/push disabled)
    INSERT INTO public.user_notification_preferences (
      user_id,
      notification_type,
      enabled_in_app,
      enabled_email,
      enabled_push,
      priority
    )
    VALUES (
      p_user_id,
      notification_type,
      true,
      false,
      false,
      default_priority
    )
    ON CONFLICT (user_id, notification_type) DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.initialize_user_notification_preferences IS 
  'Initializes default notification preferences for a new user.';

-- ============================================
-- 7. CREATE FUNCTION TO MARK AS READ WITH TIMESTAMP
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notifications
  SET 
    is_read = true,
    read_at = NOW()
  WHERE id = p_notification_id
  AND user_id = auth.uid()
  AND is_read = false;
END;
$$;

COMMENT ON FUNCTION public.mark_notification_read IS 
  'Marks a notification as read with timestamp. Only works for current user.';

-- ============================================
-- 8. CREATE FUNCTION TO ARCHIVE OLD NOTIFICATIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.archive_old_notifications(
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_archived = true
  WHERE user_id = p_user_id
  AND is_archived = false
  AND created_at < NOW() - (p_days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

COMMENT ON FUNCTION public.archive_old_notifications IS 
  'Archives notifications older than specified days. Returns count of archived notifications.';

-- ============================================
-- 9. CREATE FUNCTION TO CLEANUP EXPIRED NOTIFICATIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW()
  AND is_read = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_notifications IS 
  'Deletes expired and read notifications. Can be called by cron job.';

-- ============================================
-- 10. CREATE TRIGGER TO AUTO-INITIALIZE PREFERENCES
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_initialize_user_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.initialize_user_notification_preferences(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger (if not exists)
DROP TRIGGER IF EXISTS trigger_initialize_preferences_on_user_create ON auth.users;
CREATE TRIGGER trigger_initialize_preferences_on_user_create
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_initialize_user_preferences();

-- ============================================
-- 11. UPDATE EXISTING TRIGGER FUNCTIONS
-- ============================================

-- Update notify_invoice_status_change to use new function signature
CREATE OR REPLACE FUNCTION public.notify_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  client_name TEXT;
  priority_level TEXT;
BEGIN
  -- Get client name for better messages
  SELECT name INTO client_name
  FROM public.clients
  WHERE id = NEW.client_id;
  
  -- Invoice issued
  IF OLD.status = 'draft' AND NEW.status = 'issued' THEN
    priority_level := 'medium';
    PERFORM public.create_notification(
      NEW.user_id,
      'invoice_issued',
      'Fattura emessa',
      'La fattura ' || NEW.invoice_number || COALESCE(' per ' || client_name, '') || ' è stata emessa.',
      'invoice',
      NEW.id,
      priority_level,
      '["in_app"]'::jsonb,
      jsonb_build_object('invoice_number', NEW.invoice_number, 'total', NEW.total),
      '/dashboard/invoices/' || NEW.id,
      'Visualizza fattura'
    );
  END IF;
  
  -- Invoice paid
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    priority_level := 'high';
    PERFORM public.create_notification(
      NEW.user_id,
      'invoice_paid',
      'Fattura pagata',
      'La fattura ' || NEW.invoice_number || ' di ' || NEW.total || ' CHF è stata pagata!',
      'invoice',
      NEW.id,
      priority_level,
      '["in_app", "email"]'::jsonb,
      jsonb_build_object('invoice_number', NEW.invoice_number, 'total', NEW.total),
      '/dashboard/invoices/' || NEW.id,
      'Visualizza fattura'
    );
  END IF;
  
  -- Invoice overdue
  IF OLD.status != 'overdue' AND NEW.status = 'overdue' THEN
    priority_level := 'urgent';
    PERFORM public.create_notification(
      NEW.user_id,
      'invoice_overdue',
      'Fattura scaduta',
      'La fattura ' || NEW.invoice_number || ' di ' || NEW.total || ' CHF è scaduta!',
      'invoice',
      NEW.id,
      priority_level,
      '["in_app", "email"]'::jsonb,
      jsonb_build_object('invoice_number', NEW.invoice_number, 'total', NEW.total, 'due_date', NEW.due_date),
      '/dashboard/invoices/' || NEW.id,
      'Visualizza fattura'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Similar updates for other trigger functions...
-- (We'll update them in the next migration or inline)

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.user_notification_preferences IS 
  'User preferences for notification types and channels. Controls which notifications users receive.';

COMMENT ON COLUMN public.notifications.priority IS 
  'Priority level: urgent (red), high (orange), medium (blue), low (gray)';

COMMENT ON COLUMN public.notifications.channels IS 
  'JSONB array of channels: ["in_app", "email", "push"]';

COMMENT ON COLUMN public.notifications.metadata IS 
  'Additional data in JSON format (e.g., amounts, dates, counts)';

COMMENT ON COLUMN public.notifications.action_url IS 
  'Optional URL to navigate when clicking notification';

COMMENT ON COLUMN public.notifications.action_label IS 
  'Label for action button (e.g., "Visualizza fattura")';

COMMENT ON COLUMN public.notifications.expires_at IS 
  'Expiration date for time-sensitive notifications';

COMMENT ON COLUMN public.notifications.is_archived IS 
  'Soft delete flag for old notifications';

COMMENT ON COLUMN public.notifications.read_at IS 
  'Timestamp when notification was marked as read';

