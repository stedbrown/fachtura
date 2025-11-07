-- ============================================
-- FIX: Conteggio Clienti (Totale vs Mensile)
-- ============================================
-- Data: 2025-11-07
-- Problema: I clienti venivano contati per mese invece che in totale
-- Soluzione: Modificare trigger e funzioni per contare il totale

-- ============================================
-- 1. FIX: Trigger enforce_subscription_limits
-- ============================================

CREATE OR REPLACE FUNCTION enforce_subscription_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_max_count INTEGER;
  v_current_count INTEGER;
  v_resource_type TEXT;
  v_plan_name TEXT;
BEGIN
  -- Determina il tipo di risorsa e l'user_id
  IF TG_TABLE_NAME = 'clients' THEN
    v_resource_type := 'client';
    v_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_resource_type := 'invoice';
    v_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_resource_type := 'quote';
    v_user_id := NEW.user_id;
  ELSE
    RETURN NEW; -- Tabella non gestita, permetti inserimento
  END IF;

  -- Ottieni il piano dell'utente
  SELECT us.plan_id, sp.name
  INTO v_plan_id, v_plan_name
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = v_user_id;

  -- Se non ha piano, blocca (non dovrebbe mai succedere)
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Nessun piano attivo trovato per questo utente';
  END IF;

  -- Ottieni il limite del piano per questa risorsa
  IF v_resource_type = 'client' THEN
    SELECT max_clients INTO v_max_count
    FROM subscription_plans
    WHERE id = v_plan_id;
  ELSIF v_resource_type = 'invoice' THEN
    SELECT max_invoices INTO v_max_count
    FROM subscription_plans
    WHERE id = v_plan_id;
  ELSIF v_resource_type = 'quote' THEN
    SELECT max_quotes INTO v_max_count
    FROM subscription_plans
    WHERE id = v_plan_id;
  END IF;

  -- Se il limite è NULL (illimitato), permetti
  IF v_max_count IS NULL THEN
    RETURN NEW;
  END IF;

  -- Conta gli elementi esistenti
  -- Per clienti: conta il totale (non mensile) ✅ FIX
  -- Per fatture e preventivi: conta solo quelli del mese corrente
  IF v_resource_type = 'client' THEN
    SELECT COUNT(*)
    INTO v_current_count
    FROM clients
    WHERE user_id = v_user_id
      AND deleted_at IS NULL;
  ELSIF v_resource_type = 'invoice' THEN
    SELECT COUNT(*)
    INTO v_current_count
    FROM invoices
    WHERE user_id = v_user_id
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  ELSIF v_resource_type = 'quote' THEN
    SELECT COUNT(*)
    INTO v_current_count
    FROM quotes
    WHERE user_id = v_user_id
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  END IF;

  -- Verifica se si supera il limite
  IF v_current_count >= v_max_count THEN
    RAISE EXCEPTION 'Limite raggiunto: hai già % % su un massimo di % consentiti dal piano %', 
      v_current_count, 
      CASE 
        WHEN v_resource_type = 'client' THEN 'clienti'
        WHEN v_resource_type = 'invoice' THEN 'fatture'
        WHEN v_resource_type = 'quote' THEN 'preventivi'
      END,
      v_max_count,
      v_plan_name;
  END IF;

  -- Permetti l'inserimento
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. FIX: Funzione check_subscription_limits
-- ============================================

CREATE OR REPLACE FUNCTION check_subscription_limits(
  p_user_id UUID,
  p_resource_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_plan subscription_plans;
  v_usage usage_tracking;
  v_result JSONB;
  v_total_clients INTEGER; -- ✅ NEW: per conteggio clienti totali
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
  
  -- Get current usage (solo per fatture e preventivi)
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
    -- ✅ FIX: Per i clienti, conta il totale dalla tabella clients (non mensile)
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

-- ============================================
-- VERIFICA
-- ============================================
-- Commenta per confermare che le funzioni sono state aggiornate
COMMENT ON FUNCTION enforce_subscription_limits() IS 
  'FIX 2025-11-07: Clienti contati come totali (non mensili). Trigger BEFORE INSERT su clients, invoices, quotes.';

COMMENT ON FUNCTION check_subscription_limits(UUID, TEXT) IS 
  'FIX 2025-11-07: Clienti contati direttamente da tabella clients (totali, non mensili).';

