-- ====================================================================
-- RESET ACCOUNT DI TEST
-- Email: stefanovananti@gmail.com
-- ====================================================================
-- ATTENZIONE: Questo script cancella TUTTI i dati dell'account!
-- Eseguire solo per account di test!
-- ====================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_client_count INTEGER;
  v_invoice_count INTEGER;
  v_quote_count INTEGER;
BEGIN
  -- 1. Trova user_id
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'stefanovananti@gmail.com';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: stefanovananti@gmail.com';
  END IF;
  
  RAISE NOTICE 'User ID found: %', v_user_id;
  
  -- 2. Conta dati attuali (prima del reset)
  SELECT COUNT(*) INTO v_client_count FROM clients WHERE user_id = v_user_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_invoice_count FROM invoices WHERE user_id = v_user_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_quote_count FROM quotes WHERE user_id = v_user_id AND deleted_at IS NULL;
  
  RAISE NOTICE 'Before reset: % clients, % invoices, % quotes', v_client_count, v_invoice_count, v_quote_count;
  
  -- 3. RESET DATI (soft delete impostando deleted_at)
  
  -- Soft delete clienti
  UPDATE clients 
  SET deleted_at = NOW() 
  WHERE user_id = v_user_id AND deleted_at IS NULL;
  
  -- Soft delete fatture
  UPDATE invoices 
  SET deleted_at = NOW() 
  WHERE user_id = v_user_id AND deleted_at IS NULL;
  
  -- Soft delete preventivi
  UPDATE quotes 
  SET deleted_at = NOW() 
  WHERE user_id = v_user_id AND deleted_at IS NULL;
  
  -- Cancella righe fatture (hard delete, dipendono da invoices)
  DELETE FROM invoice_items WHERE invoice_id IN (
    SELECT id FROM invoices WHERE user_id = v_user_id
  );
  
  -- Cancella righe preventivi (hard delete, dipendono da quotes)
  DELETE FROM quote_items WHERE quote_id IN (
    SELECT id FROM quotes WHERE user_id = v_user_id
  );
  
  -- Cancella notifiche
  DELETE FROM notifications WHERE user_id = v_user_id;
  
  -- Reset company settings (opzionale - commenta se vuoi mantenerli)
  -- DELETE FROM company_settings WHERE user_id = v_user_id;
  
  -- 4. Verifica reset
  SELECT COUNT(*) INTO v_client_count FROM clients WHERE user_id = v_user_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_invoice_count FROM invoices WHERE user_id = v_user_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_quote_count FROM quotes WHERE user_id = v_user_id AND deleted_at IS NULL;
  
  RAISE NOTICE 'After reset: % clients, % invoices, % quotes', v_client_count, v_invoice_count, v_quote_count;
  RAISE NOTICE 'Reset completato con successo!';
  
END $$;

-- ====================================================================
-- VERIFICA FINALE
-- ====================================================================
SELECT 
  'clients' as table_name,
  COUNT(*) as active_count
FROM clients 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com')
  AND deleted_at IS NULL

UNION ALL

SELECT 
  'invoices' as table_name,
  COUNT(*) as active_count
FROM invoices 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com')
  AND deleted_at IS NULL

UNION ALL

SELECT 
  'quotes' as table_name,
  COUNT(*) as active_count
FROM quotes 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com')
  AND deleted_at IS NULL;

