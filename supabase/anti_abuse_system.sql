-- ========================================
-- MIGRATION: Sistema Anti-Abuso Account
-- ========================================
-- Previene la ricreazione di account per aggirare i limiti del piano FREE
-- Un utente non può ricreare un account con la stessa email per 90 giorni

-- 1. Crea tabella per tracciare account eliminati
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_email TEXT NOT NULL,
  user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan_name TEXT,
  was_paid_user BOOLEAN DEFAULT false,
  reason TEXT,
  -- Dati snapshot prima dell'eliminazione
  total_clients INTEGER DEFAULT 0,
  total_invoices INTEGER DEFAULT 0,
  total_quotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per ricerche rapide per email
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email ON deleted_accounts(user_email);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at ON deleted_accounts(deleted_at);

-- 2. Funzione per verificare se un'email è stata usata recentemente
CREATE OR REPLACE FUNCTION check_email_abuse_protection(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_deleted_account deleted_accounts;
  v_days_since_deletion INTEGER;
  v_blocking_period_days INTEGER := 90; -- Periodo di blocco: 90 giorni
BEGIN
  -- Cerca se l'email è stata usata da un account eliminato di recente
  SELECT *
  INTO v_deleted_account
  FROM deleted_accounts
  WHERE user_email = LOWER(TRIM(p_email))
  ORDER BY deleted_at DESC
  LIMIT 1;

  -- Se non c'è nessun account eliminato con questa email, è OK
  IF v_deleted_account IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'message', 'Email disponibile'
    );
  END IF;

  -- Calcola giorni dall'eliminazione
  v_days_since_deletion := EXTRACT(DAY FROM (NOW() - v_deleted_account.deleted_at));

  -- Se sono passati meno di 90 giorni, blocca
  IF v_days_since_deletion < v_blocking_period_days THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'message', FORMAT(
        'Questa email è stata utilizzata da un account eliminato il %s. ' ||
        'Per motivi di sicurezza, non è possibile riutilizzarla prima di %s giorni. ' ||
        'Giorni rimanenti: %s',
        TO_CHAR(v_deleted_account.deleted_at, 'DD/MM/YYYY'),
        v_blocking_period_days,
        v_blocking_period_days - v_days_since_deletion
      ),
      'days_remaining', v_blocking_period_days - v_days_since_deletion,
      'deleted_at', v_deleted_account.deleted_at,
      'blocking_period_days', v_blocking_period_days
    );
  END IF;

  -- Se sono passati più di 90 giorni, è OK
  RETURN jsonb_build_object(
    'allowed', true,
    'message', 'Email disponibile (periodo di blocco terminato)',
    'previous_account_deleted_at', v_deleted_account.deleted_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger per salvare snapshot prima dell'eliminazione
CREATE OR REPLACE FUNCTION archive_deleted_account()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_name TEXT;
  v_was_paid BOOLEAN;
  v_clients_count INTEGER;
  v_invoices_count INTEGER;
  v_quotes_count INTEGER;
BEGIN
  -- Ottieni info abbonamento
  SELECT sp.name, sp.price > 0
  INTO v_plan_name, v_was_paid
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = OLD.id;

  -- Conta risorse create
  SELECT COUNT(*) INTO v_clients_count
  FROM clients WHERE user_id = OLD.id AND deleted_at IS NULL;
  
  SELECT COUNT(*) INTO v_invoices_count
  FROM invoices WHERE user_id = OLD.id;
  
  SELECT COUNT(*) INTO v_quotes_count
  FROM quotes WHERE user_id = OLD.id;

  -- Salva snapshot
  INSERT INTO deleted_accounts (
    user_email,
    user_id,
    deleted_at,
    plan_name,
    was_paid_user,
    total_clients,
    total_invoices,
    total_quotes
  ) VALUES (
    OLD.email,
    OLD.id,
    NOW(),
    v_plan_name,
    v_was_paid,
    v_clients_count,
    v_invoices_count,
    v_quotes_count
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Applica trigger su eliminazione utente
DROP TRIGGER IF EXISTS archive_account_on_delete ON auth.users;
CREATE TRIGGER archive_account_on_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION archive_deleted_account();

-- 5. RLS Policies
ALTER TABLE deleted_accounts ENABLE ROW LEVEL SECURITY;

-- Solo admin/service role possono vedere deleted_accounts
CREATE POLICY "Service role can manage deleted_accounts"
  ON deleted_accounts
  FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Funzione per cleanup automatico (rimuove record dopo 2 anni)
CREATE OR REPLACE FUNCTION cleanup_old_deleted_accounts()
RETURNS void AS $$
BEGIN
  DELETE FROM deleted_accounts
  WHERE deleted_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Commenti per documentazione
COMMENT ON TABLE deleted_accounts IS 
'Traccia account eliminati per prevenire abusi. Blocca ricreazione account con stessa email per 90 giorni.';

COMMENT ON FUNCTION check_email_abuse_protection IS 
'Verifica se un''email può essere usata per registrazione o se è bloccata dal sistema anti-abuso.';

COMMENT ON FUNCTION archive_deleted_account IS 
'Salva snapshot dati account prima dell''eliminazione per tracking e anti-abuso.';

COMMENT ON FUNCTION cleanup_old_deleted_accounts IS 
'Rimuove record di account eliminati dopo 2 anni (GDPR compliance). Eseguire periodicamente.';

