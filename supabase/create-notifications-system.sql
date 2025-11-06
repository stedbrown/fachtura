-- Create comprehensive notifications system
-- Automatically tracks important events: clients added, quotes sent/accepted/rejected,
-- invoices issued/paid/overdue, settings updated

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('client_added', 'quote_sent', 'quote_accepted', 'quote_rejected', 'invoice_issued', 'invoice_paid', 'invoice_overdue', 'settings_updated')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('client', 'quote', 'invoice', 'settings')),
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
  ON notifications FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function for new client
CREATE OR REPLACE FUNCTION notify_client_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'client_added',
    'Nuovo cliente aggiunto',
    'Il cliente "' || NEW.name || '" è stato aggiunto con successo.',
    'client',
    NEW.id
  );
  RETURN NEW;
END;
$$;

-- Trigger function for invoice status changes
CREATE OR REPLACE FUNCTION notify_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Invoice issued
  IF OLD.status = 'draft' AND NEW.status = 'issued' THEN
    PERFORM create_notification(
      NEW.user_id,
      'invoice_issued',
      'Fattura emessa',
      'La fattura ' || NEW.invoice_number || ' è stata emessa.',
      'invoice',
      NEW.id
    );
  END IF;
  
  -- Invoice paid
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    PERFORM create_notification(
      NEW.user_id,
      'invoice_paid',
      'Fattura pagata',
      'La fattura ' || NEW.invoice_number || ' è stata pagata!',
      'invoice',
      NEW.id
    );
  END IF;
  
  -- Invoice overdue
  IF OLD.status != 'overdue' AND NEW.status = 'overdue' THEN
    PERFORM create_notification(
      NEW.user_id,
      'invoice_overdue',
      'Fattura scaduta',
      'La fattura ' || NEW.invoice_number || ' è scaduta.',
      'invoice',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for quote status changes
CREATE OR REPLACE FUNCTION notify_quote_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Quote sent
  IF OLD.status = 'draft' AND NEW.status = 'sent' THEN
    PERFORM create_notification(
      NEW.user_id,
      'quote_sent',
      'Preventivo inviato',
      'Il preventivo ' || NEW.quote_number || ' è stato inviato.',
      'quote',
      NEW.id
    );
  END IF;
  
  -- Quote accepted
  IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
    PERFORM create_notification(
      NEW.user_id,
      'quote_accepted',
      'Preventivo accettato',
      'Il preventivo ' || NEW.quote_number || ' è stato accettato!',
      'quote',
      NEW.id
    );
  END IF;
  
  -- Quote rejected
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    PERFORM create_notification(
      NEW.user_id,
      'quote_rejected',
      'Preventivo rifiutato',
      'Il preventivo ' || NEW.quote_number || ' è stato rifiutato.',
      'quote',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_notify_client_added
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_added();

CREATE TRIGGER trigger_notify_invoice_status
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_invoice_status_change();

CREATE TRIGGER trigger_notify_quote_status
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_quote_status_change();

-- Add comment
COMMENT ON TABLE notifications IS 'System notifications for tracking important events like invoice due dates, quote acceptances, etc.';

