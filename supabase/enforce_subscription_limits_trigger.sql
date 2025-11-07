-- Trigger per impedire inserimenti oltre i limiti del piano

-- Funzione per verificare limiti PRIMA dell'inserimento
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
  -- Per clienti: conta il totale (non mensile)
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

-- Drop trigger esistenti se presenti
DROP TRIGGER IF EXISTS enforce_clients_limit ON clients;
DROP TRIGGER IF EXISTS enforce_invoices_limit ON invoices;
DROP TRIGGER IF EXISTS enforce_quotes_limit ON quotes;

-- Crea trigger per ogni tabella
CREATE TRIGGER enforce_clients_limit
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_subscription_limits();

CREATE TRIGGER enforce_invoices_limit
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_subscription_limits();

CREATE TRIGGER enforce_quotes_limit
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_subscription_limits();

-- Commento finale
COMMENT ON FUNCTION enforce_subscription_limits() IS 
  'Impedisce inserimenti oltre i limiti del piano abbonamento. 
   Trigger BEFORE INSERT su clients, invoices, quotes.';

