-- ========================================
-- MIGRATION: Sistema Abbonamenti Stripe
-- ========================================
-- Crea tabelle e funzioni per gestire abbonamenti con limiti automatici

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT UNIQUE,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CHF',
  interval TEXT NOT NULL DEFAULT 'month', -- month, year
  max_invoices INTEGER,
  max_clients INTEGER,
  max_quotes INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'trialing', -- trialing, active, past_due, canceled, incomplete
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  invoices_count INTEGER DEFAULT 0,
  quotes_count INTEGER DEFAULT 0,
  clients_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, price, currency, interval, max_invoices, max_clients, max_quotes, features) VALUES
('Free', 0, 'CHF', 'month', 5, 3, 5, '["3 clienti", "5 fatture/mese", "5 preventivi/mese", "PDF export"]'::jsonb),
('Pro', 29, 'CHF', 'month', 100, 50, 100, '["50 clienti", "100 fatture/mese", "100 preventivi/mese", "PDF export", "Personalizzazione documenti", "Supporto prioritario"]'::jsonb),
('Business', 79, 'CHF', 'month', NULL, NULL, NULL, '["Clienti illimitati", "Fatture illimitate", "Preventivi illimitati", "PDF export", "Personalizzazione completa", "Supporto 24/7", "API access"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create function to update usage tracking
CREATE OR REPLACE FUNCTION update_usage_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only count non-deleted items
  IF NEW.deleted_at IS NULL THEN
    INSERT INTO usage_tracking (user_id, period_start, period_end)
    VALUES (
      NEW.user_id,
      DATE_TRUNC('month', NOW()),
      DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    )
    ON CONFLICT (user_id, period_start) DO NOTHING;
    
    -- Update the appropriate counter
    IF TG_TABLE_NAME = 'invoices' THEN
      UPDATE usage_tracking
      SET invoices_count = invoices_count + 1,
          updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND period_start = DATE_TRUNC('month', NOW());
    ELSIF TG_TABLE_NAME = 'quotes' THEN
      UPDATE usage_tracking
      SET quotes_count = quotes_count + 1,
          updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND period_start = DATE_TRUNC('month', NOW());
    ELSIF TG_TABLE_NAME = 'clients' THEN
      UPDATE usage_tracking
      SET clients_count = clients_count + 1,
          updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND period_start = DATE_TRUNC('month', NOW());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for usage tracking
DROP TRIGGER IF EXISTS track_invoice_usage ON invoices;
CREATE TRIGGER track_invoice_usage
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking();

DROP TRIGGER IF EXISTS track_quote_usage ON quotes;
CREATE TRIGGER track_quote_usage
  AFTER INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking();

DROP TRIGGER IF EXISTS track_client_usage ON clients;
CREATE TRIGGER track_client_usage
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking();

-- Create function to check subscription limits
CREATE OR REPLACE FUNCTION check_subscription_limits(
  p_user_id UUID,
  p_resource_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_plan subscription_plans;
  v_usage usage_tracking;
  v_result JSONB;
BEGIN
  -- Get user's current plan
  SELECT sp.* INTO v_plan
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing');
  
  -- If no subscription, use free plan
  IF v_plan IS NULL THEN
    SELECT * INTO v_plan
    FROM subscription_plans
    WHERE name = 'Free'
    LIMIT 1;
  END IF;
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND period_start = DATE_TRUNC('month', NOW())
  LIMIT 1;
  
  -- Check limits based on resource type
  v_result := jsonb_build_object(
    'allowed', true,
    'plan_name', v_plan.name,
    'resource_type', p_resource_type
  );
  
  IF p_resource_type = 'invoice' THEN
    IF v_plan.max_invoices IS NOT NULL AND COALESCE(v_usage.invoices_count, 0) >= v_plan.max_invoices THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', COALESCE(v_usage.invoices_count, 0),
        'max_count', v_plan.max_invoices,
        'message', 'Hai raggiunto il limite di fatture per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', COALESCE(v_usage.invoices_count, 0),
        'max_count', v_plan.max_invoices
      );
    END IF;
  ELSIF p_resource_type = 'quote' THEN
    IF v_plan.max_quotes IS NOT NULL AND COALESCE(v_usage.quotes_count, 0) >= v_plan.max_quotes THEN
      v_result := v_result || jsonb_build_object(
        'allowed', false,
        'current_count', COALESCE(v_usage.quotes_count, 0),
        'max_count', v_plan.max_quotes,
        'message', 'Hai raggiunto il limite di preventivi per questo mese. Aggiorna il tuo piano per continuare.'
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'current_count', COALESCE(v_usage.quotes_count, 0),
        'max_count', v_plan.max_quotes
      );
    END IF;
  ELSIF p_resource_type = 'client' THEN
    -- Per i clienti, conta il totale dalla tabella clients (non mensile)
    DECLARE
      v_total_clients INTEGER;
    BEGIN
      SELECT COUNT(*)
      INTO v_total_clients
      FROM clients
      WHERE user_id = p_user_id
        AND deleted_at IS NULL;
      
      IF v_plan.max_clients IS NOT NULL AND v_total_clients >= v_plan.max_clients THEN
        v_result := v_result || jsonb_build_object(
          'allowed', false,
          'current_count', v_total_clients,
          'max_count', v_plan.max_clients,
          'message', 'Hai raggiunto il limite di clienti. Aggiorna il tuo piano per continuare.'
        );
      ELSE
        v_result := v_result || jsonb_build_object(
          'current_count', v_total_clients,
          'max_count', v_plan.max_clients
        );
      END IF;
    END;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

